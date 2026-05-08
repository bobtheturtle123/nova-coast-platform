"use client";

import { useEffect } from "react";

// On first visit with an invite link (?token=xxx), sets a server-side session
// cookie via the session API so future visits don't need the token in the URL.
export default function AgentTokenPersist({ slug, token }) {
  useEffect(() => {
    if (!slug || !token) return;
    fetch(`/api/${slug}/agent/session`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token }),
    }).catch(() => {});
  }, [slug, token]);

  return null;
}
