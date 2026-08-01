import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { getThumbnail } from "@/lib/dropbox";

export const dynamic = "force-dynamic";

// Serves a small JPEG thumbnail of a Dropbox image for the import picker.
// The token is passed as a query param because <img src> can't send an
// Authorization header; it's a short-lived Firebase ID token over HTTPS.
async function canUseDropbox(decoded) {
  if (decoded.role === "owner" || decoded.role === "admin") return true;
  const teamRef = adminDb.collection("tenants").doc(decoded.tenantId).collection("team");
  let member = null;
  if (decoded.memberId) { const d = await teamRef.doc(decoded.memberId).get(); if (d.exists) member = d.data(); }
  if (!member && decoded.uid)   { const s = await teamRef.where("uid", "==", decoded.uid).limit(1).get(); if (!s.empty) member = s.docs[0].data(); }
  if (!member && decoded.email) { const s = await teamRef.where("email", "==", String(decoded.email).toLowerCase()).limit(1).get(); if (!s.empty) member = s.docs[0].data(); }
  return !!member?.permissions?.canImportDropbox;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const path  = searchParams.get("path");
  if (!token || !path) return new Response("", { status: 400 });

  let decoded;
  try { decoded = await adminAuth.verifyIdToken(token); } catch { return new Response("", { status: 401 }); }
  if (!decoded.tenantId) return new Response("", { status: 401 });
  if (!(await canUseDropbox(decoded))) return new Response("", { status: 403 });

  try {
    const buf = await getThumbnail(decoded.tenantId, path);
    return new Response(buf, {
      status: 200,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    // Not thumbnail-able (unsupported type, etc.) — 404 so the <img> falls back.
    return new Response("", { status: 404 });
  }
}
