import { adminDb, adminAuth } from "@/lib/firebase-admin";

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
      address, city = "", state = "CA", zip = "",
      preferredDate = "", preferredTime = "",
      notes = "", totalPrice = 0, depositPaid = false,
      status = "confirmed", source = "manual",
    } = await req.json();

    if (!clientName || !clientEmail || !address) {
      return Response.json({ error: "clientName, clientEmail, and address are required." }, { status: 400 });
    }

    const bookingId  = adminDb.collection("tmp").doc().id; // generate ID
    const tenantRef  = adminDb.collection("tenants").doc(ctx.tenantId);
    const bookingRef = tenantRef.collection("bookings").doc(bookingId);

    const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");

    await bookingRef.set({
      id: bookingId,
      tenantId: ctx.tenantId,
      clientName,
      clientEmail,
      clientPhone,
      address,
      city,
      state,
      zip,
      fullAddress,
      preferredDate,
      preferredTime,
      notes,
      totalPrice:    Number(totalPrice) || 0,
      depositPaid:   Boolean(depositPaid),
      balancePaid:   false,
      paidInFull:    false,
      remainingBalance: Number(totalPrice) || 0,
      status,
      source,
      createdAt:     new Date(),
      createdBy:     ctx.uid,
      // No Stripe payment intent — manually created booking
      stripePaymentIntentId: null,
      galleryId: null,
    });

    // Upsert agent/customer record
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
          totalSpent: Number(totalPrice) || 0,
          lastOrderAt: new Date(),
          createdAt: new Date(),
        });
      } else {
        const prev = agentSnap.data();
        await agentRef.update({
          totalOrders: (prev.totalOrders || 0) + 1,
          totalSpent:  (prev.totalSpent  || 0) + (Number(totalPrice) || 0),
          lastOrderAt: new Date(),
          name: clientName,
          phone: clientPhone || prev.phone,
        });
      }
    }

    return Response.json({ bookingId, ok: true });
  } catch (err) {
    console.error("Admin booking create error:", err);
    return Response.json({ error: "Failed to create booking." }, { status: 500 });
  }
}
