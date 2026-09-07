const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Legacy /legal/* policy URLs -> canonical short paths. Done here (not via a
  // page-level permanentRedirect) because Next's App Router redirect() gets
  // cached by Vercel as an HTML body with NO Location header, which crawlers
  // cannot reliably follow. next.config redirects emit true edge 308s.
  async redirects() {
    return [
      { source: "/legal/privacy",     destination: "/privacy",     permanent: true },
      { source: "/legal/terms",       destination: "/terms",       permanent: true },
      { source: "/legal/cookies",     destination: "/cookies",     permanent: true },
      { source: "/legal/sms-consent", destination: "/sms-consent", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.cloudflare.com",
      },
    ],
  },
  experimental: {
    // Required to use Firebase Admin in API routes (Next.js 14)
    serverComponentsExternalPackages: ["firebase-admin", "sharp", "fluent-ffmpeg", "ffmpeg-static"],
  },
};

module.exports = withSentryConfig(nextConfig, {
  // Sentry organization + project (set in Vercel env vars)
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only upload source maps in CI/Vercel — not local builds
  silent: !process.env.CI,

  // Disable Sentry build-time features if DSN is not configured
  // This allows local dev builds to succeed without Sentry credentials
  disableServerWebpackPlugin:  !process.env.SENTRY_DSN,
  disableClientWebpackPlugin:  !process.env.SENTRY_DSN,

  // Don't hide source maps from Sentry but don't break the build without them
  widenClientFileUpload: true,
});
