import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function isSuperAdmin(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return false;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    return decoded.role === "superadmin";
  } catch { return false; }
}

export async function GET(req) {
  if (!await isSuperAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snap    = await adminDb.collection("tenants").orderBy("createdAt", "desc").get();
  const tenants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return Response.json({ tenants });
}
