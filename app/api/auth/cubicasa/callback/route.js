import { adminDb } from "@/lib/firebase-admin";

const CLOSE_HTML = (msg, isError = false) => `<!DOCTYPE html>
<html>
<head><title>CubiCasa ${isError ? "Error" : "Connected"}</title></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb">
  <div style="text-align:center;padding:2rem;max-width:360px">
    ${isError
      ? `<p style="font-size:2rem">⚠️</p><h2 style="color:#dc2626">Connection failed</h2><p style="color:#6b7280;font-size:.9rem">${msg}</p>`
      : `<p style="font-size:2rem">✅</p><h2 style="color:#3486cf">CubiCasa connected!</h2><p style="color:#6b7280;font-size:.9rem">You can close this window.</p>`
    }
  </div>
  <script>
    ${isError
      ? `if (window.opener) window.opener.postMessage({ type: "cubicasa-error", error: ${JSON.stringify(msg)} }, "*");`
      : `if (window.opener) window.opener.postMessage({ type: "cubicasa-connected" }, "*");`
    }
    setTimeout(() => window.close(), 1500);
  </script>
</body>
</html>`;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return new Response(CLOSE_HTML(`CubiCasa returned: ${error}`, true), {
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!code || !state) {
    return new Response(CLOSE_HTML("Missing code or state parameter.", true), {
      headers: { "Content-Type": "text/html" },
    });
  }

  // Decode state
  let tenantId;
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    tenantId = decoded.tenantId;
    if (!tenantId) throw new Error("No tenantId in state");
    // Reject stale states (>10 min)
    if (Date.now() - decoded.ts > 10 * 60 * 1000) throw new Error("State expired");
  } catch (e) {
    return new Response(CLOSE_HTML(`Invalid state: ${e.message}`, true), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const clientId     = process.env.CUBICASA_CLIENT_ID;
  const clientSecret = process.env.CUBICASA_CLIENT_SECRET;
  const appUrl       = process.env.NEXT_PUBLIC_APP_URL || "https://app.kyoriaos.com";
  const redirectUri  = `${appUrl}/api/auth/cubicasa/callback`;

  // Exchange code for access token
  try {
    const tokenRes = await fetch("https://app.cubicasa.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  redirectUri,
        client_id:     clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text().catch(() => "");
      return new Response(CLOSE_HTML(`Token exchange failed (${tokenRes.status}): ${text.slice(0, 200)}`, true), {
        headers: { "Content-Type": "text/html" },
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken  = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn    = tokenData.expires_in    || 3600;

    // Persist to tenant Firestore document
    await adminDb.collection("tenants").doc(tenantId).update({
      cubiCasaToken: {
        accessToken,
        refreshToken,
        expiresAt: Date.now() + expiresIn * 1000,
        connectedAt: Date.now(),
      },
    });

    return new Response(CLOSE_HTML(""), { headers: { "Content-Type": "text/html" } });
  } catch (e) {
    return new Response(CLOSE_HTML(e.message, true), { headers: { "Content-Type": "text/html" } });
  }
}
