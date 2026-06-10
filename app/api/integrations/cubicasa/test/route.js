import { adminAuth } from "@/lib/firebase-admin";
import { verifyStored } from "@/lib/cubicasa";

export const dynamic = "force-dynamic";

// POST — re-test the saved CubiCasa credentials.
export async function POST(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const probe = await verifyStored(decoded.tenantId);
  if (!probe.ok) return Response.json({ ok: false, error: probe.error }, { status: 400 });
  return Response.json({ ok: true });
}
