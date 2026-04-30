import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendBookingCreatedNotifications, generateCalendarICS } from "@/lib/email";
import { sendAgentPortalEmail } from "@/lib/sendAgentPortal";
import { sendBookingConfirmedSms } from "@/lib/sms";
import { getListingLimit } from "@/lib/plans";

async function getAuthContext(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { uid: decoded.uid, tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function POST(req) {
  try {
    const ctx = await getAuthContext(req);
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const {
      clientName, clientEmail, clientPhone = "",
      address, unit = "", city = "", state = "CA", zip = "",
      sqft = "",
      preferredDate = "", preferredTime = "",
      notes = "", totalPrice = 0, depositPaid = false,
      status = "confirmed", source = "manual",
      packageId = null, serviceIds = [], addonIds = [], customLineItems = [],
      photographerId = null, photographerEmail = "", photographerName = "", photographerPhone = "",
      shootDate = "", shootTime = "",
      additionalAppointments = [],
      additionalPhotographers = [],
      sendNotification = true,
    } = await req.json();

    if (!clientName || !clientEmail || !address) {
      return Response.json({ error: "Client name, email, and address are required." }, { status: 400 });
    }

    // Enforce plan listing limit — count active (non-cancelled) bookings
    const tenantForLimit = await getTenantById(ctx.tenantId);
    if (tenantForLimit) {
      const limit = getListingLimit(
        tenantForLimit.subscriptionPlan || "solo",
        tenantForLimit.addonListings || 0
      );
      const activeSnap = await adminDb
        .collection("tenants").doc(ctx.tenantId)
        .collection("bookings")
        .where("status", "!=", "cancelled")
        .count()
        .get();
      const activeCount = activeSnap.data().count || 0;
      if (activeCount >= limit) {
        return Response.json(
          { error: `Listing limit reached (${limit} active listings on your plan). Archive completed listings or upgrade to add more.` },
          { status: 403 }
        );
      }
    }

    const bookingId  = adminDb.collection("tmp").doc().id;
    const tenantRef  = adminDb.collection("tenants").doc(ctx.tenantId);
    const bookingRef = tenantRef.collection("bookings").doc(bookingId);

    const fullAddress = [address, unit, city, state, zip].filter(Boolean).join(", ");
    const finalPrice  = Number(totalPrice) || 0;

    const bookingData = {
      id:              bookingId,
      tenantId:        ctx.tenantId,
      clientName,
      clientEmail,
      clientPhone,
      address,
      unit:            unit || null,
      city,
      state,
      zip,
      sqft:            sqft ? Number(sqft) : null,
      fullAddress,
      preferredDate,
      preferredTime,
      notes,
      totalPrice:      finalPrice,
      depositAmount:   0,
      depositPaid:     Boolean(depositPaid),
      balancePaid:     false,
      paidInFull:      Boolean(depositPaid) && finalPrice === 0,
      remainingBalance: finalPrice,
      status,
      source,
      packageId:       packageId || null,
      serviceIds:      serviceIds || [],
      addonIds:        addonIds || [],
      customLineItems: customLineItems || [],
      photographerId:          photographerId          || null,
      photographerEmail:       photographerEmail       || null,
      photographerName:        photographerName        || null,
      additionalPhotographers: additionalPhotographers || [],
      shootDate:               shootDate               || null,
      shootTime:              shootTime              || null,
      additionalAppointments: additionalAppointments || [],
      createdAt:       new Date(),
      createdBy:       ctx.uid,
      stripeDepositIntentId:  null,
      stripeBalanceIntentId:  null,
      galleryId:       null,
    };

    await bookingRef.set(bookingData);

    // Upsert customer record
    if (clientEmail) {
      const agentKey = Buffer.from(clientEmail.toLowerCase().trim()).toString("base64").replace(/[+/=]/g, "");
      const agentRef = tenantRef.collection("agents").doc(agentKey);
      const agentSnap = await agentRef.get();
      if (!agentSnap.exists) {
        await agentRef.set({
          id: agentKey,
          name: clientName,
          email: clientEmail,
          phone: clientPhone,
          totalOrders: 1,
          totalSpent:  finalPrice,
          lastOrderAt: new Date(),
          createdAt:   new Date(),
        });
      } else {
        const prev = agentSnap.data();
        await agentRef.update({
          totalOrders: (prev.totalOrders || 0) + 1,
          totalSpent:  (prev.totalSpent  || 0) + finalPrice,
          lastOrderAt: new Date(),
          name:  clientName,
          phone: clientPhone || prev.phone,
        });
      }
    }

    // Send notifications (fire-and-forget — don't fail the booking if email fails)
    if (sendNotification !== false) {
      try {
        const [tenant, adminRecord] = await Promise.all([
          getTenantById(ctx.tenantId),
          adminAuth.getUser(ctx.uid),
        ]);
        if (tenant) {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          const primary   = tenant.branding?.primaryColor || "#0b2a55";
          const bizName   = tenant.branding?.businessName || tenant.businessName || "KyoriaOS";
          const fromEmail = tenant.branding?.fromEmail || "noreply@kyoriaos.com";
          const from      = `${bizName} <${fromEmail}>`;
          const shootInfo = shootDate
            ? `${new Date(shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${shootTime ? ` at ${shootTime}` : ""}`
            : null;

          const sends = [];

          // Client confirmation
          if (clientEmail) {
            sends.push(resend.emails.send({
              from, to: [clientEmail],
              subject: `Booking confirmed — ${fullAddress}`,
              html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px"><h2 style="color:${primary};font-family:Georgia,serif">Booking Confirmed</h2><p>Hi ${clientName},</p><p>Your booking for <strong>${fullAddress}</strong> has been created.${shootInfo ? `<br/>Scheduled: ${shootInfo}` : ""}</p><p style="color:#888;font-size:12px">Questions? Reply to this email.</p><hr style="border:none;border-top:1px solid #eee;margin:20px 0"/><p style="color:#ccc;font-size:11px">${bizName}</p></div>`,
            }).catch(() => {}));
          }

          // Build .ics attachment for photographer calendar invites
          let icsAttachment = [];
          if (shootDate && shootTime) {
            const icsContent = generateCalendarICS({
              summary:         `Photo Shoot — ${fullAddress}`,
              description:     `Client: ${clientName}\nProperty: ${fullAddress}${notes ? `\nNotes: ${notes}` : ""}`,
              location:        fullAddress,
              startISO:        `${shootDate}T${shootTime}:00`,
              durationMinutes: 120,
            });
            if (icsContent) {
              icsAttachment = [{ filename: "shoot-assignment.ics", content: Buffer.from(icsContent).toString("base64") }];
            }
          }

          // Helper: send assignment email to one photographer
          function sendToPhotographer(pEmail, pName) {
            if (!pEmail) return;
            sends.push(resend.emails.send({
              from,
              to: [pEmail],
              subject: `New shoot assigned to you — ${fullAddress}`,
              html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
                <h2 style="color:${primary};font-family:Georgia,serif;margin:0 0 8px">New Shoot Assigned</h2>
                <p style="color:#555;margin:0 0 20px">Hi ${pName || "there"},</p>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;width:36%">Property</td>
                      <td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:500">${fullAddress}</td></tr>
                  <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Client</td>
                      <td style="padding:8px 0;border-bottom:1px solid #eee">${clientName}${clientPhone ? ` · ${clientPhone}` : ""}</td></tr>
                  ${shootInfo ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Scheduled</td>
                      <td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:500">${shootInfo}</td></tr>` : ""}
                  ${notes ? `<tr><td style="padding:8px 0;color:#888;font-size:13px">Notes</td>
                      <td style="padding:8px 0;font-style:italic;color:#666">${notes}</td></tr>` : ""}
                </table>
                <p style="color:#888;font-size:12px">A calendar invite is attached. Log in to view full booking details.</p>
                <p style="color:#ccc;font-size:11px">${bizName}</p>
              </div>`,
              ...(icsAttachment.length ? { attachments: icsAttachment } : {}),
            }).catch(() => {}));
          }

          // Primary photographer
          sendToPhotographer(photographerEmail, photographerName);
          // Co-photographers
          for (const coPhoto of additionalPhotographers) {
            sendToPhotographer(coPhoto.email, coPhoto.name);
          }

          await Promise.all(sends);

          // SMS notifications (booking confirmed + photographer assignment)
          sendBookingConfirmedSms({
            booking: { ...bookingData, photographerPhone },
            tenant,
            photographerPhone,
          }).catch(() => {});
        }
      } catch (emailErr) {
        console.error("Notification email error (non-fatal):", emailErr);
      }
    }

    // Auto-send agent portal link (fire-and-forget)
    if (sendNotification !== false) {
      try {
        const portalTenant = tenant || await getTenantById(ctx.tenantId);
        if (portalTenant) {
          sendAgentPortalEmail({
            tenantId: ctx.tenantId,
            booking: bookingData,
            tenant: portalTenant,
            reason: "booking",
          }).catch(() => {});
        }
      } catch {}
    }

    return Response.json({ bookingId, ok: true });
  } catch (err) {
    console.error("Admin booking create error:", err);
    return Response.json({ error: "Failed to create booking." }, { status: 500 });
  }
}
