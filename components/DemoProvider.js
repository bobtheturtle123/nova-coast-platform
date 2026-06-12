"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DemoProvider — wraps the dashboard in view-only "demo workspace" mode.
//
// When demo mode is active (see lib/demoData isDemo):
//   • Every mutating network call (create/edit/delete/upload/send/publish/
//     charge/invite/connect/save) is intercepted and blocked, and the standard
//     view-only message is shown. GET requests still flow so pages render.
//   • A persistent top banner shows the demo notice + CTAs into signup.
//
// It does NOTHING when demo mode is off, so real users are never affected.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { isDemo, exitDemo, DEMO_VIEW_ONLY_MESSAGE } from "@/lib/demoData";

// Live signup with the 50%-off-first-month offer pre-applied.
const SIGNUP_URL = "/auth/register?promo=DEMO50&offer=50-off-first-month";

function fireViewOnly() {
  try { window.dispatchEvent(new CustomEvent("ky:demo-blocked")); } catch {}
}

// Decide whether a request should be blocked in demo mode.
function isMutating(method) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes((method || "GET").toUpperCase());
}
function shouldBlock(url, method) {
  if (!isMutating(method)) return false;
  const u = String(url || "");
  // Let Firebase/Google auth + token refresh through; block app + upload writes.
  if (/googleapis|google\.com|gstatic|identitytoolkit|securetoken|firebaseio/i.test(u)) return false;
  const isApi    = u.includes("/api/");
  const isUpload = /r2\.|amazonaws|cloudflarestorage|blob\.|\/upload/i.test(u);
  return isApi || isUpload || u.startsWith("/") || u.startsWith(window.location.origin);
}

export default function DemoProvider({ children }) {
  const [demo, setDemo]       = useState(false);
  const [toast, setToast]     = useState(false);

  // Demo mode ONLY applies when no real user is signed in. If a real user is
  // present, force demo off and clear the flag — this prevents a stale ky_demo
  // (from earlier visiting the demo) from blocking a real session in the same tab.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) { exitDemo(); setDemo(false); }
      else   { setDemo(isDemo()); }
    });
    return unsub;
  }, []);

  const showToast = useCallback(() => {
    setToast(true);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(false), 4000);
  }, []);

  // Intercept mutating fetches while in demo mode.
  useEffect(() => {
    if (!demo) return;
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      const url    = typeof input === "string" ? input : input?.url;
      const method = init?.method || (typeof input === "object" ? input?.method : "GET");
      if (shouldBlock(url, method)) {
        fireViewOnly();
        return Promise.resolve(
          new Response(JSON.stringify({ error: "view-only-demo", demo: true }), {
            status: 423,
            headers: { "Content-Type": "application/json" },
          })
        );
      }
      return origFetch.apply(this, arguments);
    };
    const onBlocked = () => showToast();
    window.addEventListener("ky:demo-blocked", onBlocked);
    return () => {
      window.fetch = origFetch;
      window.removeEventListener("ky:demo-blocked", onBlocked);
    };
  }, [demo, showToast]);

  if (!demo) return children;

  return (
    <>
      {/* ── Persistent demo banner ─────────────────────────────────────────── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 60,
        background: "#181B20", color: "#fff",
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        padding: "9px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        fontSize: 13.5, lineHeight: 1.4,
      }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "rgba(201,169,110,0.18)", color: "#C9A96E",
          fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
          padding: "4px 10px", borderRadius: 99,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 99, background: "#C9A96E", display: "inline-block" }} />
          Live Demo
        </span>
        <span style={{ color: "rgba(255,255,255,0.72)", flex: "1 1 260px", minWidth: 0 }}>
          You&apos;re exploring a view-only KyoriaOS workspace with sample data. Actions are disabled.
        </span>
        <Link href="/auth/register"
          style={{ background: "#fff", color: "#181B20", fontWeight: 600, fontSize: 13,
                   padding: "8px 16px", borderRadius: 10, whiteSpace: "nowrap" }}>
          Start Your Workspace
        </Link>
        <Link href={SIGNUP_URL}
          style={{ background: "#C9A96E", color: "#2A2008", fontWeight: 700, fontSize: 13,
                   padding: "8px 16px", borderRadius: 10, whiteSpace: "nowrap" }}>
          Subscribe &amp; Get 50% Off Your First Month
        </Link>
        <button
          onClick={() => { exitDemo(); window.location.href = "/"; }}
          style={{ background: "transparent", color: "rgba(255,255,255,0.45)", fontSize: 12.5,
                   border: "none", padding: "7px 4px", textDecoration: "underline",
                   cursor: "pointer", whiteSpace: "nowrap" }}>
          Exit demo
        </button>
      </div>

      {children}

      {/* ── View-only toast ────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, maxWidth: 460, width: "calc(100% - 32px)",
          background: "#181B20", color: "#fff", borderRadius: 14,
          boxShadow: "0 24px 60px -20px rgba(0,0,0,0.5)", padding: "16px 18px",
          display: "flex", gap: 12, alignItems: "flex-start",
        }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: "rgba(201,169,110,0.18)", color: "#C9A96E",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔒</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "rgba(255,255,255,0.88)" }}>
              {DEMO_VIEW_ONLY_MESSAGE}
            </p>
            <Link href={SIGNUP_URL}
              style={{ display: "inline-block", marginTop: 10, color: "#C9A96E", fontWeight: 700, fontSize: 13 }}>
              Subscribe &amp; get 50% off your first month →
            </Link>
          </div>
          <button onClick={() => setToast(false)}
            style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.4)",
                     fontSize: 18, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
      )}
    </>
  );
}
