import { adminDb, adminAuth } from "@/lib/firebase-admin";

// Returns ONLY the shoots assigned to the signed-in team member — no business,
// revenue, or other clients' data. Used by the photographer/limited portal.
async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const d = await adminAuth.verifyIdToken(auth);
    if (!d.tenantId) return null;
    return { tenantId: d.tenantId, role: d.role || "owner", memberId: d.memberId || null, email: (d.email || "").toLowerCase() };
  } catch { return null; }
}

function toIso(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v.toDate) return v.toDate().toISOString();
  if (v._seconds) return new Date(v._seconds * 1000).toISOString();
  return null;
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const col = adminDb.collection("tenants").doc(ctx.tenantId).collection("bookings");
  const ids = ctx.memberId ? [ctx.memberId] : ["__owner__"];

  // Assigned by member id or email, plus any additional-photographer assignments.
  const seen = new Map();
  async function collect(snap) {
    snap.forEach((doc) => { if (!seen.has(doc.id)) seen.set(doc.id, doc.data()); });
  }
  try {
    for (const id of ids) await collect(await col.where("photographerId", "==", id).get());
    if (ctx.email) await collect(await col.where("photographerEmail", "==", ctx.email).get());
  } catch (e) {
    return Response.json({ error: "Could not load shoots" }, { status: 500 });
  }

  const now = Date.now();
  const shoots = [];
  for (const [id, b] of seen) {
    // Skip cancelled.
    if (b.status === "cancelled") continue;
    const shootIso = toIso(b.shootDate) || toIso(b.preferredDate);
    const when = shootIso ? new Date(shootIso).getTime() : null;
    shoots.push({
      id,
      address:    b.fullAddress || b.address || "Property",
      city:       b.city || "",
      shootDate:  shootIso,
      shootTime:  b.shootTime || b.preferredTime || null,
      duration:   b.shootDuration || null,
      status:     b.workflowStatus || b.status || null,
      twilight:   !!b.twilightTime,
      twilightTime: b.twilightTime || null,
      notes:      b.notes || null,
      _when: when,
    });
  }

  // Upcoming first (chronological), then undated, then past (most recent first).
  const upcoming = shoots.filter((s) => s._when && s._when >= now - 12 * 3600 * 1000).sort((a, b) => a._when - b._when);
  const undated  = shoots.filter((s) => !s._when);
  const past     = shoots.filter((s) => s._when && s._when < now - 12 * 3600 * 1000).sort((a, b) => b._when - a._when);

  const strip = ({ _when, ...rest }) => rest;
  return Response.json({
    upcoming: upcoming.map(strip),
    undated:  undated.map(strip),
    past:     past.slice(0, 20).map(strip),
  });
}
