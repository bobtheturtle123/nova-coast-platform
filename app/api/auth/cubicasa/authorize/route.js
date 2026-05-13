import { adminAuth } from "@/lib/firebase-admin";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const firebaseToken = searchParams.get("token");

  if (!firebaseToken) {
    return new Response("Missing token", { status: 400 });
  }

  let tenantId;
  try {
    const decoded = await adminAuth.verifyIdToken(firebaseToken);
    tenantId = decoded.tenantId;
    if (!tenantId) throw new Error("No tenantId");
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const clientId     = process.env.CUBICASA_CLIENT_ID;
  const appUrl       = process.env.NEXT_PUBLIC_APP_URL || "https://app.kyoriaos.com";
  const redirectUri  = `${appUrl}/api/auth/cubicasa/callback`;

  if (!clientId) {
    return new Response(
      `<html><body style="font-family:sans-serif;padding:2rem">
        <h2>CubiCasa not configured</h2>
        <p>Add <code>CUBICASA_CLIENT_ID</code> and <code>CUBICASA_CLIENT_SECRET</code> to your environment variables.</p>
        <p>Register your app at <a href="https://developers.cubicasa.com" target="_blank">developers.cubicasa.com</a>.</p>
      </body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }

  // Encode tenantId in state (base64) so callback knows which tenant to update
  const state = Buffer.from(JSON.stringify({ tenantId, ts: Date.now() })).toString("base64url");

  const authUrl = new URL("https://app.cubicasa.com/oauth/authorize");
  authUrl.searchParams.set("client_id",     clientId);
  authUrl.searchParams.set("redirect_uri",  redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope",         "orders:read");
  authUrl.searchParams.set("state",         state);

  return Response.redirect(authUrl.toString(), 302);
}
