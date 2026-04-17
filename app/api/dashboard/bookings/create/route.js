import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendBookingCreatedNotifications } from "@/lib/email";

async function getAuthContext(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const decoded = await adminAuth.verifyIdToken(auth);
  if (!decoded.tenantId) return null;
  return { uid: decoded.uid, tenantId: decoded.tenantId };
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
      photographerId = null, photographerEmail = "", photographerName = "",
      shootDate = "", shootTime = "",
      sendNotification = true,
    } = await req.json();

    if (!clientName || !clientEmail || !address) {
      return Response.json({ error: "Client name, email, and address are required." }, { status: 400 });
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
      photographerId:    photographerId    || null,
      photographerEmail: photographerEmail || null,
      photographerName:  photographerName  || null,
      shootDate:         shootDate         || null,
      shootTime:         shootTime         || null,
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
          const bizName   = tenant.branding?.businessName || tenant.businessName || "ShootFlow";
          const fromEmail = tenant.branding?.fromEmail || "noreply@shootflow.com";
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

          // Photographer notification
          if (photographerEmail) {
            sends.push(resend.emails.send({
              from, to: [photographerEmail],
              subject: `New booking assigned to you — ${fullAddress}`,
              html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px"><h2 style="color:${primary};font-family:Georgia,serif">New Shoot Assigned</h2><p>Hi ${photographerName || "there"},</p><p>You've been assigned a new booking:</p><ul style="line-height:1.8"><li><strong>Property:</strong> ${fullAddress}</li><li><strong>Client:</strong> ${clientName} (${clientEmail})</li>${shootInfo ? `<li><strong>Scheduled:</strong> ${shootInfo}</li>` : ""}${notes ? `<li><strong>Notes:</strong> ${notes}</li>` : ""}</ul><p>Log into the dashboard to view full details.</p><p style="color:#ccc;font-size:11px">${bizName}</p></div>`,
            }).catch(() => {}));
          }

          await Promise.all(sends);
        }
      } catch (emailErr) {
        console.error("Notification email error (non-fatal):", emailErr);
      }
    }

    return Response.json({ bookingId, ok: true });
  } catch (err) {
    console.error("Admin booking create error:", err);
    return Response.json({ error: "Failed to create booking." }, { status: 500 });
  }
}
