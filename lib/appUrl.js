/**
 * Returns the canonical app URL for use in emails and absolute links.
 *
 * Priority:
 *  1. NEXT_PUBLIC_APP_URL — explicitly set (skip if it contains "localhost")
 *  2. VERCEL_PROJECT_PRODUCTION_URL — Vercel system var, always the production URL
 *  3. VERCEL_URL — current deployment URL (may be a preview URL, but better than nothing)
 *  4. http://localhost:3000 — local dev
 */
export function getAppUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && !explicit.includes("localhost")) return explicit.replace(/\/$/, "");

  const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prodUrl) return `https://${prodUrl}`;

  const deployUrl = process.env.VERCEL_URL;
  if (deployUrl) return `https://${deployUrl}`;

  return "http://localhost:3000";
}
