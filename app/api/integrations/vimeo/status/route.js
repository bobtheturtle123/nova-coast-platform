import { adminAuth } from "@/lib/firebase-admin";
import { getStatus, isConfigured } from "@/lib/vimeo";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getStatus(decoded.tenantId);
  return Response.json({ ...status, configured: isConfigured() });
}
