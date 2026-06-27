import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, role: decoded.role || "member" };
  } catch { return null; }
}

const ALLOWED_TYPES = ["packages", "services", "addons"];

// POST — bulk-set assigned photographers across many products at once.
// Body: { type, itemIds?: string[] (omit/empty = all of that type),
//         photographerIds: string[], mode: "set" | "add" | "remove" }
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return Response.json({ error: "Insufficient permissions to manage products" }, { status: 403 });
  }

  const { type, itemIds, photographerIds, mode = "set" } = await req.json();
  if (!ALLOWED_TYPES.includes(type)) return Response.json({ error: "Invalid type" }, { status: 400 });
  const photogIds = Array.isArray(photographerIds) ? [...new Set(photographerIds.map(String))] : [];

  const col = adminDb.collection("tenants").doc(ctx.tenantId).collection(type);
  const snap = await col.get();
  const targetIds = Array.isArray(itemIds) && itemIds.length ? new Set(itemIds.map(String)) : null;

  const batch = adminDb.batch();
  let updated = 0;
  snap.docs.forEach((doc) => {
    if (targetIds && !targetIds.has(doc.id)) return;
    const current = Array.isArray(doc.data().assignedPhotographers) ? doc.data().assignedPhotographers.map(String) : [];
    let next;
    if (mode === "add")        next = [...new Set([...current, ...photogIds])];
    else if (mode === "remove") next = current.filter((id) => !photogIds.includes(id));
    else                        next = photogIds; // "set" (replace)
    batch.update(doc.ref, { assignedPhotographers: next });
    updated += 1;
  });

  await batch.commit();
  return Response.json({ ok: true, updated });
}
