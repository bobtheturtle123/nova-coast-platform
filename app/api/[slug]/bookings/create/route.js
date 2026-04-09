import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug, calculateTenantPrice, getTenantCatalog } from "@/lib/tenants";
import { createConnectedPaymentIntent } from "@/lib/stripe";
import { sendBookingConfirmation } from "@/lib/email";
import { v4 as uuidv4 } from "uuid";

export async function POST(req, { params }) {
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
      preferredDate, preferredTime,
      clientName, clientEmail, clientPhone,
      travelFee, pricing: clientPricing,
    } = body;

    if (!clientName || !clientEmail || !clientPhone) {
      return Response.json({ error: "Missing client information" }, { status: 400 });
    }

    // Re-calculate server-side to prevent tampering
    const catalog = await getTenantCatalog(tenant.id);
    const pricing = calculateTenantPrice(packageId, serviceIds, addonIds, travelFee || 0, catalog);

    if (!pricing.deposit) {
      return Response.json({ error: "Invalid pricing data" }, { status: 400 });
    }

    const bookingId     = uuidv4();
    const depositCents  = Math.round(pricing.deposit * 100);
    const fullAddress   = `${address}, ${city}, ${state} ${zip}`;

    // Create payment intent — routed to tenant's Connect account (if onboarded)
    let paymentIntent;
    if (tenant.stripeConnectAccountId && tenant.stripeConnectOnboarded) {
      paymentIntent = await createConnectedPaymentIntent({
        amountCents:        depositCents,
        connectedAccountId: tenant.stripeConnectAccountId,
        metadata: { bookingId, type: "deposit", tenantId: tenant.id, clientName, clientEmail },
        description: `${tenant.businessName} deposit — ${address}, ${city}`,
        receiptEmail: clientEmail,
      });
    } else {
      // Fallback: platform collects (Stripe Connect not yet set up)
      const { stripe } = await import("@/lib/stripe");
      paymentIntent = await stripe.paymentIntents.create({
        amount:   depositCents,
        currency: "usd",
        metadata: { bookingId, type: "deposit", tenantId: tenant.id, clientName, clientEmail },
        description: `${tenant.businessName} deposit — ${address}, ${city}`,
        receipt_email: clientEmail,
      });
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
        totalPrice:       pricing.subtotal,
        depositAmount:    pricing.deposit,
        remainingBalance: pricing.balance,
        depositPaid:      false,
        balancePaid:      false,

        stripePaymentIntentId: paymentIntent.id,

        preferredDate: preferredDate || null,
        preferredTime: preferredTime || "morning",
        photographerId: null,
        shootDate:      null,
        galleryId:      null,
        galleryUnlocked: false,
      });

    return Response.json({ bookingId, clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error("Create booking error:", err);
    return Response.json({ error: "Failed to create booking. Please try again." }, { status: 500 });
  }
}
