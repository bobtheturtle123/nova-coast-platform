import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { sendBookingApproved } from "@/lib/email";
import { getTenantById } from "@/lib/tenants";
import { recomputeBalance } from "@/lib/bookingBalance";
import { v4 as uuidv4 } from "uuid";
import { Resend } from "resend";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return {
      tenantId: decoded.tenantId,
      role: decoded.role || (decoded.memberId ? "photographer" : "owner"),
      actorName: decoded.name || decoded.email || "A team member",
      uid: decoded.uid,
    };
  } catch { return null; }
}

export async function GET(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .get();

  if (!doc.exists) return Response.json({ error: "Not found" }, { status: 404 });
  const data = doc.data();
  for (const key of ["createdAt", "updatedAt", "preferredDate", "shootDate"]) {
    if (data[key]?._seconds) data[key] = new Date(data[key]._seconds * 1000).toISOString();
    else if (data[key]?.toDate) data[key] = data[key].toDate().toISOString();
  }
  return Response.json({ booking: { id: doc.id, ...data } });
}

export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const isPrivileged = ctx.role === "owner" || ctx.role === "admin";

  // Financial overrides are restricted to owners and admins only
  const FINANCIAL_FIELDS = new Set([
    "depositPaid", "depositAmount", "balancePaid", "remainingBalance",
    "offlinePaymentAmount", "offlinePaymentMethod", "offlinePaymentNote", "totalPrice",
  ]);
  for (const key of FINANCIAL_FIELDS) {
    if (body[key] !== undefined && !isPrivileged) {
      return Response.json({ error: "Insufficient permissions to modify payment fields" }, { status: 403 });
    }
  }

  const allowed = [
    // Scheduling & status
    "status", "workflowStatus", "shootDate", "shootTime", "shootDuration", "preferredTime",
    "additionalAppointments",
    // Reschedule fee (0 when waived) + waived flag
    "rescheduleFee", "rescheduleFeeWaived",
    // Photographer assignment
    "photographerId", "photographerEmail", "photographerName", "photographerPhone",
    "additionalPhotographers",
    // Listing flag
    "isListing",
    // Dashboard visibility
    "hidden",
    // Notes & website
    "notes", "propertyWebsite",
    // Client info
    "clientName", "clientEmail", "clientPhone",
    // Property / address
    "address", "unit", "addressLine", "city", "state", "zip", "fullAddress", "squareFootage", "propertyType",
    // Services
    "packageId", "serviceIds", "addonIds", "retainerIds", "customLineItems", "totalPrice",
    // Promo
    "promoCode", "promoDiscount",
    // Payment overrides (privileged only — enforced above)
    "depositPaid", "depositAmount", "balancePaid", "paidInFull", "remainingBalance",
    "offlinePaymentAmount", "offlinePaymentMethod", "offlinePaymentNote",
  ];
  const update = {};
  for (const k of allowed) {
    if (body[k] !== undefined) update[k] = body[k];
  }
  if (update.clientEmail) update.clientEmail = update.clientEmail.toLowerCase().trim();
  update.updatedAt = new Date();

  const tenantRef  = adminDb.collection("tenants").doc(ctx.tenantId);
  const bookingRef = tenantRef.collection("bookings").doc(params.id);
  const [tenantSnap, prevSnap] = await Promise.all([tenantRef.get(), bookingRef.get()]);
  // A canceled subscription stops new work, but existing listings stay
  // manageable: publishing/unpublishing the website, hiding, notes and status
  // are always allowed. Only broader edits are blocked.
  const MANAGE_WHEN_CANCELED = new Set([
    "propertyWebsite", "hidden", "notes", "status", "workflowStatus", "updatedAt",
    // Recording payments received on existing bookings is allowed when canceled.
    "depositPaid", "balancePaid", "paidInFull", "remainingBalance", "depositAmount",
    "offlinePaymentAmount", "offlinePaymentMethod",
  ]);
  const touchedKeys = Object.keys(update);
  const onlyManageFields = touchedKeys.length > 0 && touchedKeys.every((k) => MANAGE_WHEN_CANCELED.has(k));
  if (tenantSnap.exists && tenantSnap.data().subscriptionStatus === "canceled" && !onlyManageFields) {
    return Response.json({ error: "Your subscription has ended. Reactivate your membership to modify bookings." }, { status: 403 });
  }
  const prev = prevSnap.data() || {};

  // Auto-compute paidInFull when both deposit and balance are marked paid
  if (update.depositPaid !== undefined || update.balancePaid !== undefined) {
    const effectiveDeposit = update.depositPaid ?? prev.depositPaid;
    const effectiveBalance = update.balancePaid ?? prev.balancePaid;
    if (effectiveDeposit && effectiveBalance) update.paidInFull = true;
    else update.paidInFull = false;
  }

  // Auto-advance workflowStatus when payment is marked as complete
  const nowPaid = update.paidInFull ?? (update.balancePaid || update.depositPaid
    ? ((update.depositPaid ?? prev.depositPaid) && (update.balancePaid ?? prev.balancePaid))
    : null);
  if (nowPaid && prev.galleryId) {
    try {
      const galRef  = adminDb.collection("tenants").doc(ctx.tenantId)
        .collection("galleries").doc(prev.galleryId);
      const galSnap = await galRef.get();
      if (galSnap.exists) {
        // Unlock the gallery so the agent can download. Stamp unlockedAt so the
        // cleanup cron can remove the (now-unneeded) previews 30+ days later.
        if (!galSnap.data()?.unlocked) {
          await galRef.update({ unlocked: true, unlockedAt: new Date() });
        }
        // Auto-advance workflowStatus to completed if delivered and no pending revisions
        if (galSnap.data()?.delivered && (prev.workflowStatus === "delivered" || prev.workflowStatus === "appointment_confirmed" || prev.workflowStatus === "booked")) {
          const pendRev = await adminDb.collection("tenants").doc(ctx.tenantId)
            .collection("revisionRequests")
            .where("bookingId", "==", params.id).where("status", "==", "pending").limit(1).get();
          if (pendRev.empty) update.workflowStatus = "completed";
        }
      }
    } catch (e) { console.error("[booking/PATCH] payment unlock failed (non-fatal):", e?.message); }
  }

  // Recalculate the balance when totalPrice changes (e.g. adding/removing custom
  // line items). A paid deposit is never re-derived — see lib/bookingBalance.
  if (update.totalPrice !== undefined && isPrivileged) {
    const depositPaid = update.depositPaid ?? prev.depositPaid ?? false;
    const balancePaid = update.balancePaid ?? prev.balancePaid ?? false;
    // Only fetch the tenant when we actually need the deposit % (nothing paid).
    let depositPct = 0.5;
    if (!depositPaid && !balancePaid && !update.paidInFull) {
      const tenant = await getTenantById(ctx.tenantId);
      depositPct = Number(tenant?.bookingConfig?.depositPercent ?? 50) / 100;
    }
    const result = recomputeBalance({
      newTotal:     Number(update.totalPrice) || 0,
      discount:     Number(update.promoDiscount ?? prev.promoDiscount ?? 0),
      depositPaid,
      balancePaid,
      paidInFull:   update.paidInFull ?? prev.paidInFull ?? false,
      priorDeposit: Number(prev.depositAmount) || 0,
      depositPct,
    });
    if (result.depositAmount !== undefined) update.depositAmount = result.depositAmount;
    update.remainingBalance = result.remainingBalance;
  }

  // Re-lock gallery when a new service is added post-delivery and raises the total
  if (update.totalPrice !== undefined && isPrivileged && prev.galleryId) {
    const prevTotal = Number(prev.totalPrice) || 0;
    const newTotal  = Number(update.totalPrice) || 0;
    if (newTotal > prevTotal) {
      try {
        const galRef  = adminDb.collection("tenants").doc(ctx.tenantId)
          .collection("galleries").doc(prev.galleryId);
        const galSnap = await galRef.get();
        if (galSnap.exists && galSnap.data()?.unlocked && galSnap.data()?.delivered) {
          await galRef.update({ unlocked: false });
          // If they already paid the previous total, they only owe the difference
          if (prev.balancePaid || prev.paidInFull) {
            update.remainingBalance = Math.round((newTotal - prevTotal) * 100) / 100;
            update.balancePaid = false;
            update.paidInFull = false;
          }
        }
      } catch (e) {
        console.error("[booking/PATCH] gallery re-lock failed (non-fatal):", e?.message);
      }
    }
  }

  // Late-reschedule fee → actually charge it: add to the total AND the balance
  // due so the client owes it. (Previously rescheduleFee was stored but never
  // affected what the client owed.) Applied server-side so it works for any
  // editor and can't be bypassed. Waived fees add nothing.
  let appliedReschedFee = 0;
  if (update.rescheduleFee !== undefined && Number(update.rescheduleFee) > 0 && !update.rescheduleFeeWaived) {
    appliedReschedFee = Number(update.rescheduleFee);
    update.totalPrice       = Math.round(((Number(prev.totalPrice) || 0) + appliedReschedFee) * 100) / 100;
    update.remainingBalance = Math.round(((Number(prev.remainingBalance) || 0) + appliedReschedFee) * 100) / 100;
    // A previously fully-paid booking now has the fee outstanding.
    if (prev.paidInFull || prev.balancePaid) { update.paidInFull = false; update.balancePaid = false; }
  }

  await bookingRef.update(update);

  const isCancelling = update.status === "cancelled" && prev.status !== "cancelled";
  const isPostponing = update.workflowStatus === "postponed" && prev.workflowStatus !== "postponed";

  // Cancel / postpone → remove the calendar event, log it, and notify the
  // photographer + client. (Handled before the reschedule block so clearing the
  // date doesn't also fire a "rescheduled" notice.)
  if (isCancelling || isPostponing) {
    import("@/lib/pushGcal").then((m) => m.deleteBookingGcalEvent(ctx.tenantId, params.id)).catch(() => {});
    const verb = isCancelling ? "cancelled" : "postponed";
    import("@/lib/activityLog").then((m) => m.logBookingActivity(ctx.tenantId, params.id, {
      type:    verb === "cancelled" ? "cancelled" : "postponed",
      title:   `Booking ${verb} by ${ctx.actorName}`,
      message: `${ctx.actorName} ${verb} the shoot at ${prev.fullAddress || prev.address || "the property"}.${isPostponing ? " Awaiting a new date." : ""}`,
    })).catch(() => {});
    if (process.env.RESEND_API_KEY) {
      try {
        const tenant  = await getTenantById(ctx.tenantId);
        const bizName = tenant?.branding?.businessName || tenant?.businessName || "KyoriaOS";
        const primary = tenant?.branding?.primaryColor || "#3486cf";
        const from    = `${bizName} <${process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com"}>`;
        const addr    = prev.fullAddress || prev.address || "your property";
        const headline = isCancelling ? "Your shoot has been cancelled" : "Your shoot has been postponed";
        const sub      = isCancelling
          ? `We've cancelled the shoot at <strong>${addr}</strong>.`
          : `The shoot at <strong>${addr}</strong> has been postponed — we'll reach out to reschedule.`;
        const body = (hi) => `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 20px">
          <h2 style="color:${primary};font-family:Georgia,serif;margin:0 0 10px">${headline}</h2>
          <p style="color:#555;margin:0 0 8px">${hi}</p>
          <p style="color:#555;margin:0">${sub}</p>
          <p style="color:#ccc;font-size:11px;margin-top:18px">${bizName}</p>
        </div>`;
        const R = new Resend(process.env.RESEND_API_KEY);
        if (body.notifyClientOnCancel !== false && prev.clientEmail) {
          R.emails.send({ from, to: [prev.clientEmail], subject: `${isCancelling ? "Cancelled" : "Postponed"} — ${addr}`, html: body(`Hi ${prev.clientName || "there"},`) }).catch(() => {});
        }
        if (prev.photographerEmail) {
          R.emails.send({ from, to: [prev.photographerEmail], subject: `Shoot ${verb} — ${addr}`, html: body(`Hi ${prev.photographerName || "there"},`) }).catch(() => {});
        }
      } catch (e) { console.error("[booking/PATCH] cancel/postpone notify error:", e?.message); }
    }
  }

  // Schedule change → record it on the activity log (who + old→new) AND re-push
  // the Google Calendar event so its time stays correct. Runs for ANY editor
  // (owner or team member), regardless of whether a client notice was sent.
  const dateChanged = update.shootDate !== undefined && update.shootDate !== prev.shootDate;
  const timeChanged = update.shootTime !== undefined && update.shootTime !== prev.shootTime;
  if ((dateChanged || timeChanged) && !isCancelling && !isPostponing) {
    const fmtWhen = (dt, tm) => {
      if (!dt) return "unscheduled";
      const d = new Date(`${String(dt).split("T")[0]}T12:00:00`);
      const dl = isNaN(d) ? dt : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
      return tm ? `${dl} at ${tm}` : dl;
    };
    const fromWhen = fmtWhen(prev.shootDate, prev.shootTime);
    const toWhen   = fmtWhen(update.shootDate ?? prev.shootDate, update.shootTime ?? prev.shootTime);
    const feeNote  = appliedReschedFee > 0 ? ` A late-reschedule fee of $${appliedReschedFee.toLocaleString()} was added to the balance.` : (update.rescheduleFeeWaived ? " The late-reschedule fee was waived." : "");
    import("@/lib/activityLog").then((m) => m.logBookingActivity(ctx.tenantId, params.id, {
      type:    "reschedule",
      title:   `Rescheduled to ${toWhen} by ${ctx.actorName}${appliedReschedFee > 0 ? ` (+$${appliedReschedFee.toLocaleString()} late fee)` : ""}`,
      message: `${ctx.actorName} changed the shoot from ${fromWhen} to ${toWhen}.${feeNote}`,
    })).catch(() => {});
    // Keep the assigned photographer's calendar current on EVERY reschedule —
    // independent of the client-notify checkbox. Two paths, same as a new
    // booking: (1) push to their Google Calendar if they granted write access,
    // and (2) always email them an updating .ics they can add with one tap.
    if (prev.photographerId) {
      import("@/lib/pushGcal").then((m) => m.pushBookingToGcal(ctx.tenantId, params.id)).catch((e) => console.error("[booking/PATCH] gcal re-push failed:", e?.message));
    }
    const photogEmail = update.photographerEmail || prev.photographerEmail;
    // Skip if the photographer was just newly assigned (the assignment email
    // below already includes the .ics).
    const photographerUnchanged = !(update.photographerEmail && update.photographerEmail !== prev.photographerEmail);
    if (photogEmail && photographerUnchanged && process.env.RESEND_API_KEY) {
      try {
        const tenant  = await getTenantById(ctx.tenantId);
        const bizName = tenant?.branding?.businessName || tenant?.businessName || "KyoriaOS";
        const primary = tenant?.branding?.primaryColor || "#3486cf";
        const from    = `${bizName} <${process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com"}>`;
        const addr    = update.fullAddress || prev.fullAddress || prev.address || "Property";
        const sDate   = String(update.shootDate ?? prev.shootDate ?? "").split("T")[0];
        const sTime   = update.shootTime ?? prev.shootTime;
        const t12 = (t) => { if (!t || !/^\d{1,2}:\d{2}/.test(t)) return t || ""; const [hh, mm] = t.split(":"); let h = parseInt(hh, 10); const ap = h >= 12 ? "PM" : "AM"; if (h > 12) h -= 12; if (h === 0) h = 12; return `${h}:${mm} ${ap}`; };
        const dLabel  = sDate ? new Date(sDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : "";
        const whenTxt = `${dLabel}${t12(sTime) ? ` at ${t12(sTime)}` : ""}`;

        // What's being shot, so the photographer knows what to bring/do.
        let svcNames = [];
        try {
          const { getTenantCatalog } = await import("@/lib/tenants");
          const { resolveBookingServiceNames } = await import("@/lib/bookingServices");
          svcNames = resolveBookingServiceNames({ ...prev, ...update }, await getTenantCatalog(ctx.tenantId));
        } catch {}
        const svcTxt = svcNames.join(", ");

        const { buildBookingIcs } = await import("@/lib/ics");
        const uid = prev.icsUid || `booking-${params.id}@kyoriaos.com`;
        const seq = (Number(prev.icsSequence) || 0) + 1;
        await bookingRef.update({ icsUid: uid, icsSequence: seq });
        const ics = buildBookingIcs({ booking: { ...prev, ...update }, tenant, shootDate: sDate, shootTime: sTime, uid, sequence: seq, method: "PUBLISH", description: `${whenTxt}\\nClient: ${prev.clientName || ""}${prev.clientPhone ? ` (${prev.clientPhone})` : ""}${svcTxt ? `\\nServices: ${svcTxt}` : ""}` });

        await new Resend(process.env.RESEND_API_KEY).emails.send({
          from, to: [photogEmail],
          subject: `Shoot rescheduled — ${addr}`,
          html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 20px">
            <h2 style="color:${primary};font-family:Georgia,serif;margin:0 0 10px">Shoot rescheduled</h2>
            <p style="color:#555;margin:0 0 4px">New date &amp; time:</p>
            <p style="font-size:18px;font-weight:700;color:#0F172A;margin:0 0 14px">${whenTxt}</p>
            <p style="color:#555;margin:0 0 4px">Location: <strong>${addr}</strong></p>
            ${svcTxt ? `<p style="color:#555;margin:6px 0 0">Services: <strong>${svcTxt}</strong></p>` : ""}
            <p style="color:#888;font-size:12px;margin-top:16px">The attached invite updates this shoot on your calendar.</p>
          </div>`,
          attachments: [{ filename: "shoot.ics", content: Buffer.from(ics).toString("base64"), contentType: 'text/calendar; method=PUBLISH; name="shoot.ics"' }],
        }).catch((e) => console.error("[booking/PATCH] photographer reschedule email failed:", e?.message));
      } catch (e) { console.error("[booking/PATCH] photographer reschedule email error:", e?.message); }
    }
  }

  // Additional appointments changed (without a main date/time change) → keep the
  // photographer's calendar in sync. The reschedule block above already re-pushes
  // when the main date/time moves, so guard against a double push here.
  const apptsChanged = update.additionalAppointments !== undefined &&
    JSON.stringify(update.additionalAppointments) !== JSON.stringify(prev.additionalAppointments || []);
  if (apptsChanged && !isCancelling && !isPostponing && !(dateChanged || timeChanged)) {
    const pid = update.photographerId ?? prev.photographerId;
    if (pid) {
      import("@/lib/pushGcal").then((m) => m.pushBookingToGcal(ctx.tenantId, params.id))
        .catch((e) => console.error("[booking/PATCH] gcal appointment re-push failed:", e?.message));
    }
  }

  // Manual payment recorded from the dashboard — log it to the listing's
  // activity (idempotent key on booking + amount, so a retried request
  // doesn't duplicate but a corrected amount creates a new entry).
  if (update.offlinePaymentAmount !== undefined &&
      Number(update.offlinePaymentAmount) > 0 &&
      Number(update.offlinePaymentAmount) !== Number(prev.offlinePaymentAmount || 0)) {
    const cents = Math.round(Number(update.offlinePaymentAmount) * 100);
    import("@/lib/activityLog").then((m) => m.logPaymentActivity(ctx.tenantId, params.id, {
      paymentType: "manual",
      payerName:  prev.clientName  || null,
      payerEmail: prev.clientEmail || null,
      grossCents: cents,
      feeCents:   0, // recorded outside Stripe — no platform fee
      method:     update.offlinePaymentMethod || prev.offlinePaymentMethod || "manual",
      source:     "dashboard (recorded manually)",
      address:    prev.fullAddress || prev.address || null,
      idKey:      `manual_${params.id}_${cents}`,
    })).catch(() => {});
  }

  // Send photographer notification when photographer is newly assigned or changed
  const newPhotographerEmail = update.photographerEmail;
  if (newPhotographerEmail && newPhotographerEmail !== prev.photographerEmail) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const tenant = await getTenantById(ctx.tenantId);
        if (tenant) {
          const bizName   = tenant.branding?.businessName || tenant.businessName || "KyoriaOS";
          const primary   = tenant.branding?.primaryColor || "#3486cf";
          const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com";
          const from      = `${bizName} <${fromEmail}>`;
          const address   = update.fullAddress || prev.fullAddress || prev.address || "Property";
          const shootDate = update.shootDate || prev.shootDate;
          const shootTime = update.shootTime || prev.shootTime;
          const clientName = prev.clientName || "";
          const clientPhone = prev.clientPhone || "";
          const clientEmail = prev.clientEmail || "";
          const duration   = Number(prev.shootDuration) > 0 ? Number(prev.shootDuration) : null;
          const notes      = prev.notes || "";
          const twilight   = prev.twilightTime || null;
          const propType   = prev.propertyType || "";
          const sqft       = prev.squareFootage || "";

          // 12-hour time (e.g. "2:00 PM") — bookings store 24h "14:00".
          const time12 = (t) => {
            if (!t || !/^\d{1,2}:\d{2}/.test(t)) return t || "";
            const [hh, mm] = t.split(":"); let h = parseInt(hh, 10);
            const ap = h >= 12 ? "PM" : "AM"; if (h > 12) h -= 12; if (h === 0) h = 12;
            return `${h}:${mm} ${ap}`;
          };
          const dateLabel = shootDate ? new Date(String(shootDate).split("T")[0] + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : null;
          const timeLabel = time12(shootTime);

          const { getAppUrl } = await import("@/lib/appUrl");
          const shootUrl = `${getAppUrl()}/photographer/shoots/${params.id}`;

          // What's being shot, so the photographer knows what to bring/do.
          let svcNames = [];
          try {
            const { getTenantCatalog } = await import("@/lib/tenants");
            const { resolveBookingServiceNames } = await import("@/lib/bookingServices");
            svcNames = resolveBookingServiceNames({ ...prev, ...update }, await getTenantCatalog(ctx.tenantId));
          } catch {}
          const svcTxt = svcNames.join(", ");

          // Attach a calendar invite so the photographer gets an event even
          // without connecting Google (anchored to the property timezone).
          let icsAttachment = null;
          try {
            const { buildBookingIcs } = await import("@/lib/ics");
            const uid = prev.icsUid || `booking-${params.id}@kyoriaos.com`;
            // PUBLISH: the photographer simply ADDS this to their calendar (they
            // aren't an RSVP attendee), which loads reliably in Gmail.
            const ics = buildBookingIcs({
              booking: { ...prev, ...update }, tenant,
              shootDate: String(shootDate).split("T")[0], shootTime,
              uid, sequence: (Number(prev.icsSequence) || 0) + 1, method: "PUBLISH",
              description: `${dateLabel || ""}${timeLabel ? ` at ${timeLabel}` : ""}\\nClient: ${clientName}${clientPhone ? ` (${clientPhone})` : ""}${duration ? `\\nDuration: ${duration} min` : ""}${svcTxt ? `\\nServices: ${svcTxt}` : ""}${notes ? `\\nNotes: ${notes}` : ""}`,
            });
            icsAttachment = { filename: "shoot.ics", content: Buffer.from(ics).toString("base64"), contentType: 'text/calendar; method=PUBLISH; name="shoot.ics"' };
          } catch (e) { console.error("[email] assignment ICS build failed:", e?.message); }

          const row = (label, val) => val ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;width:36%">${label}</td><td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:500">${val}</td></tr>` : "";

          await new Resend(resendKey).emails.send({
            from, to: [newPhotographerEmail],
            subject: `Shoot assigned to you — ${address}`,
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
              <h2 style="color:${primary};font-family:Georgia,serif;margin:0 0 12px">Shoot Assigned</h2>
              <p style="color:#555;margin:0 0 20px">Hi ${update.photographerName || "there"}, here's everything you'll need for this shoot:</p>
              <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                ${row("Property", address)}
                ${row("Date", dateLabel)}
                ${row("Time", timeLabel ? `${timeLabel}${duration ? ` · ${duration} min` : ""}` : (duration ? `${duration} min` : ""))}
                ${twilight ? row("Twilight", time12(twilight)) : ""}
                ${row("Services", svcTxt)}
                ${row("Property type", propType ? `${propType}${sqft ? ` · ${Number(sqft).toLocaleString()} sqft` : ""}` : "")}
                ${row("Client", `${clientName}${clientPhone ? ` · ${clientPhone}` : ""}`)}
                ${row("Client email", clientEmail)}
              </table>
              ${notes ? `<div style="background:#f9f9f7;border-left:3px solid ${primary};padding:12px 16px;margin-bottom:20px"><p style="color:#555;font-size:13px;margin:0;font-style:italic">"${notes}"</p></div>` : ""}
              <a href="${shootUrl}" style="display:inline-block;background:${primary};color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:600;font-size:14px">View full shoot details →</a>
              <p style="color:#888;font-size:12px;margin-top:16px">The attached calendar invite will add this shoot to your calendar.</p>
              <p style="color:#ccc;font-size:11px">${bizName}</p>
            </div>`,
            ...(icsAttachment ? { attachments: [icsAttachment] } : {}),
          }).then(() => console.log("[email] photographer assignment sent to", newPhotographerEmail))
            .catch((e) => console.error("[email] photographer assignment FAILED to", newPhotographerEmail, ":", e?.message));
        }
      } catch (e) {
        console.error("[email] photographer assignment error (non-fatal):", e?.message);
      }
    }
  }

  // Send a booking-update email to the client when the editor requested it.
  if (body.sendNotification === true) {
    const resendKey = process.env.RESEND_API_KEY;
    const clientEmail = update.clientEmail || prev.clientEmail;
    if (resendKey && clientEmail) {
      try {
        const tenant = await getTenantById(ctx.tenantId);
        if (tenant) {
          const bizName   = tenant.branding?.businessName || tenant.businessName || "KyoriaOS";
          const primary   = tenant.branding?.primaryColor || "#3486cf";
          const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com";
          const from      = `${bizName} <${fromEmail}>`;
          const address   = update.fullAddress || prev.fullAddress || prev.address || "your property";
          const clientName = (update.clientName || prev.clientName || "").split(" ")[0] || "there";
          const shootDate = update.shootDate ?? prev.shootDate;
          const shootTime = update.shootTime ?? prev.shootTime;
          const shootInfo = shootDate
            ? `${new Date(shootDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${shootTime ? ` at ${shootTime}` : ""}`
            : null;
          await new Resend(resendKey).emails.send({
            from, to: [clientEmail],
            subject: `Your booking was updated — ${address}`,
            html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
              <h2 style="color:${primary};font-family:Georgia,serif;margin:0 0 12px">Booking Updated</h2>
              <p style="color:#555;margin:0 0 20px">Hi ${clientName}, your booking details for <strong>${address}</strong> have been updated.</p>
              <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                <tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px;width:36%">Property</td>
                    <td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:500">${address}</td></tr>
                ${shootInfo ? `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;color:#888;font-size:13px">Scheduled</td>
                    <td style="padding:8px 0;border-bottom:1px solid #eee;font-weight:500">${shootInfo}</td></tr>` : ""}
              </table>
              <p style="color:#888;font-size:12px;margin:0">Questions? Just reply to this email.</p>
              <p style="color:#ccc;font-size:11px;margin-top:8px">${bizName}</p>
            </div>`,
          }).then(() => console.log("[email] client booking-update sent to", clientEmail))
            .catch((e) => console.error("[email] client booking-update FAILED:", e?.message));
        }
      } catch (e) {
        console.error("[email] client booking-update error (non-fatal):", e?.message);
      }
    }
  }

  return Response.json({ ok: true });
}
