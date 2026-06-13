import { adminAuth } from "@/lib/firebase-admin";
import { getKey, testKey } from "@/lib/aryeo";

export const dynamic = "force-dynamic";

// GET — test the stored Aryeo connection.
export async function GET(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const key = await getKey(decoded.tenantId);
  if (!key) return Response.json({ ok: false, error: "No Aryeo API key saved yet." }, { status: 400 });

  const probe = await testKey(key);
  if (!probe.ok) return Response.json({ ok: false, error: probe.error }, { status: 400 });
  return Response.json({ ok: true });
}
