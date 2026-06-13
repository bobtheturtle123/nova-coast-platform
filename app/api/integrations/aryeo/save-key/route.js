import { adminAuth } from "@/lib/firebase-admin";
import { testKey, saveKey } from "@/lib/aryeo";

export const dynamic = "force-dynamic";

// POST { apiKey } — validate the key against Aryeo, then store it encrypted.
export async function POST(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (decoded.role !== "owner" && decoded.role !== "admin") {
    return Response.json({ error: "Only an owner or admin can manage integrations." }, { status: 403 });
  }

  const { apiKey } = await req.json().catch(() => ({}));
  if (!apiKey || !apiKey.trim()) return Response.json({ error: "Enter your Aryeo API key." }, { status: 400 });

  const probe = await testKey(apiKey.trim());
  if (!probe.ok) return Response.json({ error: probe.error }, { status: 400 });

  await saveKey(decoded.tenantId, apiKey.trim(), probe);
  return Response.json({ ok: true });
}
