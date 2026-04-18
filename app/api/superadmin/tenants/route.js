import { adminDb, adminAuth } from "@/lib/firebase-admin";

function getSuperAdminUids() {
  const raw = process.env.SUPERADMIN_UIDS || "";
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

async function isSuperAdmin(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return false;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (decoded.role !== "superadmin") return false;
    const allowlist = getSuperAdminUids();
    if (allowlist.length > 0 && !allowlist.includes(decoded.uid)) return false;
    return true;
  } catch { return false; }
}

export async function GET(req) {
  if (!await isSuperAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb.collection("tenants").orderBy("createdAt", "desc").get();

  // Return only fields needed for the admin panel — never return stripe keys, OAuth tokens, etc.
  const tenants = snap.docs.map((d) => {
    const t = d.data();
    return {
      id:                 d.id,
      businessName:       t.businessName,
      email:              t.email,
      slug:               t.slug,
      subscriptionStatus: t.subscriptionStatus,
      subscriptionPlan:   t.subscriptionPlan,
      createdAt:          t.createdAt?.toDate?.()?.toISOString?.() ?? null,
    };
  });

  return Response.json({ tenants });
}
