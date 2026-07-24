import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug, getTenantCatalog } from "@/lib/tenants";
import { calculateTenantPrice, getSqftTier, clampMoney } from "@/lib/catalogUtils";
import { createConnectedPaymentIntent, paymentDescription } from "@/lib/stripe";
import { sendBookingConfirmation } from "@/lib/email";
import { v4 as uuidv4 } from "uuid";
import { rateLimit } from "@/lib/rateLimit";
import { getListingLimit, getEffectivePlan } from "@/lib/plans";
import { resolvePartnerDiscount, partnerDiscountAmount } from "@/lib/partnerDiscount";

export async function POST(req, { params }) {
  // 5 booking attempts per IP per hour
  const rl = await rateLimit(req, `booking-create:${params.slug}`, 5, 3600);
  if (rl.limited) {
    return Response.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ error: "Business not found" }, { status: 404 });

    // Check subscription allows new bookings
    if (tenant.subscriptionStatus === "canceled") {
      return Response.json({ error: "This booking page is currently unavailable." }, { status: 403 });
    }

    // Enforce plan listing limit — silently soft-block at plan cap
    const listingLimit = getListingLimit(
      getEffectivePlan(tenant),
      tenant.addonListings || 0
    );
    // Count only completed bookings (not abandoned pending_payment or cancelled)
    const statusCountPromises = ["requested", "confirmed", "completed", "in_progress", "editing", "delivered"].map((s) =>
      adminDb.collection("tenants").doc(tenant.id).collection("bookings")
        .where("status", "==", s).count().get()
    );
    const statusCounts = await Promise.all(statusCountPromises);
    const activeSnap = { data: () => ({ count: statusCounts.reduce((sum, s) => sum + (s.data().count || 0), 0) }) };
    if ((activeSnap.data().count || 0) >= listingLimit) {
      return Response.json({ error: "This booking page is temporarily unavailable." }, { status: 503 });
    }

    const body = await req.json();
    const {
      packageIds: rawPkgIds, packageId: rawPkgId, serviceIds, addonIds, retainerIds,
      address, city, state, zip, squareFootage, propertyType, notes,
      preferredDate, preferredTime, preferredTimeSpecific, twilightTime,
      clientName, clientEmail, clientPhone, smsConsent,
      travelFee, tipAmount: rawTip, payFull, customFields,
      photographerId: preferredPhotographerId,
      contractSignerName,
      unit, promoCode: rawPromoCode, promoId: rawPromoId,
    } = body;

    // Normalize: accept either packageIds array or legacy packageId string
    const packageIds = Array.isArray(rawPkgIds) && rawPkgIds.length > 0
      ? rawPkgIds
      : (rawPkgId ? [rawPkgId] : []);
    const packageId = packageIds[0] ?? null; // backward-compat field

    if (!clientName || !clientEmail) {
      return Response.json({ error: "Missing client information" }, { status: 400 });
    }

    // Enforce the optional maximum-size cap server-side (defense in depth).
    const cap = tenant.pricingConfig?.cap;
    if (cap?.enabled && Number(cap.max) > 0 && Number(squareFootage) > Number(cap.max)) {
      return Response.json({ error: `Online bookings above ${Number(cap.max).toLocaleString()} are not available. Please contact us for a custom quote.` }, { status: 400 });
    }

    // Re-calculate server-side to prevent tampering (pass squareFootage for tier pricing).
    // Clamp client-supplied money — negative/NaN values must never lower the price.
    const safeTravelFee = clampMoney(travelFee);
    const catalog = await getTenantCatalog(tenant.id);
    const pricing = calculateTenantPrice(packageIds, serviceIds, addonIds, safeTravelFee, catalog, squareFootage || 0);
    const tip = clampMoney(rawTip);

    // ── Re-validate promo code server-side (never trust client discount) ──────
    let promoDiscount = 0;
    let appliedPromo  = null; // { id, code }
    if (rawPromoCode || rawPromoId) {
      try {
        const normalized = String(rawPromoCode || "").trim().toUpperCase();
        const snap = rawPromoId
          ? await adminDb.collection("tenants").doc(tenant.id).collection("promoCodes").doc(rawPromoId).get().then((d) => d.exists ? [{ id: d.id, data: () => d.data() }] : [])
          : (await adminDb.collection("tenants").doc(tenant.id).collection("promoCodes").where("code", "==", normalized).limit(1).get()).docs;
        const doc = snap[0];
        if (doc) {
          const promo = doc.data();
          const expired = promo.expiresAt && (() => { const e = new Date(promo.expiresAt?.toDate?.() || promo.expiresAt); return isNaN(e) || e < new Date(); })();
          const limitHit = promo.usageLimit > 0 && (promo.usageCount || 0) >= promo.usageLimit;
          const belowMin = promo.minOrder > 0 && pricing.subtotal < promo.minOrder;
          if (promo.active && !expired && !limitHit && !belowMin) {
            promoDiscount = promo.type === "flat"
              ? Math.min(promo.value, pricing.subtotal)
              : Math.round((pricing.subtotal * promo.value) / 100 * 100) / 100;
            appliedPromo = { id: doc.id, code: promo.code };
          }
        }
      } catch (e) { console.error("[booking/create] promo validation failed:", e?.message); }
    }

    // ── Partner pricing ───────────────────────────────────────────────────────
    // Resolved from the booking email, never from the client payload. Partner
    // pricing and a promo code do NOT stack — the better of the two wins.
    const partner = await resolvePartnerDiscount(tenant.id, clientEmail);
    const partnerDiscount = partnerDiscountAmount(partner, pricing.subtotal);
    let appliedPartner = null;
    if (partnerDiscount > promoDiscount) {
      appliedPartner = { percent: partner.percent, label: partner.label, sourceAgentId: partner.sourceAgentId };
      promoDiscount = 0;
      appliedPromo  = null;
    }
    const totalDiscount = Math.max(promoDiscount, partnerDiscount);

    // Apply discount to the total. Deposit can't exceed the discounted total.
    const effectiveTotal = Math.max(0, pricing.subtotal - totalDiscount);
    const effDeposit     = Math.min(pricing.deposit || 0, effectiveTotal);

    // Determine payment type and amount.
    //  - Deposit type "none" = pay in full at booking.
    //  - A deposit that works out to $0 (e.g. 0% deposit) is NOT pay-in-full:
    //    it collects nothing now and the full balance is due later. Using
    //    effDeposit === 0 here was the bug that marked $0 bookings "paid in full".
    const depositType   = tenant.bookingConfig?.deposit?.type;
    const isFullPayment = payFull || depositType === "none";
    const chargeAmount  = isFullPayment
      ? effectiveTotal + tip
      : effDeposit + tip;
    const paymentType   = isFullPayment ? "full" : "deposit";

    // Stripe's minimum charge is $0.50. When the amount due now is below that —
    // e.g. a promo makes the booking free, or the total is a few cents — we
    // can't create a payment intent. Treat it as a no-charge booking so the
    // agent can still complete it instead of hitting "Invalid pricing data".
    const STRIPE_MIN = 0.5;
    const isFreeBooking = chargeAmount < STRIPE_MIN;

    const bookingId    = uuidv4();
    const chargeCents  = Math.round(chargeAmount * 100);
    const fullAddress  = `${address}, ${city}, ${state} ${zip}`;

    // Create payment intent — ALWAYS routed to the tenant's verified Connect
    // account. There is no platform-account fallback: if the tenant can't
    // safely receive funds, the payment fails closed (free bookings collect
    // no money, so they proceed without a payment intent).
    const tenantPlanId = getEffectivePlan(tenant);

    let paymentIntent = null;
    if (!isFreeBooking) {
      let connectedAccountId;
      try {
        const { requireTenantPaymentAccount } = await import("@/lib/connect");
        connectedAccountId = await requireTenantPaymentAccount(tenant);
      } catch (e) {
        console.error(`[booking/create] payment blocked — tenant=${tenant.id} reason=${e?.reason || e?.message}`);
        const { customerPaymentBlockedResponse } = await import("@/lib/connect");
        return customerPaymentBlockedResponse();
      }
      paymentIntent = await createConnectedPaymentIntent({
        amountCents:        chargeCents,
        connectedAccountId,
        metadata: { bookingId, type: paymentType, tenantId: tenant.id, clientName, clientEmail },
        description: paymentDescription(paymentType === "full" ? "full" : "deposit", {
          businessName: tenant.businessName,
          address: [address, city].filter(Boolean).join(", "),
        }),
        receiptEmail: clientEmail,
        planId:  tenantPlanId,
        idempotencyKey: `book_${bookingId}_${paymentType}_${chargeCents}`,
      });
    }

    // For a free booking, the amount due now is considered paid (nothing owed).
    // If the full total is also ~free, the whole booking is paid in full.
    const fullyFree = isFreeBooking && (isFullPayment || effectiveTotal < STRIPE_MIN);
    const remainingBalance = isFullPayment
      ? 0
      : (isFreeBooking ? Math.max(0, effectiveTotal - effDeposit) : Math.max(0, effectiveTotal - effDeposit));

    // Resolve suggested photographer pay from product pay rates
    const sqftTier = getSqftTier(squareFootage || 0, catalog.pricingConfig);
    function getItemPayRate(item) {
      if (!item) return null;
      if (item.payRateTiers && sqftTier && item.payRateTiers[sqftTier] != null) return item.payRateTiers[sqftTier];
      if (item.payRate != null) return item.payRate;
      return null;
    }
    let suggestedShooterPay = null;
    if (packageIds.length > 0) {
      const total = packageIds.reduce((sum, pid) => {
        const pkg = (catalog.packages || []).find((p) => p.id === pid);
        const r = getItemPayRate(pkg);
        return sum + (r != null ? r : 0);
      }, 0);
      if (total > 0) suggestedShooterPay = total;
    } else if ((serviceIds || []).length > 0) {
      const total = (serviceIds || []).reduce((sum, sid) => {
        const svc = (catalog.services || []).find((s) => s.id === sid);
        const r = getItemPayRate(svc);
        return sum + (r != null ? r : 0);
      }, 0);
      if (total > 0) suggestedShooterPay = total;
    }

    // Save booking to tenant subcollection
    await adminDb
      .collection("tenants")
      .doc(tenant.id)
      .collection("bookings")
      .doc(bookingId)
      .set({
        id:            bookingId,
        tenantId:      tenant.id,
        // Free bookings skip payment entirely → go straight to "requested".
        status:        isFreeBooking ? "requested" : "pending_payment",
        createdAt:     new Date(),

        clientName, clientEmail, clientPhone,
        smsConsent:    !!smsConsent,
        smsConsentAt:  smsConsent ? new Date() : null,
        address, unit: unit || null, city, state, zip, fullAddress,
        squareFootage: squareFootage ? Number(squareFootage) : null,
        propertyType:  propertyType || "residential",
        notes:         notes || "",

        packageId:  packageId  || null,
        packageIds: packageIds || [],
        serviceIds: serviceIds || [],
        addonIds:   addonIds  || [],
        retainerIds: Array.isArray(retainerIds) ? retainerIds.slice(0, 20) : [],

        basePrice:        pricing.base,
        addonPrice:       pricing.addonTotal,
        travelFee:        safeTravelFee,
        tipAmount:        tip,
        // Discounted figures — promo is applied to the price actually charged.
        promoCode:        appliedPromo?.code || null,
        promoId:          appliedPromo?.id   || null,
        promoDiscount,
        // Partner pricing (mutually exclusive with a promo — best one wins).
        partnerDiscount:        appliedPartner ? partnerDiscount : 0,
        partnerDiscountPercent: appliedPartner?.percent || null,
        partnerDiscountLabel:   appliedPartner?.label   || null,
        partnerAgentId:         appliedPartner?.sourceAgentId || null,
        totalPrice:       effectiveTotal,
        depositAmount:    isFullPayment ? effectiveTotal : effDeposit,
        remainingBalance,
        // Free bookings have nothing to collect now → mark the due portion paid.
        depositPaid:      isFreeBooking,
        balancePaid:      isFreeBooking ? fullyFree : false, // else set true by webhook
        paidInFull:       isFreeBooking ? fullyFree : false, // else set true by webhook
        isFreeBooking,

        stripePaymentIntentId: paymentIntent?.id || null,

        preferredDate:         preferredDate || null,
        preferredTime:         preferredTime || "morning",
        preferredTimeSpecific: preferredTimeSpecific || null,
        twilightTime:          twilightTime  || null,
        customFields:          customFields  || {},
        photographerId:        preferredPhotographerId || null,
        suggestedShooterPay:   suggestedShooterPay,
        shootDate:             null,
        galleryId:             null,
        galleryUnlocked:       false,

        // Service agreement
        contractSigned:            !!contractSignerName,
        contractSignerName:        contractSignerName || null,
        contractSignedAt:          contractSignerName ? new Date() : null,
        contractSignerIp:          contractSignerName ? (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null) : null,
        contractText:              contractSignerName ? (catalog.bookingConfig?.serviceAgreement?.text || null) : null,
        contractCounterSigned:     !!contractSignerName,
        contractCounterSignedAt:   contractSignerName ? new Date() : null,
        contractCounterSignedBy:   contractSignerName ? (tenant.businessName || "Business") : null,
      });

    // Increment promo usage now that the booking exists (only if a valid promo applied).
    if (appliedPromo?.id) {
      adminDb.collection("tenants").doc(tenant.id).collection("promoCodes").doc(appliedPromo.id)
        .update({ usageCount: (await import("firebase-admin/firestore")).FieldValue.increment(1) })
        .catch((e) => console.error("[booking/create] promo usage increment failed:", e?.message));
    }

    // Upsert agent record (keyed by email so repeat clients accumulate history)
    const agentId = Buffer.from(clientEmail.toLowerCase()).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
    const agentRef = adminDb.collection("tenants").doc(tenant.id).collection("agents").doc(agentId);
    const agentDoc = await agentRef.get();
    if (agentDoc.exists) {
      await agentRef.update({
        totalOrders: (agentDoc.data().totalOrders || 0) + 1,
        totalSpent:  (agentDoc.data().totalSpent  || 0) + pricing.subtotal,
        lastOrderAt: new Date(),
        // Update name/phone if changed
        name:  clientName,
        phone: clientPhone,
      });
    } else {
      await agentRef.set({
        id:          agentId,
        name:        clientName,
        email:       clientEmail,
        phone:       clientPhone,
        totalOrders: 1,
        totalSpent:  pricing.subtotal,
        firstOrderAt: new Date(),
        lastOrderAt:  new Date(),
      });
    }

    // Fire Zapier webhook (fire-and-forget).
    (async () => {
      try {
        const { dispatchZapier, bookingWebhookData } = await import("@/lib/zapier");
        await dispatchZapier(tenant, "booking.created", bookingWebhookData({
          id: bookingId, clientName, clientEmail, clientPhone,
          fullAddress, status: isFreeBooking ? "requested" : "pending_payment",
          totalPrice: effectiveTotal, depositPaid: isFreeBooking, paidInFull: fullyFree,
          remainingBalance, shootDate: null, preferredDate, preferredTime,
        }));
      } catch {}
    })();

    return Response.json({
      bookingId,
      clientSecret: paymentIntent?.client_secret || null,
      free: isFreeBooking,
    });
  } catch (err) {
    console.error("Create booking error:", err);
    return Response.json({ error: "Failed to create booking. Please try again." }, { status: 500 });
  }
}
