import { adminDb, adminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, role: decoded.role || "member" };
  } catch { return null; }
}

// One-time cleanup: strip tier-price keys (priceTiers / durationTiers /
// payRateTiers) that don't match the studio's currently-configured tiers. These
// orphan keys — usually left over from imports — make stale "From $X" prices
// linger even after the visible tiers are edited.
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return Response.json({ error: "Only an owner or admin can do this." }, { status: 403 });
  }

  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);
  const tenantDoc = await tenantRef.get();
  const validNames = new Set((tenantDoc.data()?.pricingConfig?.tiers || []).map((t) => t.name));
  if (validNames.size === 0) {
    return Response.json({ ok: true, cleaned: 0, message: "No pricing tiers configured — nothing to clean." });
  }

  const TIER_FIELDS = ["priceTiers", "durationTiers", "payRateTiers"];
  const COLLECTIONS = ["packages", "services", "addons"];

  const prune = (obj) => {
    if (!obj || typeof obj !== "object") return { out: obj, changed: false };
    const out = {};
    let changed = false;
    for (const [k, v] of Object.entries(obj)) {
      if (validNames.has(k)) out[k] = v;
      else changed = true;
    }
    return { out, changed };
  };

  let cleaned = 0;
  const batch = adminDb.batch();

  for (const coll of COLLECTIONS) {
    const snap = await tenantRef.collection(coll).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      const update = {};
      let docChanged = false;
      for (const field of TIER_FIELDS) {
        if (data[field] && typeof data[field] === "object") {
          const { out, changed } = prune(data[field]);
          if (changed) { update[field] = Object.keys(out).length ? out : null; docChanged = true; }
        }
      }
      if (docChanged) { batch.update(doc.ref, update); cleaned++; }
    }
  }

  if (cleaned > 0) await batch.commit();

  return Response.json({
    ok: true,
    cleaned,
    message: cleaned > 0
      ? `Cleaned up stale tier prices on ${cleaned} product${cleaned === 1 ? "" : "s"}.`
      : "All products are already clean — nothing to fix.",
  });
}
