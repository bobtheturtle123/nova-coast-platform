"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function DiscountPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("kyoria_popup")) return;

    let fired = false;
    function fire() {
      if (fired) return;
      fired = true;
      sessionStorage.setItem("kyoria_popup", "1");
      setTimeout(() => setVisible(true), 350);
    }

    function onMouseLeave(e) {
      if (e.clientY <= 0) fire();
    }

    document.addEventListener("mouseleave", onMouseLeave);
    return () => {
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(10,16,30,0.65)", backdropFilter: "blur(6px)" }}
      onClick={() => setVisible(false)}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setVisible(false)}
          className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors"
          aria-label="Close"
        >
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="text-center">
          <div className="inline-block bg-gold/10 border border-gold/25 rounded-full px-3 py-1 text-xs font-semibold text-navy/70 tracking-wide mb-5">
            First month offer
          </div>

          <h2 className="font-serif text-[2rem] text-navy font-normal leading-tight mb-3">
            Try it on your<br />next shoot.
          </h2>

          <p className="text-gray-500 text-sm leading-relaxed mb-1.5">
            Get <span className="font-bold text-navy">$50 off</span> your first month.
          </p>
          <p className="text-gray-400 text-xs mb-7">
            Use code{" "}
            <span className="font-mono font-bold text-navy tracking-wider bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">
              FIRST50
            </span>{" "}
            at checkout.
          </p>

          <Link
            href="/auth/register?promo=FIRST50"
            onClick={() => setVisible(false)}
            className="block bg-navy text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-navy/90 transition-colors text-sm mb-3"
          >
            Get Started and Save $50
          </Link>

          <button
            onClick={() => setVisible(false)}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
