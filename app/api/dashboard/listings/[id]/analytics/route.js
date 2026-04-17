import { adminAuth, adminDb } from "@/lib/firebase-admin";

// GET /api/dashboard/listings/[id]/analytics
// Returns view count + all property inquiries for a listing
export async function GET(req, { params }) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const [bookingDoc, inquiriesSnap] = await Promise.all([
      adminDb
        .collection("tenants").doc(decoded.tenantId)
        .collection("bookings").doc(params.id)
        .get(),
      adminDb
        .collection("tenants").doc(decoded.tenantId)
        .collection("propertyInquiries")
        .where("bookingId", "==", params.id)
        .orderBy("createdAt", "desc")
        .limit(100)
        .get(),
    ]);

    if (!bookingDoc.exists) return Response.json({ error: "Not found" }, { status: 404 });

    const pw = bookingDoc.data().propertyWebsite || {};

    const inquiries = inquiriesSnap.docs.map((d) => {
      const data = d.data();
      return {
        id:        d.id,
        name:      data.name,
        email:     data.email,
        phone:     data.phone  || "",
        message:   data.message,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        read:      data.read,
      };
    });

    return Response.json({
      views:       pw.viewCount    || 0,
      lastViewedAt: pw.lastViewedAt?.toDate?.()?.toISOString() || null,
      inquiries,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
