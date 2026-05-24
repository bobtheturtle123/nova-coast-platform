"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useOnboarding, StepCard } from "../ctx";

export default function StripeStep() {
  const router = useRouter();
  const { tenant, onboarding, saveOnboarding, patch } = useOnboarding();

  const stripeStatus = tenant?.stripeConnectOnboarded
    ? "connected"
    : tenant?.stripe?.status === "incomplete"
    ? "incomplete"
    : "none";

  const [depositPct, setDepositPct] = useState(
    tenant?.pricingConfig?.depositPercent ?? 25
  );
  const [connecting, setConnecting] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  const exampleDeposit = ((depositPct / 100) * 1000).toFixed(0);

  async function startConnect() {
    setConnecting(true); setError("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch("/api/connect/onboard", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data  = await res.json();
      if (data.url) {
        await patch({ onboarding: { ...(onboarding || {}), currentStep: 2 } }).catch(() => {});
        window.location.href = data.url;
      } else throw new Error(data.error || "Could not start Stripe Connect");
    } catch (err) { setError(err.message); setConnecting(false); }
  }

  async function handleContinue() {
    setSaving(true);
    await patch({
      pricingConfig: { ...(tenant?.pricingConfig || {}), depositPercent: depositPct },
      bookingConfig: { ...(tenant?.bookingConfig || {}), depositPercent: depositPct },
    }).catch(() => {});
    await saveOnboarding({
      completed: { ...(onboarding?.completed || {}), stripe: true },
      currentStep: 3,
    });
    router.push("/onboarding/team");
    setSaving(false);
  }

  async function handleSkip() {
    await saveOnboarding({
      completed: { ...(onboarding?.completed || {}), stripe: true },
      skipped:   { ...(onboarding?.skipped   || {}), stripe: true },
      currentStep: 3,
    });
    router.push("/onboarding/team");
  }

  return (
    <StepCard
      eyebrow="Step 2 of 5 · Stripe Connect"
      headline="Get paid for bookings"
      lede="Bookings without Stripe still work, but deposits and balances must be collected manually. Connect now to let clients pay at checkout."
      footer={
        <>
          <button className="btn-ghost" onClick={() => router.push("/onboarding/branding")}>← Back</button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn-ghost" onClick={handleSkip}>Skip for now</button>
            <button className="btn-primary" onClick={handleContinue} disabled={saving}>
              {saving ? "Saving…" : "Continue → Team"}
            </button>
          </div>
        </>
      }
    >
      {error && (
        <div style={{ marginBottom: 18, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 9, fontSize: 13, color: "#DC2626" }}>
          {error}
        </div>
      )}

      {/* Status block */}
      {stripeStatus === "connected" && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 12, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, background: "#059669", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#065F46" }}>Connected</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#047857" }}>
              Payouts to ••••{tenant?.stripe?.payoutMethodLast4 || "????"}
            </p>
          </div>
          <div style={{ flex: 1 }} />
          <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: "#059669", fontWeight: 500 }}>Manage on Stripe →</a>
        </div>
      )}

      {stripeStatus === "incomplete" && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 20px", background: "#FFFBEB", border: "1px solid #FCD34D", borderRadius: 12, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, background: "#D97706", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#92400E" }}>Almost there — finish KYC on Stripe</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#B45309" }}>You started connecting but didn't finish the identity steps.</p>
          </div>
          <div style={{ flex: 1 }} />
          <button onClick={startConnect} disabled={connecting}
            style={{ fontSize: 13, fontWeight: 600, color: "#92400E", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: "8px 14px", cursor: "pointer" }}>
            {connecting ? "Redirecting…" : "Resume on Stripe →"}
          </button>
        </div>
      )}

      {stripeStatus === "none" && (
        <div style={{ display: "flex", gap: 20, marginBottom: 24 }}>
          {/* Stripe card */}
          <div style={{ flex: 1, border: "1px solid #E9ECF0", borderRadius: 14, padding: "20px 24px", background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <svg width="40" height="18" viewBox="0 0 60 25" fill="none" style={{ flexShrink: 0 }}>
                <text x="0" y="20" fontFamily="sans-serif" fontWeight="700" fontSize="20" fill="#635BFF">stripe</text>
              </svg>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              {[
                { icon: "⚡", title: "Deposits at checkout",       desc: "Clients pay a deposit when they book; balance due before download." },
                { icon: "💳", title: "Automatic balance reminders", desc: "Email reminders fire 48 h before the gallery goes live." },
                { icon: "📊", title: "Payout schedule you control", desc: "Daily, weekly, or manual — you pick." },
                { icon: "🛡", title: "Built-in dispute handling",   desc: "Stripe's chargeback protection included at no extra cost." },
              ].map(p => (
                <div key={p.title} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{p.icon}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0F172A" }}>{p.title}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#6B7280" }}>{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={startConnect} disabled={connecting} className="btn-primary w-full" style={{ width: "100%", justifyContent: "center", padding: "10px 0" }}>
              {connecting ? "Redirecting to Stripe…" : "Connect Stripe →"}
            </button>
          </div>
        </div>
      )}

      {/* Default deposit % */}
      <div style={{ padding: "18px 20px", background: "#F8F7F4", border: "1px solid #E9ECF0", borderRadius: 12 }}>
        <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "#0F172A" }}>Default deposit %</p>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <input
            type="range"
            min={0} max={100} step={5}
            value={depositPct}
            onChange={e => setDepositPct(Number(e.target.value))}
            style={{ flex: 1, accentColor: "#3486cf" }}
          />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#3486cf", minWidth: 44, textAlign: "right" }}>{depositPct}%</span>
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#9CA3AF" }}>
          On a $1,000 booking: <strong style={{ color: "#0F172A" }}>${exampleDeposit} deposit</strong> due at booking · <strong style={{ color: "#0F172A" }}>${(1000 - Number(exampleDeposit)).toFixed(0)} balance</strong> due before download
        </p>
      </div>
    </StepCard>
  );
}
