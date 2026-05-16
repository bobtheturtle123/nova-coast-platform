import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendBookingCreatedNotifications, generateCalendarICS } from "@/lib/email";
import { sendAgentPortalEmail } from "@/lib/sendAgentPortal";
import { sendBookingConfirmedSms } from "@/lib/sms";

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

    const bookingId  = adminDb.collection("tmp").doc().id;
    const tenantRef  = adminDb.collection("tenants").doc(ctx.tenantId);
    const bookingRef = tenantRef.collection("bookings").doc(bookingId);

    const tenantSnap   = await tenantRef.get();
    const autoConvert  = tenantSnap.data()?.bookingConfig?.autoConvertToListing === true;

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
      photographerPhone:       photographerPhone       || null,
      additionalPhotographers: additionalPhotographers || [],
      shootDate:               shootDate               || null,
      shootTime:              shootTime              || null,
      additionalAppointments: additionalAppointments || [],
      createdAt:       new Date(),
      createdBy:       ctx.uid,
      stripeDepositIntentId:  null,
      stripeBalanceIntentId:  null,
      galleryId:       null,
      isListing:       autoConvert,
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
      console.log(`[booking] notifications triggered for bookingId=${bookingId} clientEmail=${clientEmail}`);
      try {
        const [tenant, adminRecord] = await Promise.all([
          getTenantById(ctx.tenantId),
          adminAuth.getUser(ctx.uid),
        ]);
        if (tenant) {
          const resendKey = process.env.RESEND_API_KEY;

          // ── Email notifications ─────────────────────────────────────────────
          if (!resendKey) {
            console.warn("[email] RESEND_API_KEY not set — email notifications skipped");
          } else {
            const { Resend } = await import("resend");
            const resend = new Resend(resendKey);
            const primary   = tenant.branding?.primaryColor || "#3486cf";
            const bizName   = tenant.branding?.businessName || tenant.businessName || "KyoriaOS";
            const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com";
            const from      = `${bizName} <${fromEmail}>`;
            const shootInfo = shootDate
              ? `${new Date(shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${shootTime ? ` at ${shootTime}` : ""}`
              : preferredDate
              ? `${new Date(preferredDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${preferredTime ? ` at ${preferredTime}` : ""}`
              : null;
            const adminEmail = tenant.email || adminRecord?.email || null;

            const sends = [];

            const bookingHtml = (heading, intro, extra = "") => `
              <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
                <h2 style="color:${primary};font-family:Georgia,serif;margin:0 0 12px">${heading}</h2>
                <p style="color:#555;margin:0 0 20px">${intro}</p>
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
                ${extra}
                <p style="color:#ccc;font-size:11px">${bizName}</p>
              </div>`;

            // Client confirmation
            if (clientEmail) {
              sends.push(
                resend.emails.send({
                  from, to: [clientEmail],
                  subject: `Booking confirmed — ${fullAddress}`,
                  html: bookingHtml(
                    "Booking Confirmed",
                    `Hi ${clientName}, your booking for <strong>${fullAddress}</strong> has been created.`,
                    `<p style="color:#888;font-size:12px;margin:0">Questions? Reply to this email.</p>`
                  ),
                }).then(() => console.log("[email] client confirmation sent to", clientEmail))
                  .catch((e) => console.error("[email] client confirmation FAILED:", e?.message || e))
              );
            }

            // Admin notification
            if (adminEmail) {
              sends.push(
                resend.emails.send({
                  from, to: [adminEmail],
                  subject: `New booking — ${fullAddress}`,
                  html: bookingHtml("New Booking Created", `${clientName} · ${clientEmail}${clientPhone ? ` · ${clientPhone}` : ""}`),
                }).then(() => console.log("[email] admin notification sent to", adminEmail))
                  .catch((e) => console.error("[email] admin notification FAILED:", e?.message || e))
              );
            }

            // Build .ics attachment for photographer calendar invites
            let icsAttachment = [];
            const calDate = shootDate || preferredDate;
            const calTime = shootTime || preferredTime;
            if (calDate && calTime && !["flexible","morning","afternoon"].includes(calTime)) {
              const icsContent = generateCalendarICS({
                summary:         `Photo Shoot — ${fullAddress}`,
                description:     `Client: ${clientName}\nProperty: ${fullAddress}${notes ? `\nNotes: ${notes}` : ""}`,
                location:        fullAddress,
                startISO:        `${calDate}T${calTime}:00`,
                durationMinutes: 120,
              });
              if (icsContent) {
                icsAttachment = [{ filename: "shoot-assignment.ics", content: Buffer.from(icsContent).toString("base64") }];
              }
            }

            // Photographer assignment emails
            const sendToPhotographer = (pEmail, pName) => {
              if (!pEmail) return;
              sends.push(
                resend.emails.send({
                  from,
                  to: [pEmail],
                  subject: `New shoot assigned to you — ${fullAddress}`,
                  html: bookingHtml("New Shoot Assigned", `Hi ${pName || "there"},`, `<p style="color:#888;font-size:12px">A calendar invite is attached.</p>`),
                  ...(icsAttachment.length ? { attachments: icsAttachment } : {}),
                }).then(() => console.log("[email] photographer assignment sent to", pEmail))
                  .catch((e) => console.error("[email] photographer assignment FAILED to", pEmail, ":", e?.message || e))
              );
            };

            sendToPhotographer(photographerEmail, photographerName);
            for (const coPhoto of additionalPhotographers) {
              sendToPhotographer(coPhoto.email, coPhoto.name);
            }

            await Promise.all(sends);
            console.log(`[email] manual booking sends complete for bookingId=${bookingId}`);
          } // end: resendKey exists

          // ── SMS notifications — independent of email key ──────────────────
          sendBookingConfirmedSms({
            booking: { ...bookingData, photographerPhone },
            tenant,
            photographerPhone,
          })
            .then(() => console.log(`[sms] booking confirmed SMS fired for bookingId=${bookingId}`))
            .catch((err) => console.error("[sms] manual booking SMS FAILED:", err?.message || err));

          // ── Agent portal link ─────────────────────────────────────────────
          sendAgentPortalEmail({
            tenantId: ctx.tenantId,
            booking: bookingData,
            tenant,
            reason: "booking",
          }).catch((err) => console.error("[agent-portal] email FAILED:", err?.message || err));

        } // end: if (tenant)
      } catch (emailErr) {
        console.error("[booking] notification error (non-fatal):", emailErr?.message || emailErr);
      }
    }

    return Response.json({ bookingId, ok: true });
  } catch (err) {
    console.error("Admin booking create error:", err);
    return Response.json({ error: "Failed to create booking." }, { status: 500 });
  }
}
