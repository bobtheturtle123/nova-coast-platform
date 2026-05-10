"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
          <h2 style={{ color: "#e74c3c" }}>Something went wrong</h2>
          <p style={{ color: "#666", marginBottom: "20px" }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#3486cf", color: "white", border: "none",
              padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontSize: "14px",
            }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
