import { adminAuth } from "@/lib/firebase-admin";
import { listVideos } from "@/lib/vimeo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// List the connected tenant's Vimeo videos.
export async function GET(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get("page")) || 1;

  try {
    const { videos, hasNext } = await listVideos(decoded.tenantId, page);
    return Response.json({ videos, hasNext });
  } catch (e) {
    if (e.reconnect) return Response.json({ error: "Vimeo needs to be reconnected.", reconnect: true }, { status: 409 });
    console.error("[vimeo/list]", e?.message);
    return Response.json({ error: "Could not load your Vimeo videos." }, { status: 502 });
  }
}
