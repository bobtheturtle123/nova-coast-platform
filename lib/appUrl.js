/**
 * Returns the canonical production URL — always app.kyoriaos.com in production.
 * Works in both server and client contexts. Never uses runtime origin/host.
 * Use this for every public, shareable, or customer-facing link.
 */
export function getAppUrl() {
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  return "https://app.kyoriaos.com";
}

// Alias for clarity in client components
export const getPublicAppUrl = getAppUrl;
