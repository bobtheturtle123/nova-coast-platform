import { adminAuth } from "@/lib/firebase-admin";
import { listFolder } from "@/lib/dropbox";

export const dynamic = "force-dynamic";

// Browse the connected tenant's Dropbox. ?path="" is the root.
export async function GET(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path") || "";

  try {
    const { entries } = await listFolder(decoded.tenantId, path);
    // Folders first, then files; both alphabetical.
    entries.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : (a.type === "folder" ? -1 : 1));
    return Response.json({ path, entries });
  } catch (e) {
    if (e.reconnect) return Response.json({ error: "Dropbox needs to be reconnected.", reconnect: true }, { status: 409 });
    console.error("[dropbox/list]", e?.message);
    return Response.json({ error: "Could not load Dropbox files." }, { status: 502 });
  }
}
