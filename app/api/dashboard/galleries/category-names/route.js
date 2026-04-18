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

// GET — returns a deduplicated list of all category names used across galleries
export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("galleries")
    .select("categories")
    .limit(100)
    .get();

  const nameSet = new Set();
  snap.docs.forEach((doc) => {
    const cats = doc.data().categories;
    if (cats && typeof cats === "object") {
      Object.keys(cats).forEach((name) => name && nameSet.add(name));
    }
  });

  return Response.json({ names: [...nameSet].sort() });
}
