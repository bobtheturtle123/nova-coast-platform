import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { listFolder } from "@/lib/dropbox";

export const dynamic = "force-dynamic";

// Whether this user may use the studio's Dropbox. Owner/admin always can; other
// roles require the explicit canImportDropbox permission (off by default).
async function canUseDropbox(decoded) {
  if (decoded.role === "owner" || decoded.role === "admin") return true;
  const teamRef = adminDb.collection("tenants").doc(decoded.tenantId).collection("team");
  let member = null;
  if (decoded.memberId) { const d = await teamRef.doc(decoded.memberId).get(); if (d.exists) member = d.data(); }
  if (!member && decoded.uid)   { const s = await teamRef.where("uid", "==", decoded.uid).limit(1).get(); if (!s.empty) member = s.docs[0].data(); }
  if (!member && decoded.email) { const s = await teamRef.where("email", "==", String(decoded.email).toLowerCase()).limit(1).get(); if (!s.empty) member = s.docs[0].data(); }
  return !!member?.permissions?.canImportDropbox;
}

// Optional restriction: tenant can limit Dropbox usage to a single root folder.
async function getDropboxRoot(tenantId) {
  try {
    const doc = await adminDb.collection("tenants").doc(tenantId).get();
    const p = doc.data()?.integrations?.dropbox?.rootPath || doc.data()?.dropboxRootPath || "";
    return typeof p === "string" ? p.replace(/\/+$/, "") : "";
  } catch { return ""; }
}

// True if `path` is inside the configured root (or no root is set).
function withinRoot(path, root) {
  if (!root) return true;
  return path === root || path.startsWith(root + "/");
}

// Browse the connected tenant's Dropbox. ?path="" is the root.
export async function GET(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await canUseDropbox(decoded))) {
    return Response.json({ error: "You don't have permission to import from Dropbox. Ask an owner to enable it." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const root = await getDropboxRoot(decoded.tenantId);
  let path = searchParams.get("path") || "";
  // Confine browsing to the configured root folder, if any.
  if (root && !withinRoot(path, root)) path = root;
  if (root && !path) path = root;

  try {
    const { entries } = await listFolder(decoded.tenantId, path);
    // Folders first, then files; both alphabetical.
    entries.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : (a.type === "folder" ? -1 : 1));
    return Response.json({ path, entries, root });
  } catch (e) {
    if (e.reconnect) return Response.json({ error: "Dropbox needs to be reconnected.", reconnect: true }, { status: 409 });
    console.error("[dropbox/list]", e?.message);
    return Response.json({ error: "Could not load Dropbox files." }, { status: 502 });
  }
}
