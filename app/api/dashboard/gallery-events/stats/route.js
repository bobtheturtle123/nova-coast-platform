import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId } = ctx;
  const { searchParams } = new URL(req.url);
  const bookingId = searchParams.get("bookingId");

  if (!bookingId) {
    return Response.json({ error: "Missing bookingId" }, { status: 400 });
  }

  const snapshot = await adminDb
    .collection(`tenants/${tenantId}/galleryEvents`)
    .where("bookingId", "==", bookingId)
    .get();

  let views = 0;
  let downloads = 0;
  let shares = 0;
  const mediaClicks = {};

  snapshot.forEach((doc) => {
    const data = doc.data();
    switch (data.event) {
      case "view":
        views++;
        break;
      case "download":
        downloads++;
        break;
      case "share":
        shares++;
        break;
      case "media_click":
        if (data.mediaKey) {
          mediaClicks[data.mediaKey] = (mediaClicks[data.mediaKey] || 0) + 1;
        }
        break;
    }
  });

  const topMedia = Object.entries(mediaClicks)
    .map(([key, clicks]) => ({ key, clicks }))
    .sort((a, b) => b.clicks - a.clicks);

  return Response.json({ views, downloads, shares, mediaClicks, topMedia });
}
