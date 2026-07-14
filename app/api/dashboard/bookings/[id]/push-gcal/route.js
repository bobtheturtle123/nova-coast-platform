import { adminAuth } from "@/lib/firebase-admin";
import { pushBookingToGcal } from "@/lib/pushGcal";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST — push this booking as an event to the assigned photographer's Google
// Calendar, anchored to the PROPERTY's timezone.
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let result;
  try {
    result = await pushBookingToGcal(ctx.tenantId, params.id);
  } catch (e) {
    return Response.json({ error: e?.message || "Google Calendar push failed" }, { status: 502 });
  }

  if (!result.ok) {
    // "skipped" conditions (no photographer / not connected) are expected —
    // 400 with the reason; hard failures are 502.
    return Response.json({ error: result.reason }, { status: result.skipped ? 400 : 502 });
  }
  return Response.json({ ok: true, eventId: result.eventId, eventLink: result.eventLink, timeZone: result.timeZone });
}
