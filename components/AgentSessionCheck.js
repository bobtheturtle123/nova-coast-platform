"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Shown when an agent visits the portal without a session cookie.
// Redirects to the login page.
export default function AgentSessionCheck({ slug }) {
  const router    = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Give the server a moment to detect the cookie (it's httpOnly, client can't read it).
    // We use a lightweight session ping to check if a cookie was already set.
    fetch(`/api/${slug}/agent/session`)
      .then((r) => {
        if (r.ok) {
          // Active session found — refresh the page so the server component can render
          router.replace(`/${slug}/agent`);
        } else {
          setChecked(true);
        }
      })
      .catch(() => setChecked(true));
  }, [slug, router]);

  useEffect(() => {
    if (!checked) return;
    router.replace(`/${slug}/agent/login`);
  }, [checked, slug, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );
}
