"use client";

import { useState } from "react";
import Link from "next/link";

// Mobile hamburger menu for the public landing pages. Rendered only on small
// screens (the desktop nav is hidden via the landing page CSS).
export default function LandingMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lp-mnav">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="lp-mnav-btn"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        )}
      </button>

      {open && (
        <>
          <div className="lp-mnav-backdrop" onClick={() => setOpen(false)} />
          <div className="lp-mnav-panel" role="menu">
            <a href="#how-it-works" onClick={() => setOpen(false)}>How it works</a>
            <a href="#features" onClick={() => setOpen(false)}>Features</a>
            <a href="#pricing" onClick={() => setOpen(false)}>Pricing</a>
            <Link href="/blog" onClick={() => setOpen(false)}>Blog</Link>
            <div className="lp-mnav-sep" />
            <Link href="/demo" onClick={() => setOpen(false)}>View demo</Link>
            <Link href="/auth/login" onClick={() => setOpen(false)}>Sign in</Link>
            <Link href="/auth/register" className="lp-mnav-cta" onClick={() => setOpen(false)}>Get Started</Link>
          </div>
        </>
      )}
    </div>
  );
}
