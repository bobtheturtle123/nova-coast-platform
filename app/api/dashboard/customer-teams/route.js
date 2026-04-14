import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

async function getTenantId(req) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  if (!token) return null;
  const decoded = await adminAuth.verifyIdToken(token);
  return decoded.tenantId || null;
}

// GET /api/dashboard/customer-teams — list all teams
export async function GET(req) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const snap = await adminDb
      .collection("tenants").doc(tenantId)
      .collection("customerTeams")
      .orderBy("createdAt", "desc")
      .get();

    const teams = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return Response.json({ teams });
  } catch (err) {
    console.error("GET customer-teams:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/dashboard/customer-teams — create team
export async function POST(req) {
  try {
    const tenantId = await getTenantId(req);
    if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, members = [], notes = "" } = body;
    if (!name?.trim()) return Response.json({ error: "Name is required" }, { status: 400 });

    const ref = await adminDb
      .collection("tenants").doc(tenantId)
      .collection("customerTeams")
      .add({ name: name.trim(), members, notes, createdAt: FieldValue.serverTimestamp() });

    return Response.json({ id: ref.id });
  } catch (err) {
    console.error("POST customer-teams:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
