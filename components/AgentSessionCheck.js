"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Shown when an agent visits the portal without a token in the URL.
// Checks localStorage for a previously saved token and redirects if found.
export default function AgentSessionCheck({ slug }) {
  const router   = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`agent-token-${slug}`);
      if (saved) {
        router.replace(`/${slug}/agent?token=${saved}`);
        return;
      }
    } catch {}
    setChecked(true);
  }, [slug, router]);

  if (!checked) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-gray-700 font-medium mb-2">Access Required</p>
        <p className="text-gray-400 text-sm">
          No access token found. Use the link in your confirmation email to access your portal,
          or contact your photographer to resend it.
        </p>
      </div>
    </div>
  );
}
