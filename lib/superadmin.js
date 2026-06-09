import { adminAuth, adminDb } from "@/lib/firebase-admin";

// UID allowlist from env: SUPERADMIN_UIDS=uid1,uid2
// When set, BOTH the role claim AND the UID must match — claim alone is not enough.
// This means a leaked/forged claim still can't pass if the UID doesn't match the list.
function getAllowedUids() {
  const raw = process.env.SUPERADMIN_UIDS || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export async function isSuperAdmin(req) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return false;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.role !== "superadmin") return false;
    const uids = getAllowedUids();
    if (uids.length > 0 && !uids.includes(decoded.uid)) return false;
    return true;
  } catch { return false; }
}

// Returns decoded token or null. Use when you need the UID after auth.
export async function getSuperAdminCtx(req) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.role !== "superadmin") return null;
    const uids = getAllowedUids();
    if (uids.length > 0 && !uids.includes(decoded.uid)) return null;
    return decoded;
  } catch { return null; }
}

// Superadmin + a CURRENT 2-step verification session. Use this to protect any
// route that exposes tenant/user data. Returns false unless the superadmin has
// completed the email one-time-code step within the validity window.
export async function isSuperAdminVerified(req) {
  const ctx = await getSuperAdminCtx(req);
  if (!ctx) return false;
  try {
    const snap = await adminDb.collection("superadminMfa").doc(ctx.uid).get();
    const until = snap.data()?.verifiedUntil;
    const ms = until?.toMillis ? until.toMillis() : (until ? new Date(until).getTime() : 0);
    return ms > Date.now();
  } catch { return false; }
}
