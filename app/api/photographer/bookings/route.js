import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (decoded.role !== "photographer" || !decoded.tenantId || !decoded.memberId) return null;
    return { uid: decoded.uid, tenantId: decoded.tenantId, memberId: decoded.memberId };
  } catch { return null; }
}

function sanitize(val) {
  if (val === null || val === undefined) return val;
  if (val?.toDate) return val.toDate().toISOString();
  if (Array.isArray(val)) return val.map(sanitize);
  if (typeof val === "object") {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = sanitize(v);
    return out;
  }
  return val;
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Verify the memberId actually belongs to this tenant (defence against spoofed claims)
  const memberDoc = await adminDb.collection("tenants").doc(ctx.tenantId).collection("team").doc(ctx.memberId).get();
  if (!memberDoc.exists) return Response.json({ error: "Unauthorized" }, { status: 403 });
  const memberEmail = memberDoc.data().email || "";

  // Query bookings assigned to this photographer
  const snap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings")
    .where("photographerId", "==", ctx.memberId)
    .get();

  // Also grab by email match for legacy bookings assigned by email
  const emailSnap = memberEmail
    ? await adminDb
        .collection("tenants").doc(ctx.tenantId)
        .collection("bookings")
        .where("photographerEmail", "==", memberEmail)
        .get()
    : { docs: [] };

  const seen = new Set();
  const bookings = [];
  for (const doc of [...snap.docs, ...emailSnap.docs]) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    const raw = sanitize(doc.data());
    // Expose only what a photographer needs — never client-facing pricing
    bookings.push({
      id:            doc.id,
      status:        raw.status,
      shootDate:     raw.shootDate,
      preferredDate: raw.preferredDate,
      preferredTime: raw.preferredTime,
      address:       raw.address,
      fullAddress:   raw.fullAddress,
      city:          raw.city,
      state:         raw.state,
      clientName:    raw.clientName,
      clientPhone:   raw.clientPhone,
      serviceIds:    raw.serviceIds,
      packageId:     raw.packageId,
      addonIds:      raw.addonIds,
      notes:         raw.notes,
      payRate:       raw.photographerPayRate ?? null,
      createdAt:     raw.createdAt,
    });
  }

  // Sort by shootDate desc (upcoming first)
  bookings.sort((a, b) => {
    const da = a.shootDate || a.preferredDate || "";
    const db_ = b.shootDate || b.preferredDate || "";
    return db_.localeCompare(da);
  });

  return Response.json({ bookings });
}
