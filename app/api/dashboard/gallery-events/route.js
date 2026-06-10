import { adminDb } from "@/lib/firebase-admin";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// Public analytics beacon for client gallery events. Hardened: the caller must
// prove it holds the gallery's access token, the gallery must belong to the
// claimed tenant, and writes are rate-limited per IP to prevent spam/pollution.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { tenantId, galleryId, bookingId, event, mediaKey, userAgent, accessToken } = body;

  if (!tenantId || !galleryId || !bookingId || !event || !accessToken) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const validEvents = ["view", "download", "share", "media_click"];
  if (!validEvents.includes(event)) {
    return Response.json({ error: "Invalid event type" }, { status: 400 });
  }

  const rl = await rateLimit(req, `gallery-events:${galleryId}`, 120, 3600);
  if (rl.limited) return Response.json({ error: "Too many events" }, { status: 429 });

  // Verify the gallery exists under this tenant and the access token matches —
  // this proves the caller actually has access to the gallery being logged.
  const galSnap = await adminDb
    .collection("tenants").doc(String(tenantId))
    .collection("galleries").doc(String(galleryId))
    .get();
  if (!galSnap.exists || galSnap.data().accessToken !== accessToken) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const docData = { tenantId, galleryId, bookingId, event, createdAt: new Date() };
  if (typeof mediaKey === "string")  docData.mediaKey  = mediaKey.slice(0, 300);
  if (typeof userAgent === "string") docData.userAgent = userAgent.slice(0, 400);

  await adminDb.collection(`tenants/${tenantId}/galleryEvents`).add(docData);
  return Response.json({ ok: true });
}
