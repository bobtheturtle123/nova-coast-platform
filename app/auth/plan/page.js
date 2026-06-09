"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const PLANS = [
  {
    id:       "solo",
    name:     "Solo",
    price:    49,
    tagline:  "Solo real estate media photographers",
    features: ["1 team member", "125 listings / year"],
    featured: false,
  },
  {
    id:       "studio",
    name:     "Studio",
    price:    99,
    tagline:  "Small teams & growing media businesses",
    features: ["3 team members", "300 listings / year"],
    featured: true,
  },
  {
    id:       "pro",
    name:     "Pro",
    price:    179,
    tagline:  "Growing teams with higher volume",
    features: ["5 team members", "600 listings / year"],
    featured: false,
  },
  {
    id:       "scale",
    name:     "Scale",
    price:    349,
    tagline:  "High-volume media teams",
    features: ["10 team members", "1,000 listings / year"],
    featured: false,
  },
];

function CheckIcon() {
  return (
    <span className="w-4 h-4 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
      <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
        <path d="M2.5 6L5 8.5 9.5 3.5" stroke="#3486cf" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
}

export default function PlanSelectionPage() {
  const router       = useRouter();
  const [ready,      setReady]      = useState(false);
  const [loading,    setLoading]    = useState(null); // plan id being submitted
  const [error,      setError]      = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/auth/login"); return; }
      try {
        const token = await u.getIdToken();
        const res   = await fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const { tenant } = await res.json();
          // Already paid - skip to dashboard if onboarding done, otherwise continue onboarding
          if (tenant?.stripeSubscriptionId || tenant?.permanentPlan) {
            router.replace(tenant?.onboardingCompleted ? "/dashboard" : "/onboarding");
            return;
          }
          // Has a Stripe customer but no subscription recorded - webhook may have been missed.
          // Try to sync from Stripe before showing the plan selection screen.
          if (tenant?.stripeCustomerId) {
            try {
              const syncRes  = await fetch("/api/billing/sync", { headers: { Authorization: `Bearer ${token}` } });
              const syncData = await syncRes.json();
              if (syncData.synced) {
                router.replace(tenant?.onboardingCompleted ? "/dashboard" : "/onboarding");
                return;
              }
            } catch {}
          }
        }
      } catch {}
      setReady(true);
    });
    return unsub;
  }, [router]);

  async function handleSelect(planId) {
    setLoading(planId);
    setError("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res   = await fetch("/api/billing/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ plan: planId, successPath: "/onboarding" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Could not start checkout. Please try again.");
        setLoading(null);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(null);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream px-4 py-12">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <img src="/kyoriaos-logo.png" alt="KyoriaOS" className="h-11 w-auto object-contain mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Choose your plan</h1>
          <p className="text-gray-500 text-sm">All plans include everything you need to run your photography business. Upgrade or downgrade anytime.</p>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl text-center">
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border p-6 flex flex-col ${
                plan.featured
                  ? "border-[#3486cf] shadow-lg ring-1 ring-[#3486cf]/10"
                  : "border-gray-200"
              }`}
            >
              {plan.featured && (
                <div className="mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#3486cf] bg-blue-50 px-2.5 py-1 rounded-full">
                    Most popular
                  </span>
                </div>
              )}

              <p className="font-bold text-gray-900 text-lg mb-0.5">{plan.name}</p>
              <p className="text-xs text-gray-400 mb-4">{plan.tagline}</p>

              <div className="mb-5">
                <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                <span className="text-sm text-gray-400">/mo</span>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckIcon />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(plan.id)}
                disabled={!!loading}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
                  plan.featured
                    ? "bg-[#3486cf] text-white hover:bg-[#2a6dab]"
                    : "border border-gray-200 text-gray-700 hover:border-[#3486cf] hover:text-[#3486cf]"
                }`}
              >
                {loading === plan.id ? "Redirecting…" : "Get Started →"}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Have a promo code? You&apos;ll be able to enter it at checkout. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
