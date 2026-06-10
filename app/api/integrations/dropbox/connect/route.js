import { adminAuth } from "@/lib/firebase-admin";
import { isConfigured, buildAuthUrl, signState } from "@/lib/dropbox";

export const dynamic = "force-dynamic";

// Returns the Dropbox OAuth URL for the current tenant. The client redirects to
// it. Tenant identity is carried in a signed `state` (CSRF-safe), so the
// callback can trust which tenant to attach the tokens to.
export async function GET(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let decoded;
  try { decoded = await adminAuth.verifyIdToken(auth); } catch { return Response.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Only owners/admins may connect integrations.
  if (decoded.role !== "owner" && decoded.role !== "admin") {
    return Response.json({ error: "Only an owner or admin can manage integrations." }, { status: 403 });
  }
  if (!isConfigured()) {
    return Response.json({ error: "Dropbox is not configured on the server." }, { status: 500 });
  }

  const state = signState({ tenantId: decoded.tenantId, uid: decoded.uid });
  return Response.json({ url: buildAuthUrl(state) });
}
