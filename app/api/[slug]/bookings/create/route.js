import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug, getTenantCatalog } from "@/lib/tenants";
import { calculateTenantPrice, getSqftTier } from "@/lib/catalogUtils";
import { createConnectedPaymentIntent } from "@/lib/stripe";
import { sendBookingConfirmation } from "@/lib/email";
import { v4 as uuidv4 } from "uuid";
import { rateLimit } from "@/lib/rateLimit";
import { getListingLimit, getEffectivePlan } from "@/lib/plans";

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
    const activeSnap = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("bookings")
      .where("status", "!=", "cancelled")
      .count()
      .get();
    if ((activeSnap.data().count || 0) >= listingLimit) {
      return Response.json({ error: "This booking page is temporarily unavailable." }, { status: 503 });
    }

    const body = await req.json();
    const {
      packageIds: rawPkgIds, packageId: rawPkgId, serviceIds, addonIds,
      address, city, state, zip, squareFootage, propertyType, notes,
      preferredDate, preferredTime, preferredTimeSpecific, twilightTime,
      clientName, clientEmail, clientPhone, smsConsent,
      travelFee, tipAmount: rawTip, payFull, customFields,
      photographerId: preferredPhotographerId,
      contractSignerName,
    } = body;

    // Normalize: accept either packageIds array or legacy packageId string
    const packageIds = Array.isArray(rawPkgIds) && rawPkgIds.length > 0
      ? rawPkgIds
      : (rawPkgId ? [rawPkgId] : []);
    const packageId = packageIds[0] ?? null; // backward-compat field

    if (!clientName || !clientEmail || !clientPhone) {
      return Response.json({ error: "Missing client information" }, { status: 400 });
    }

    // Re-calculate server-side to prevent tampering (pass squareFootage for tier pricing)
    const catalog = await getTenantCatalog(tenant.id);
    const pricing = calculateTenantPrice(packageIds, serviceIds, addonIds, travelFee || 0, catalog, squareFootage || 0);
    const tip = Math.max(0, Number(rawTip) || 0);

    // Determine payment type and amount
    const isFullPayment = payFull || pricing.deposit === 0;
    const chargeAmount  = isFullPayment
      ? pricing.subtotal + tip
      : pricing.deposit + tip;
    const paymentType   = isFullPayment ? "full" : "deposit";

    if (chargeAmount <= 0) {
      return Response.json({ error: "Invalid pricing data" }, { status: 400 });
    }

    const bookingId    = uuidv4();
    const chargeCents  = Math.round(chargeAmount * 100);
    const fullAddress  = `${address}, ${city}, ${state} ${zip}`;

    // Create payment intent — routed to tenant's Connect account (if onboarded)
    const tenantPlanId = getEffectivePlan(tenant);

    let paymentIntent;
    if (tenant.stripeConnectAccountId && tenant.stripeConnectOnboarded) {
      paymentIntent = await createConnectedPaymentIntent({
        amountCents:        chargeCents,
        connectedAccountId: tenant.stripeConnectAccountId,
        metadata: { bookingId, type: paymentType, tenantId: tenant.id, clientName, clientEmail },
        description: `${tenant.businessName} ${paymentType === "full" ? "full payment" : "deposit"} — ${address}, ${city}`,
        receiptEmail: clientEmail,
        planId:  tenantPlanId,
      });
    } else {
      const { stripe } = await import("@/lib/stripe");
      paymentIntent = await stripe.paymentIntents.create({
        amount:   chargeCents,
        currency: "usd",
        metadata: { bookingId, type: paymentType, tenantId: tenant.id, clientName, clientEmail },
        description: `${tenant.businessName} ${paymentType === "full" ? "full payment" : "deposit"} — ${address}, ${city}`,
        receipt_email: clientEmail,
      });
    }

    const remainingBalance = isFullPayment ? 0 : pricing.balance;

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
        status:        "pending_payment",
        createdAt:     new Date(),

        clientName, clientEmail, clientPhone,
        smsConsent:    !!smsConsent,
        smsConsentAt:  smsConsent ? new Date() : null,
        address, city, state, zip, fullAddress,
        squareFootage: squareFootage ? Number(squareFootage) : null,
        propertyType:  propertyType || "residential",
        notes:         notes || "",

        packageId:  packageId  || null,
        packageIds: packageIds || [],
        serviceIds: serviceIds || [],
        addonIds:   addonIds  || [],

        basePrice:        pricing.base,
        addonPrice:       pricing.addonTotal,
        travelFee:        travelFee || 0,
        tipAmount:        tip,
        totalPrice:       pricing.subtotal,
        depositAmount:    isFullPayment ? pricing.subtotal : pricing.deposit,
        remainingBalance,
        depositPaid:      false,
        balancePaid:      isFullPayment ? false : false, // set true by webhook
        paidInFull:       false, // set true by webhook

        stripePaymentIntentId: paymentIntent.id,

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

    return Response.json({ bookingId, clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Create booking error:", err);
    return Response.json({ error: "Failed to create booking. Please try again." }, { status: 500 });
  }
}
