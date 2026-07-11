"use client";

import { useState } from "react";
import Link from "next/link";

// Mobile hamburger for MarketingShell pages (features/blog/compare/vs).
// The desktop nav is hidden below md — without this, mobile visitors had no
// way to reach How it works / Features / Pricing / Guides / Blog.
export default function MarketingMobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="md:hidden relative">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center w-11 h-11 rounded-lg text-gray-700 active:bg-gray-100"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 top-[57px] bg-slate-900/35 z-40" onClick={close} />
          <div className="fixed top-[57px] left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-xl px-5 pb-5 pt-2 flex flex-col" role="menu">
            <a href="/#how-it-works" onClick={close} className="py-3.5 text-base text-gray-800 border-b border-gray-50">How it works</a>
            <Link href="/features" onClick={close} className="py-3.5 text-base text-gray-800 border-b border-gray-50">Features</Link>
            <a href="/#pricing" onClick={close} className="py-3.5 text-base text-gray-800 border-b border-gray-50">Pricing</a>
            <Link href="/guides" onClick={close} className="py-3.5 text-base text-gray-800 border-b border-gray-50">Guides</Link>
            <Link href="/blog" onClick={close} className="py-3.5 text-base text-gray-800 border-b border-gray-50">Blog</Link>
            <Link href="/auth/login" onClick={close} className="py-3.5 text-base text-gray-800">Sign in</Link>
            <Link href="/auth/register" onClick={close} className="mt-2 bg-navy text-white text-center rounded-xl py-3.5 font-medium">Get Started</Link>
          </div>
        </>
      )}
    </div>
  );
}
