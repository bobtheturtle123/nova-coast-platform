import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  enabled: process.env.NODE_ENV === "production",

  // Sample 5% of frontend performance — cheap visibility on real user sessions
  tracesSampleRate: 0.05,

  // Replay 1% of sessions, 10% of sessions with errors
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.1,

  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || "development",

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],
});
