import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { pushBookingToGcal } from "@/lib/pushGcal";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, role: decoded.role || "owner" };
  } catch { return null; }
}

// POST — re-push every UPCOMING booking that already has a Google Calendar
// event, so their times are corrected to the property's timezone. Owner/admin
// only. Idempotent: push updates the existing event in place (gcalEventId).
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!["owner", "admin"].includes(ctx.role)) {
    return Response.json({ error: "Only an owner or admin can re-sync the calendar." }, { status: 403 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const snap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings")
    .where("shootDate", ">=", today)
    .get();

  let resynced = 0, skipped = 0, failed = 0;
  const failures = [];
  // Only touch bookings that were actually pushed to a calendar.
  const targets = snap.docs.filter((d) => d.data().gcalEventId);

  for (const d of targets) {
    try {
      const r = await pushBookingToGcal(ctx.tenantId, d.id);
      if (r.ok) resynced++;
      else if (r.skipped) skipped++;
      else { failed++; failures.push({ id: d.id, reason: r.reason }); }
    } catch (e) {
      failed++; failures.push({ id: d.id, reason: e?.message || "error" });
    }
  }

  return Response.json({
    ok: true,
    considered: targets.length,
    resynced, skipped, failed,
    failures: failures.slice(0, 20),
  });
}
