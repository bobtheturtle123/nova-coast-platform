import { verifyState, exchangeCodeAndStore, clientDebug } from "@/lib/dropbox";

export const dynamic = "force-dynamic";

// Dropbox redirects here after the user authorizes. We verify the signed state
// (CSRF), exchange the code for tokens, store them encrypted for the tenant, and
// bounce back to Settings → Integrations.
export async function GET(req) {
  const url = new URL(req.url);
  const { searchParams } = url;
  // Return to the SAME origin that handled this callback, so the user's logged-in
  // session (which is per-origin) is preserved and they aren't bounced to login.
  const settings = `${url.origin}/dashboard/settings`;

  const error = searchParams.get("error");
  if (error) return Response.redirect(`${settings}?dropbox=error`, 302);

  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return Response.redirect(`${settings}?dropbox=error`, 302);

  const parsed = verifyState(state);
  if (!parsed?.tenantId) return Response.redirect(`${settings}?dropbox=invalid_state`, 302);

  try {
    await exchangeCodeAndStore(parsed.tenantId, code);
    // When connected from the in-gallery popup, don't dump the user on Settings —
    // show a simple confirmation and close the popup (the opener auto-refreshes).
    if (parsed.source === "popup") return closeTabPage();
    return Response.redirect(`${settings}?dropbox=connected`, 302);
  } catch (e) {
    console.error("[dropbox/callback]", e?.message);
    const dbg = clientDebug();
    const msg = `${e?.message || ""} [keyLen:${dbg.idLen} secretLen:${dbg.secretLen} redirect:${dbg.redirectUri}]`;
    const reason = encodeURIComponent(msg.replace(/\s+/g, " ").slice(0, 400));
    return Response.redirect(`${settings}?dropbox=error&reason=${reason}`, 302);
  }
}

// Minimal confirmation page for the popup flow: tells the user they can close
// the tab, notifies the opener, and tries to auto-close.
function closeTabPage() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Dropbox connected</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;background:#f8fafc;color:#0F172A}
.card{text-align:center;padding:32px 40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:360px}
.check{width:48px;height:48px;border-radius:50%;background:#16a34a;color:#fff;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 14px}
h1{font-size:18px;margin:0 0 6px}p{font-size:14px;color:#64748b;margin:0}</style></head>
<body><div class="card"><div class="check">&#10003;</div>
<h1>Dropbox connected</h1><p>You can close this tab and return to your gallery.</p></div>
<script>try{window.opener&&window.opener.postMessage({type:"dropbox-connected"},"*")}catch(e){}
setTimeout(function(){try{window.close()}catch(e){}},1200);</script></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
