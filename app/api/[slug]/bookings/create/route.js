import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug, getTenantCatalog } from "@/lib/tenants";
import { calculateTenantPrice } from "@/lib/catalogUtils";
import { createConnectedPaymentIntent } from "@/lib/stripe";
import { sendBookingConfirmation } from "@/lib/email";
import { v4 as uuidv4 } from "uuid";
import { rateLimit } from "@/lib/rateLimit";

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

    const body = await req.json();
    const {
      packageId, serviceIds, addonIds,
      address, city, state, zip, squareFootage, propertyType, notes,
      preferredDate, preferredTime, preferredTimeSpecific,
      clientName, clientEmail, clientPhone,
      travelFee, tipAmount: rawTip, payFull, customFields,
    } = body;

    if (!clientName || !clientEmail || !clientPhone) {
      return Response.json({ error: "Missing client information" }, { status: 400 });
    }

    // Re-calculate server-side to prevent tampering (pass squareFootage for tier pricing)
    const catalog = await getTenantCatalog(tenant.id);
    const pricing = calculateTenantPrice(packageId, serviceIds, addonIds, travelFee || 0, catalog, squareFootage || 0);
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
    let paymentIntent;
    if (tenant.stripeConnectAccountId && tenant.stripeConnectOnboarded) {
      paymentIntent = await createConnectedPaymentIntent({
        amountCents:        chargeCents,
        connectedAccountId: tenant.stripeConnectAccountId,
        metadata: { bookingId, type: paymentType, tenantId: tenant.id, clientName, clientEmail },
        description: `${tenant.businessName} ${paymentType === "full" ? "full payment" : "deposit"} — ${address}, ${city}`,
        receiptEmail: clientEmail,
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
        address, city, state, zip, fullAddress,
        squareFootage: squareFootage ? Number(squareFootage) : null,
        propertyType:  propertyType || "residential",
        notes:         notes || "",

        packageId:  packageId || null,
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
        customFields:          customFields || {},
        photographerId:        null,
        shootDate:             null,
        galleryId:             null,
        galleryUnlocked:       false,
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
