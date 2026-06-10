import { verifyState, exchangeCodeAndStore } from "@/lib/vimeo";
import { getAppUrl } from "@/lib/appUrl";

export const dynamic = "force-dynamic";

// Vimeo redirects here after authorization.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const settings = `${getAppUrl()}/dashboard/settings`;

  if (searchParams.get("error")) return Response.redirect(`${settings}?vimeo=error`, 302);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return Response.redirect(`${settings}?vimeo=error`, 302);

  const parsed = verifyState(state);
  if (!parsed?.tenantId) return Response.redirect(`${settings}?vimeo=invalid_state`, 302);

  try {
    await exchangeCodeAndStore(parsed.tenantId, code);
    return Response.redirect(`${settings}?vimeo=connected`, 302);
  } catch (e) {
    console.error("[vimeo/callback]", e?.message);
    const reason = encodeURIComponent((e?.message || "").replace(/\s+/g, " ").slice(0, 300));
    return Response.redirect(`${settings}?vimeo=error&reason=${reason}`, 302);
  }
}
