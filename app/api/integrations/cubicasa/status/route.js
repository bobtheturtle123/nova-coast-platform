import { adminAuth } from "@/lib/firebase-admin";
import { getStatus } from "@/lib/cubicasa";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  return Response.json(await getStatus(decoded.tenantId));
}
