import { adminAuth } from "@/lib/firebase-admin";
import { listFloorplans } from "@/lib/cubicasa";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET — list completed CubiCasa floor plans if the account's API supports it.
// Honest about non-support: returns { supported:false, message } rather than
// faking data.
export async function GET(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const result = await listFloorplans(decoded.tenantId);
  if (result.notConnected) return Response.json({ error: result.message }, { status: 409 });
  return Response.json(result);
}
