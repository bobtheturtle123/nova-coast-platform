import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

async function getTenantId(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const decoded = await adminAuth.verifyIdToken(auth);
  return decoded.tenantId || null;
}

// GET — list promo codes
export async function GET(req) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const snap = await adminDb
      .collection("tenants").doc(tenantId)
      .collection("promoCodes")
      .orderBy("createdAt", "desc")
      .get();

    const codes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return Response.json({ codes });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST — create promo code
export async function POST(req) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { code, type, value, usageLimit = 0, active = true, expiresAt = null, description = "" } = body;

    if (!code?.trim())         return Response.json({ error: "Code is required" }, { status: 400 });
    if (!["flat", "percent"].includes(type)) return Response.json({ error: "Type must be flat or percent" }, { status: 400 });
    if (!value || Number(value) <= 0) return Response.json({ error: "Value must be > 0" }, { status: 400 });
    if (type === "percent" && Number(value) > 100) return Response.json({ error: "Percent cannot exceed 100" }, { status: 400 });

    const normalized = code.trim().toUpperCase();

    // Check for duplicates
    const existing = await adminDb
      .collection("tenants").doc(tenantId)
      .collection("promoCodes")
      .where("code", "==", normalized)
      .limit(1)
      .get();
    if (!existing.empty) return Response.json({ error: "Code already exists" }, { status: 409 });

    const ref = await adminDb
      .collection("tenants").doc(tenantId)
      .collection("promoCodes")
      .add({
        code:        normalized,
        type,
        value:       Number(value),
        usageLimit:  Number(usageLimit) || 0,
        usageCount:  0,
        active,
        description: description.trim(),
        expiresAt:   expiresAt || null,
        createdAt:   FieldValue.serverTimestamp(),
      });

    return Response.json({ id: ref.id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
