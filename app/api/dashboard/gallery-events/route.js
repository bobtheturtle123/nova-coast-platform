import { adminDb } from "@/lib/firebase-admin";

export async function POST(req) {
  const body = await req.json();
  const {
    tenantId,
    galleryId,
    bookingId,
    event,
    mediaKey,
    userAgent,
  } = body;

  if (!tenantId || !galleryId || !bookingId || !event) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const validEvents = ["view", "download", "share", "media_click"];
  if (!validEvents.includes(event)) {
    return Response.json({ error: "Invalid event type" }, { status: 400 });
  }

  const docData = {
    tenantId,
    galleryId,
    bookingId,
    event,
    createdAt: new Date(),
  };

  if (mediaKey !== undefined) docData.mediaKey = mediaKey;
  if (userAgent !== undefined) docData.userAgent = userAgent;

  await adminDb.collection(`tenants/${tenantId}/galleryEvents`).add(docData);

  return Response.json({ ok: true });
}
