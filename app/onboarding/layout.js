"use client";

import { Fragment, useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { OnboardingContext, ONBOARDING_STEPS } from "./ctx";

export default function OnboardingLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [user,       setUser]       = useState(null);
  const [tenant,     setTenant]     = useState(null);
  const [onboarding, setOnboarding] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [saveState,  setSaveState]  = useState("idle"); // idle | saving | saved
  const saveTimerRef = useRef(null);

  // Determine active step from URL
  const slug          = pathname?.split("/").pop() || "";
  const currentStepIdx = ONBOARDING_STEPS.findIndex(s => s.id === slug);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/auth/login"); return; }
      setUser(u);
      try {
        const token = await u.getIdToken();
        const res   = await fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const d = await res.json();
          setTenant(d.tenant || null);
          setOnboarding(d.tenant?.onboarding || null);

          // Tenant already finished onboarding — send them to dashboard, not back here
          if (d.tenant?.onboardingCompleted) {
            router.replace("/dashboard");
            return;
          }
        }
      } catch {}
      setLoading(false);
    });
    return unsub;
  }, []);

  async function patch(fields) {
    const u = auth.currentUser;
    if (!u) return;
    const token = await u.getIdToken();
    return fetch("/api/tenants/update", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify(fields),
    });
  }

  async function saveOnboarding(update) {
    setSaveState("saving");
    const merged = { ...(onboarding || {}), ...update };
    setOnboarding(merged);
    try {
      await patch({ onboarding: merged });
      setSaveState("saved");
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveState("idle"), 3000);
    } catch {
      setSaveState("idle");
    }
  }

  function navigate(stepId) {
    router.push(`/onboarding/${stepId}`);
  }

  const ctx = {
    user, tenant, setTenant, onboarding, setOnboarding,
    saveOnboarding, patch, navigate, currentStepIdx,
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F8F7F4" }}>
        <div className="w-6 h-6 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <OnboardingContext.Provider value={ctx}>
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F8F7F4" }}>

        {/* ── Top bar ───────────────────────────────────────────────────────── */}
        <header style={{
          height: 64, background: "#fff", borderBottom: "1px solid #E9ECF0",
          padding: "0 32px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 30, height: 30, border: "1.5px solid #0F172A", borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 15, color: "#0F172A",
            }}>K</div>
            <span style={{ fontWeight: 700, fontSize: 14, color: "#0F172A" }}>KyoriaOS</span>
          </div>
          <div style={{ flex: 1 }} />

          {/* Save indicator */}
          {saveState !== "idle" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              {saveState === "saving" && (
                <>
                  <div className="w-3 h-3 border-2 border-gray-200 border-t-gray-400 rounded-full animate-spin" />
                  <span style={{ color: "#9CA3AF" }}>Saving…</span>
                </>
              )}
              {saveState === "saved" && (
                <>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#059669" }} />
                  <span style={{ color: "#059669" }}>Saved</span>
                </>
              )}
            </div>
          )}

          <button
            onClick={async () => {
              await patch({ onboarding: { ...(onboarding || {}), currentStep: currentStepIdx + 1 } }).catch(() => {});
              router.push("/dashboard");
            }}
            style={{ fontSize: 13, color: "#475569", cursor: "pointer", background: "none", border: "none", padding: "6px 10px", borderRadius: 6, fontFamily: "inherit" }}
            onMouseEnter={e => e.currentTarget.style.background = "#F3F4F6"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}>
            Save &amp; exit
          </button>
          <span style={{ color: "#E5E7EB" }}>·</span>
          <button
            style={{ fontSize: 13, color: "#3486cf", cursor: "pointer", background: "none", border: "none", padding: "6px 10px", borderRadius: 6, fontFamily: "inherit" }}>
            Need help?
          </button>
        </header>

        {/* ── Stepper ───────────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderBottom: "1px solid #E9ECF0", padding: "16px 0 14px", flexShrink: 0 }}>
          <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 32px", display: "flex", alignItems: "center" }}>
            {ONBOARDING_STEPS.map((step, i) => {
              const isDone    = onboarding?.completed?.[step.id] === true;
              const isActive  = i === currentStepIdx;
              const lineLeft  = i > 0;
              const prevDone  = i > 0 && onboarding?.completed?.[ONBOARDING_STEPS[i - 1].id] === true;

              return (
                <Fragment key={step.id}>
                  {/* Connector line before this dot */}
                  {lineLeft && (
                    <div style={{
                      flex: 1, height: 1.5, margin: "0 4px", marginBottom: 22,
                      background: prevDone ? "#3486cf" : "#E5E7EB",
                      transition: "background 0.3s",
                    }} />
                  )}

                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flexShrink: 0 }}>
                    {/* Circle */}
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      border: isDone ? "none" : isActive ? "2px solid #3486cf" : "1.5px solid #D1D5DB",
                      background: isDone ? "#3486cf" : "#fff",
                      boxShadow: isActive ? "0 0 0 4px #EEF4FA" : "none",
                      color: isDone ? "#fff" : isActive ? "#3486cf" : "#9CA3AF",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700,
                      transition: "all 0.2s",
                    }}>
                      {isDone ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                        </svg>
                      ) : step.num}
                    </div>

                    {/* Label + time */}
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: 0, fontSize: 11.5, fontWeight: isActive ? 700 : 500, color: isDone || isActive ? "#0F172A" : "#9CA3AF" }}>
                        {step.label}
                      </p>
                      <p style={{ margin: 0, fontSize: 10, color: "#9CA3AF" }}>{step.time}</p>
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>

        {/* ── Page content ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, padding: "36px 24px 80px" }}>
          {children}
        </div>
      </div>
    </OnboardingContext.Provider>
  );
}
