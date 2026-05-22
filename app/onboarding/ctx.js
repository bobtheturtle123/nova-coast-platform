"use client";

import { createContext, useContext } from "react";

export const ONBOARDING_STEPS = [
  { id: "branding",     label: "Branding",     time: "2 min",  num: 1 },
  { id: "stripe",       label: "Stripe",        time: "1 min",  num: 2 },
  { id: "team",         label: "Team",          time: "2 min",  num: 3 },
  { id: "service-area", label: "Service Area",  time: "5 min",  num: 4 },
  { id: "review",       label: "Review",        time: "<1 min", num: 5 },
];

export const STEP_ORDER = ["branding", "stripe", "team", "service-area", "review"];

export function nextStep(id) {
  const i = STEP_ORDER.indexOf(id);
  return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : null;
}

export function prevStep(id) {
  const i = STEP_ORDER.indexOf(id);
  return i > 0 ? STEP_ORDER[i - 1] : null;
}

export const OnboardingContext = createContext(null);
export function useOnboarding() { return useContext(OnboardingContext); }

// ── Shared step-card shell ────────────────────────────────────────────────────

export function StepCard({ eyebrow, headline, lede, children, footer, wide }) {
  return (
    <div style={{
      maxWidth: wide ? 1060 : 760, margin: "0 auto",
      background: "#fff", borderRadius: 18,
      border: "1px solid #E9ECF0",
      boxShadow: "0 2px 16px rgba(15,23,42,0.06)",
    }}>
      {/* Card header */}
      <div style={{ padding: "28px 32px 0" }}>
        <p style={{
          display: "flex", alignItems: "center", gap: 7,
          margin: 0, fontSize: 11.5, fontWeight: 600,
          color: "#3486cf", letterSpacing: "0.05em", textTransform: "uppercase",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3486cf", flexShrink: 0, display: "inline-block" }} />
          {eyebrow}
        </p>
        <h1 style={{ margin: "10px 0 0", fontSize: 30, fontFamily: "'Playfair Display', serif", fontWeight: 700, color: "#0F172A", lineHeight: 1.2 }}>
          {headline}
        </h1>
        {lede && (
          <p style={{ margin: "10px 0 0", fontSize: 14, color: "#6B7280", lineHeight: 1.65, maxWidth: 620 }}>{lede}</p>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "24px 32px" }}>
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div style={{
          padding: "16px 32px", borderTop: "1px solid #E9ECF0",
          background: "#F8F7F4", borderRadius: "0 0 18px 18px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {footer}
        </div>
      )}
    </div>
  );
}
