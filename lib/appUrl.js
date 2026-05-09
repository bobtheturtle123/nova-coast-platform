/**
 * Returns the canonical app base URL.
 *
 * Priority:
 *   1. NEXT_PUBLIC_APP_URL env var — set this in Vercel to https://app.kyoriaos.com
 *   2. Hardcoded production fallback — catches any Vercel deployment (preview or prod)
 *      that doesn't have the env var set
 *   3. localhost for local development
 *
 * NEVER use window.location.origin, VERCEL_URL, or request headers to generate
 * customer-facing links. Always call getAppUrl() instead.
 */
export function getAppUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;

  // Use explicit override when it looks like a real HTTPS URL (not the localhost placeholder)
  if (explicit && explicit.startsWith("https://")) {
    return explicit.replace(/\/$/, "");
  }

  // All Vercel deployments (production AND preview) get the canonical production domain.
  // This ensures preview URLs never leak into customer-facing emails, QR codes, or links.
  if (process.env.NODE_ENV === "production") {
    return "https://app.kyoriaos.com";
  }

  // Local development
  return "http://localhost:3000";
}

// Alias for clarity in client components
export const getPublicAppUrl = getAppUrl;
