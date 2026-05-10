import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Only enable in production — no noise during local development
  enabled: process.env.NODE_ENV === "production",

  // Capture 10% of traces — enough visibility without high quota spend
  tracesSampleRate: 0.1,

  // Tag every event with deployment environment
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",

  beforeSend(event) {
    // Drop 4xx client errors from Sentry to reduce noise (auth failures, bad requests)
    // We only care about 5xx server errors and unhandled exceptions
    const status = event.extra?.status || event.contexts?.response?.status_code;
    if (status && status >= 400 && status < 500) return null;
    return event;
  },
});
