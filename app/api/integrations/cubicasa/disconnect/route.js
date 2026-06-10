import { adminAuth } from "@/lib/firebase-admin";
import { disconnect } from "@/lib/cubicasa";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (decoded.role !== "owner" && decoded.role !== "admin") {
    return Response.json({ error: "Only an owner or admin can manage integrations." }, { status: 403 });
  }

  await disconnect(decoded.tenantId);
  return Response.json({ ok: true });
}
