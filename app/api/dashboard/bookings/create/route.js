import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getTenantById } from "@/lib/tenants";
import { sendBookingCreatedNotifications, generateCalendarICS, sendServiceAgreementEmail } from "@/lib/email";
import { sendAgentPortalEmail } from "@/lib/sendAgentPortal";
import { sendBookingConfirmedSms } from "@/lib/sms";
import { tenantHasActivePlan, paymentRequired } from "@/lib/requireSubscription";
import { calculateDeposit } from "@/lib/catalogUtils";
import { validatePromo } from "@/lib/promo";

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
    if (!(await tenantHasActivePlan(ctx.tenantId))) return paymentRequired();

    const {
      clientName, clientEmail, clientPhone = "",
      address, unit = "", city = "", state = "CA", zip = "",
      sqft = "",
      preferredDate = "", preferredTime = "",
      notes = "", totalPrice = 0, depositPaid = false,
      status = "confirmed", source = "manual",
      packageId = null, serviceIds = [], addonIds = [], retainerIds = [], customLineItems = [],
      photographerId = null, photographerEmail = "", photographerName = "", photographerPhone = "",
      shootDate = "", shootTime = "",
      additionalAppointments = [],
      additionalPhotographers = [],
      sendNotification = true,
      sendAgreementEmail = false,
      zoneId = null,
      promoCode = null, promoId = null,
    } = await req.json();

    if (!clientName || !clientEmail || !address) {
      return Response.json({ error: "Client name, email, and address are required." }, { status: 400 });
    }

    const bookingId  = adminDb.collection("tmp").doc().id;
    const tenantRef  = adminDb.collection("tenants").doc(ctx.tenantId);
    const bookingRef = tenantRef.collection("bookings").doc(bookingId);

    const tenantSnap   = await tenantRef.get();
    const tenantData   = tenantSnap.data() || {};
    if (tenantData.subscriptionStatus === "canceled") {
      return Response.json({ error: "Your subscription has ended. Reactivate to create new bookings." }, { status: 403 });
    }
    const autoConvert  = tenantData.bookingConfig?.autoConvertToListing === true;

    const fullAddress = [address, unit, city, state, zip].filter(Boolean).join(", ");

    // ── Promo code — re-validate server-side; never trust a client discount ──
    // The form sends totalPrice as the pre-discount subtotal; we compute the
    // discount here and charge subtotal − discount. Usage is counted only if a
    // promo actually applies. `promoRef` is captured so we can increment it.
    const subtotal = Number(totalPrice) || 0;
    let promoDiscount = 0;
    let appliedPromoCode = null;
    let appliedPromoId = null;
    let promoRef = null;
    if (promoCode || promoId) {
      try {
        const promosRef = tenantRef.collection("promoCodes");
        const normalized = String(promoCode || "").trim().toUpperCase();
        const doc = promoId
          ? await promosRef.doc(promoId).get()
          : (await promosRef.where("code", "==", normalized).limit(1).get()).docs[0];
        if (doc?.exists) {
          const result = validatePromo(doc.data(), subtotal);
          if (result.ok && result.discount > 0) {
            promoDiscount    = result.discount;
            appliedPromoCode = doc.data().code;
            appliedPromoId   = doc.id;
            promoRef         = doc.ref;
          }
        }
      } catch (e) {
        console.error("[booking/create] promo validation failed:", e?.message);
      }
    }

    const finalPrice = Math.max(0, subtotal - promoDiscount);

    // Calculate deposit from the tenant's deposit config (percent / fixed / none).
    // Honors "no deposit" — previously this fell back to 50% whenever
    // depositPercent was unset (which is exactly the case for "none").
    const depositConfig = tenantData.bookingConfig?.deposit
      || (tenantData.bookingConfig?.depositPercent != null
        ? { type: "percent", value: tenantData.bookingConfig.depositPercent }
        : undefined);
    const calculatedDeposit = finalPrice > 0 ? calculateDeposit(finalPrice, depositConfig) : 0;
    const isDepositPaid = Boolean(depositPaid);
    const remainingBalance = isDepositPaid
      ? Math.max(0, finalPrice - calculatedDeposit)
      : finalPrice;
    const isBalancePaid = isDepositPaid && remainingBalance === 0;

    const normalizedEmail = clientEmail?.toLowerCase().trim() || "";

    const bookingData = {
      id:              bookingId,
      tenantId:        ctx.tenantId,
      clientName,
      clientEmail:     normalizedEmail,
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
      promoCode:       appliedPromoCode,
      promoId:         appliedPromoId,
      promoDiscount,
      depositAmount:   calculatedDeposit,
      depositPaid:     isDepositPaid,
      balancePaid:     isBalancePaid,
      paidInFull:      isDepositPaid && isBalancePaid,
      remainingBalance,
      status,
      source,
      packageId:       packageId || null,
      serviceIds:      serviceIds || [],
      addonIds:        addonIds || [],
      retainerIds:     retainerIds || [],
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
      zoneId:          zoneId || null,
    };

    await bookingRef.set(bookingData);

    // Count the promo usage now that the booking exists (best-effort).
    if (promoRef) {
      promoRef.update({ usageCount: FieldValue.increment(1) })
        .catch((e) => console.error("[booking/create] promo usage increment failed:", e?.message));
    }

    // Upsert customer record
    if (normalizedEmail) {
      const agentKey = Buffer.from(normalizedEmail).toString("base64").replace(/[+/=]/g, "");
      const agentRef = tenantRef.collection("agents").doc(agentKey);
      const agentSnap = await agentRef.get();
      if (!agentSnap.exists) {
        await agentRef.set({
          id: agentKey,
          name: clientName,
          email: normalizedEmail,
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

            // Build .ics attachment FIRST so it's available when pushing client email below
            function to24h(t) {
              if (!t) return null;
              const ampmMatch = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
              if (ampmMatch) {
                let h = parseInt(ampmMatch[1], 10);
                const m = ampmMatch[2];
                const period = ampmMatch[3].toUpperCase();
                if (period === "PM" && h !== 12) h += 12;
                if (period === "AM" && h === 12) h = 0;
                return `${String(h).padStart(2, "0")}:${m}`;
              }
              return t;
            }
            let icsAttachment = [];
            const calDate = shootDate || preferredDate;
            const calTimeRaw = shootTime || preferredTime;
            const calTime = to24h(calTimeRaw);
            if (calDate && calTime && !["flexible","morning","afternoon"].includes(calTimeRaw)) {
              const icsContent = generateCalendarICS({
                summary:         `Photo Shoot — ${fullAddress}`,
                description:     `Client: ${clientName}\nProperty: ${fullAddress}${notes ? `\nNotes: ${notes}` : ""}`,
                location:        fullAddress,
                startISO:        `${calDate}T${calTime}:00`,
                durationMinutes: 120,
              });
              if (icsContent) {
                icsAttachment = [{ filename: "shoot-appointment.ics", content: Buffer.from(icsContent).toString("base64") }];
              }
            }

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

            // Client confirmation (with ICS if date/time set)
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
                  ...(icsAttachment.length ? { attachments: [{ ...icsAttachment[0], filename: "shoot-appointment.ics" }] } : {}),
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

          // ── Service agreement email ───────────────────────────────────────
          const agreementText = tenantData.bookingConfig?.serviceAgreement?.text;
          if (sendAgreementEmail && agreementText && clientEmail) {
            sendServiceAgreementEmail({
              booking: { ...bookingData, fullAddress },
              agreementText,
              tenant,
            }).catch((err) => console.error("[agreement-email] FAILED:", err?.message || err));
          }

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
