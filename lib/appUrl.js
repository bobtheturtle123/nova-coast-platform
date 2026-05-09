/**
 * Returns the canonical app base URL.
 *
 * Production is ALWAYS https://app.kyoriaos.com — hardcoded, never derived
 * from environment variables, request headers, or window.location.
 *
 * This means preview deployments (kyoriaos-xxxxx.vercel.app) also generate
 * app.kyoriaos.com links, which is intentional: customer-facing links must
 * always point to the stable production domain, regardless of which Vercel
 * deployment served the admin request.
 *
 * To change the production domain, edit the string below and redeploy.
 *
 * NEVER use window.location.origin, VERCEL_URL, NEXT_PUBLIC_APP_URL,
 * or request headers to generate customer-facing links.
 */
export function getAppUrl() {
  if (process.env.NODE_ENV === "production") {
    return "https://app.kyoriaos.com";
  }
  return "http://localhost:3000";
}

export const getPublicAppUrl = getAppUrl;
