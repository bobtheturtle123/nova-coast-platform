import { adminAuth } from "@/lib/firebase-admin";
import { testCredentials, saveCredentials } from "@/lib/cubicasa";

export const dynamic = "force-dynamic";

// POST { email, apiKey } — validate then securely store per-tenant CubiCasa creds.
export async function POST(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (decoded.role !== "owner" && decoded.role !== "admin") {
    return Response.json({ error: "Only an owner or admin can manage integrations." }, { status: 403 });
  }

  const { email, apiKey } = await req.json().catch(() => ({}));
  if (!email || !apiKey) return Response.json({ error: "Account email and API key are required." }, { status: 400 });

  const probe = await testCredentials(email, apiKey);
  if (!probe.ok) return Response.json({ error: probe.error }, { status: 400 });

  await saveCredentials(decoded.tenantId, email, apiKey, probe);
  return Response.json({ ok: true, email: email.trim() });
}
