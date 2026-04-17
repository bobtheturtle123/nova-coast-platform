import { adminDb } from "@/lib/firebase-admin";
import { exchangeCode } from "@/lib/quickbooks";

// GET /api/dashboard/quickbooks/callback
// QuickBooks redirects here after user grants access.
// `state` carries the tenantId we set in getAuthUrl().
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code     = searchParams.get("code");
  const realmId  = searchParams.get("realmId");
  const state    = searchParams.get("state"); // tenantId
  const error    = searchParams.get("error");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  if (error || !code || !realmId || !state) {
    return Response.redirect(`${appUrl}/dashboard/settings?qb=error#settings-integrations`);
  }

  try {
    const tokens = await exchangeCode(code, realmId);
    await adminDb.collection("tenants").doc(state).update({
      quickbooks: {
        accessToken:  tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt:    tokens.expiresAt,
        realmId,
        connectedAt:  new Date(),
      },
    });
    return Response.redirect(`${appUrl}/dashboard/settings?qb=connected#settings-integrations`);
  } catch (err) {
    console.error("[QB callback] Error:", err);
    return Response.redirect(`${appUrl}/dashboard/settings?qb=error#settings-integrations`);
  }
}
