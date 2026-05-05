/**
 * Returns the canonical production URL — always app.kyoriaos.com in production.
 * Only falls back to localhost in local development.
 */
export function getAppUrl() {
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  return "https://app.kyoriaos.com";
}
