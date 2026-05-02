"use client";

import { useEffect } from "react";

// Saves the agent magic-link token to localStorage so returning agents
// don't need to click the email link every visit.
export default function AgentTokenPersist({ slug, token }) {
  useEffect(() => {
    if (!slug || !token) return;
    try {
      localStorage.setItem(`agent-token-${slug}`, token);
    } catch {}
  }, [slug, token]);

  return null;
}
