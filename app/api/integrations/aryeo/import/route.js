import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getKey, fetchCategories, fetchProducts, mapProductsToServices } from "@/lib/aryeo";

export const dynamic     = "force-dynamic";
export const maxDuration = 60;

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, role: decoded.role || "member" };
  } catch { return null; }
}

const norm = (s) => String(s || "").trim().toLowerCase();
const externalIdFor = (it) => it.aryeoVariantId ? `${it.aryeoProductId}:${it.aryeoVariantId}` : String(it.aryeoProductId);

// Build a lookup of existing services so we can flag duplicates (by name) and
// already-imported items (by Aryeo external_id).
async function loadExisting(tenantRef) {
  const byName = {};          // normalized name -> { id, type }
  const byExternalId = {};    // aryeo external_id -> { id }
  for (const type of ["services", "packages", "addons"]) {
    const snap = await tenantRef.collection(type).get();
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.name) byName[norm(data.name)] = { id: d.id, type };
      if (data.external_source === "aryeo" && data.external_id) byExternalId[data.external_id] = { id: d.id, type };
    });
  }
  return { byName, byExternalId };
}

export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return Response.json({ error: "Only an owner or admin can import." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "commit" ? "commit" : "preview";

  const apiKey = await getKey(ctx.tenantId);
  if (!apiKey) return Response.json({ error: "Connect your Aryeo API key first." }, { status: 400 });

  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);

  // ── PREVIEW ────────────────────────────────────────────────────────────────
  if (mode === "preview") {
    let categories = [], products = [];
    try {
      categories = await fetchCategories(apiKey).catch(() => []);
      products   = await fetchProducts(apiKey);
    } catch (e) {
      return Response.json({ error: "Couldn't fetch from Aryeo. Re-check your API key and try again." }, { status: 502 });
    }

    const mapped = mapProductsToServices(products, categories);
    const { byName, byExternalId } = await loadExisting(tenantRef);

    const items = mapped.map((it) => {
      const externalId = externalIdFor(it);
      const already    = byExternalId[externalId];          // previously imported from Aryeo
      const nameMatch  = byName[norm(it.name)];             // same-named existing product
      const dupe       = already || nameMatch || null;
      return {
        ...it,
        externalId,
        key: externalId,
        duplicate: !!dupe,
        existingId: dupe?.id || null,
        existingType: dupe?.type || null,
        // Default action: skip duplicates, import everything else as new.
        action: dupe ? "skip" : "new",
      };
    });

    return Response.json({
      preview: true,
      categories: categories.map((c) => c.title || c.name).filter(Boolean),
      items,
      counts: {
        products: products.length,
        services: items.length,
        duplicates: items.filter((i) => i.duplicate).length,
      },
      // Diagnostic: the raw shape of the first product (and a category) so the
      // exact image/price/category fields can be mapped if anything looks off.
      sampleProduct: products[0] || null,
      sampleCategory: categories[0] || null,
    });
  }

  // ── COMMIT ───────────────────────────────────────────────────────────────────
  const incoming = Array.isArray(body.items) ? body.items : [];
  if (incoming.length === 0) return Response.json({ error: "Nothing selected to import." }, { status: 400 });

  const batch = adminDb.batch();
  const result = { imported: 0, updated: 0, skipped: 0, errors: 0 };
  const now = new Date();

  for (const it of incoming) {
    try {
      const action = it.action === "update" ? "update" : it.action === "skip" ? "skip" : "new";
      if (action === "skip") { result.skipped++; continue; }

      const externalId = it.externalId || externalIdFor(it);
      const hasTiers = it.priceTiers && typeof it.priceTiers === "object" && Object.keys(it.priceTiers).length > 0;
      const chosenType = ["packages", "services", "addons"].includes(it.type) ? it.type : "services";
      const base = {
        name:           String(it.name || "Untitled").slice(0, 100),
        description:    String(it.description || "").slice(0, 500),
        price:          hasTiers ? 0 : (Number(it.price) || 0),
        ...(hasTiers ? { priceTiers: it.priceTiers } : {}),
        ...(Number(it.duration) ? { duration: Number(it.duration) } : {}),
        ...(it.category ? { tagline: String(it.category).slice(0, 200) } : {}),
        ...(it.imageUrl ? { thumbnailUrl: String(it.imageUrl), mediaUrls: [String(it.imageUrl)] } : {}),
        // Provenance + draft flags (NEVER auto-published).
        external_source: "aryeo",
        external_id:     externalId,
        aryeoProductId:  it.aryeoProductId || null,
        aryeoVariantId:  it.aryeoVariantId || null,
        imported_at:     now,
        importedAt:      now,
        import_status:   "imported",
        is_draft:        true,
      };

      if (action === "update" && it.existingId) {
        // Only updates the specific item the user chose — never bulk-overwrites.
        const coll = ["addons", "packages", "services"].includes(it.existingType) ? it.existingType : "services";
        batch.set(tenantRef.collection(coll).doc(it.existingId), base, { merge: true });
        result.updated++;
      } else {
        const ref = tenantRef.collection(chosenType).doc();
        batch.set(ref, { id: ref.id, type: chosenType, active: false, createdAt: now, ...base });
        result.imported++;
      }
    } catch {
      result.errors++;
    }
  }

  await batch.commit();
  return Response.json({ ok: true, ...result });
}
