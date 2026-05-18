"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// On first visit with an invite link (?token=xxx), exchanges the token for an
// httpOnly session cookie and then strips the token from the URL so it doesn't
// linger in browser history, server logs, or referrer headers.
export default function AgentTokenPersist({ slug, token }) {
  const router = useRouter();

  useEffect(() => {
    if (!slug || !token) return;
    fetch(`/api/${slug}/agent/session`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ token }),
    })
      .then((r) => {
        if (r.ok) {
          // Remove the ?token= from the URL without triggering a page reload
          const url = new URL(window.location.href);
          url.searchParams.delete("token");
          router.replace(url.pathname + (url.search || ""), { scroll: false });
        }
      })
      .catch(() => {});
  }, [slug, token, router]);

  return null;
}
