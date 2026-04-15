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
      photographerEmail = "", photographerName = "",
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
      photographerEmail: photographerEmail || null,
      photographerName:  photographerName  || null,
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
    try {
      const [tenant, adminRecord] = await Promise.all([
        getTenantById(ctx.tenantId),
        adminAuth.getUser(ctx.uid),
      ]);
      if (tenant) {
        await sendBookingCreatedNotifications({
          booking:    { ...bookingData },
          tenant,
          adminEmail: adminRecord.email || tenant.email || null,
        });
      }
    } catch (emailErr) {
      console.error("Notification email error (non-fatal):", emailErr);
    }

    return Response.json({ bookingId, ok: true });
  } catch (err) {
    console.error("Admin booking create error:", err);
    return Response.json({ error: "Failed to create booking." }, { status: 500 });
  }
}
