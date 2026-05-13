"use client";

import { useState, useEffect } from "react";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("cookieConsent")) setVisible(true);
    } catch {}
  }, []);

  function accept() {
    try { localStorage.setItem("cookieConsent", "true"); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-gray-900 border-t border-white/10 px-4 py-3 sm:py-4">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-sm text-white/70 leading-snug">
          This site uses cookies to improve your experience. By continuing, you agree to our use of cookies.{" "}
          <a href="/privacy" className="text-white/90 underline underline-offset-2 hover:text-white transition-colors">
            Learn more
          </a>
        </p>
        <button
          onClick={accept}
          className="flex-shrink-0 px-5 py-2 rounded-lg text-sm font-semibold bg-white text-gray-900 hover:bg-gray-100 transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
