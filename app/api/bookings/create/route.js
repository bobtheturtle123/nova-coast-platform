import { adminDb } from "@/lib/firebase-admin";
import { stripe } from "@/lib/stripe";
import { sendBookingConfirmation } from "@/lib/email";
import { v4 as uuidv4 } from "uuid";

export async function POST(req) {
  try {
    const body = await req.json();

    const {
      packageId, serviceIds, addonIds,
      address, city, state, zip,
      squareFootage, propertyType, notes,
      preferredDate, preferredTime,
      clientName, clientEmail, clientPhone,
      travelFee, pricing,
    } = body;

    // ── Validate ───────────────────────────────────────────────────────────
    if (!clientName || !clientEmail || !clientPhone) {
      return Response.json({ error: "Missing client information" }, { status: 400 });
    }
    if (!pricing?.deposit) {
      return Response.json({ error: "Invalid pricing data" }, { status: 400 });
    }

    const bookingId = uuidv4();

    // ── Create Stripe Payment Intent ───────────────────────────────────────
    const depositCents = Math.round(pricing.deposit * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount:   depositCents,
      currency: "usd",
      metadata: {
        bookingId,
        type:         "deposit",
        clientName,
        clientEmail,
        address:      `${address}, ${city}, ${state} ${zip}`,
      },
      description: `Nova Coast Media deposit — ${address}, ${city}`,
      receipt_email: clientEmail,
    });

    // ── Save booking to Firestore ──────────────────────────────────────────
    const fullAddress = `${address}, ${city}, ${state} ${zip}`;

    await adminDb.collection("bookings").doc(bookingId).set({
      id:            bookingId,
      status:        "pending_payment",
      createdAt:     new Date(),

      // Client
      clientName,
      clientEmail,
      clientPhone,

      // Property
      address,
      city,
      state,
      zip,
      fullAddress,
      squareFootage: squareFootage ? Number(squareFootage) : null,
      propertyType:  propertyType || "residential",
      notes:         notes || "",

      // Services
      packageId:  packageId || null,
      serviceIds: serviceIds || [],
      addonIds:   addonIds  || [],

      // Pricing
      basePrice:        pricing.base,
      addonPrice:       pricing.addonTotal,
      travelFee:        travelFee || 0,
      totalPrice:       pricing.subtotal,
      depositAmount:    pricing.deposit,
      remainingBalance: pricing.balance,
      depositPaid:      false,
      balancePaid:      false,

      // Stripe
      stripePaymentIntentId: paymentIntent.id,

      // Schedule
      preferredDate: preferredDate || null,
      preferredTime: preferredTime || "morning",
      photographerId: null,
      shootDate:      null,

      // Gallery
      galleryId:      null,
      galleryUnlocked: false,
    });

    return Response.json({
      bookingId,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error("Create booking error:", err);
    return Response.json(
      { error: "Failed to create booking. Please try again." },
      { status: 500 }
    );
  }
}
