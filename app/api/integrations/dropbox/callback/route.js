import { verifyState, exchangeCodeAndStore, clientDebug } from "@/lib/dropbox";
import { getAppUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

// Dropbox redirects here after the user authorizes. We verify the signed state
// (CSRF), exchange the code for tokens, store them encrypted for the tenant, and
// bounce back to Settings → Integrations.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const settings = `${getAppUrl()}/dashboard/settings`;

  const error = searchParams.get("error");
  if (error) return Response.redirect(`${settings}?dropbox=error`, 302);

  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return Response.redirect(`${settings}?dropbox=error`, 302);

  const parsed = verifyState(state);
  if (!parsed?.tenantId) return Response.redirect(`${settings}?dropbox=invalid_state`, 302);

  try {
    await exchangeCodeAndStore(parsed.tenantId, code);
    return Response.redirect(`${settings}?dropbox=connected`, 302);
  } catch (e) {
    console.error("[dropbox/callback]", e?.message);
    const dbg = clientDebug();
    const msg = `${e?.message || ""} [keyLen:${dbg.idLen} secretLen:${dbg.secretLen} redirect:${dbg.redirectUri}]`;
    const reason = encodeURIComponent(msg.replace(/\s+/g, " ").slice(0, 400));
    return Response.redirect(`${settings}?dropbox=error&reason=${reason}`, 302);
  }
}
