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

function serialize(data) {
  const out = { ...data };
  for (const key of Object.keys(out)) {
    if (out[key]?.toDate) out[key] = out[key].toDate().toISOString();
    else if (out[key]?.seconds) out[key] = new Date(out[key].seconds * 1000).toISOString();
  }
  return out;
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("agents")
    .orderBy("totalOrders", "desc")
    .get();

  const agents = snap.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));
  return Response.json({ agents });
}

// Lookup by email — used by booking form autocomplete
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { email } = await req.json();
  if (!email) return Response.json({ agent: null });

  const agentId = Buffer.from(email.toLowerCase()).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
  const doc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("agents").doc(agentId)
    .get();

  return Response.json({ agent: doc.exists ? serialize(doc.data()) : null });
}
