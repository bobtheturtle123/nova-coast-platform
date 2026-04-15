"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";

const PLANS = [
  { id: "starter", name: "Starter", price: 39,  desc: "Up to 30 bookings/month · 1 team member" },
  { id: "pro",     name: "Pro",     price: 79,  desc: "Up to 150 bookings/month · 5 team members · Custom domain" },
  { id: "studio",  name: "Studio",  price: 149, desc: "Unlimited bookings · 25 team members · White-label" },
];

const PLAN_NAMES  = { starter: "Starter", pro: "Pro", studio: "Studio", agency: "Studio" };
const PLAN_PRICES = { starter: 39, pro: 79, studio: 149, agency: 149 };

function isStripeNotConfigured(errorMsg) {
  if (!errorMsg) return false;
  const lower = errorMsg.toLowerCase();
  return lower.includes("invalid plan") || lower.includes("no such price") || lower.includes("price_");
}

export default function BillingPage() {
  const [tenant,           setTenant]          = useState(null);
  const [listingsThisYear, setListingsThisYear] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [msg,     setMsg]     = useState({ text: "", type: "error" });

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("subscribed") === "true") {
      setMsg({ text: "You're subscribed! Welcome aboard. Your plan is now active.", type: "success" });
    }
  }, [searchParams]);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const [tenantRes, statsRes] = await Promise.all([
        fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/stats",  { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (tenantRes.ok) { const data = await tenantRes.json(); setTenant(data.tenant); }
      if (statsRes.ok)  { const data = await statsRes.json();  setListingsThisYear(data.stats?.listingsThisYear || 0); }
      setLoading(false);
    });
  }, []);

  function setError(text) {
    if (isStripeNotConfigured(text)) {
      setMsg({
        text: "Stripe is not yet configured. Contact support or add STRIPE_PRICE_* environment variables.",
        type: "config",
      });
    } else {
      setMsg({ text, type: "error" });
    }
  }

  async function openPortal() {
    setWorking(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || "Could not open billing portal.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  async function subscribe(plan) {
    setWorking(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || "Could not start checkout.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  async function startConnect() {
    setWorking(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/connect/onboard", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || "Could not start Stripe Connect.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );

  const plan       = tenant?.subscriptionPlan || "starter";
  const status     = tenant?.subscriptionStatus || "trialing";
  const subscribed = !!tenant?.stripeSubscriptionId;

  // Listing limits per plan (yearly)
  const LISTING_LIMITS = { starter: 50, pro: 150, studio: Infinity, agency: Infinity };
  const listingLimit   = LISTING_LIMITS[plan] || 50;
  const listingsUsed   = listingsThisYear;
  const listingPct     = listingLimit === Infinity ? 0 : Math.min(100, Math.round((listingsUsed / listingLimit) * 100));

  const msgStyles = {
    success: "bg-green-50 border border-green-300 text-green-800",
    error:   "bg-red-50 border border-red-300 text-red-800",
    config:  "bg-amber-50 border border-amber-300 text-amber-900",
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display text-2xl text-navy mb-2">Billing</h1>
      <p className="text-gray-500 text-sm mb-8">Manage your subscription and payment settings.</p>

      {/* Feedback message */}
      {msg.text && (
        <div className={`text-sm px-4 py-3 rounded-sm mb-6 font-medium ${msgStyles[msg.type] || msgStyles.error}`}>
          {msg.type === "config" && (
            <span className="font-bold block mb-0.5">Configuration required</span>
          )}
          {msg.text}
        </div>
      )}

      {/* Current plan summary */}
      <div className="bg-white rounded-sm border border-gray-200 p-6 mb-6">
        <h2 className="font-display text-navy text-base mb-4">Current Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-navy">{PLAN_NAMES[plan] || plan}</p>
            <p className="text-sm text-gray-500">${PLAN_PRICES[plan] || 0}/month</p>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-medium
            ${status === "active"   ? "bg-green-50 text-green-700" :
              status === "trialing" ? "bg-blue-50 text-blue-700"   :
              status === "past_due" ? "bg-red-50 text-red-700"     :
              "bg-gray-50 text-gray-600"}`}>
            {status === "trialing" ? "Free trial" : status}
          </span>
        </div>

        {status === "trialing" && tenant?.trialEndsAt && (
          <p className="text-xs text-amber-600 mt-2">
            Trial ends {(() => {
              const raw = tenant.trialEndsAt;
              const d = raw?.seconds ? new Date(raw.seconds * 1000) : new Date(raw);
              return isNaN(d) ? "in 14 days" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            })()}
          </p>
        )}

        {subscribed ? (
          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={openPortal} disabled={working}
              className="btn-outline text-sm px-4 py-2">
              {working ? "Loading…" : "Manage subscription →"}
            </button>
            <button onClick={openPortal} disabled={working}
              className="text-sm px-4 py-2 rounded-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
              {working ? "Loading…" : "Cancel subscription"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 mt-2">
            No active subscription. Select a plan below to get started after your trial.
          </p>
        )}

        {subscribed && (
          <p className="text-xs text-gray-400 mt-2">
            To cancel, click "Cancel subscription" — you can manage or cancel your plan in the Stripe portal.
          </p>
        )}
      </div>

      {/* Listings usage */}
      <div className="bg-white rounded-sm border border-gray-200 p-6 mb-6">
        <h2 className="font-display text-navy text-base mb-4">Listings Usage</h2>
        <div className="flex items-end justify-between mb-2">
          <p className="text-sm text-gray-500">Listings this year</p>
          <p className="text-sm font-semibold text-charcoal">
            {listingsUsed.toLocaleString()}
            {listingLimit !== Infinity && ` / ${listingLimit.toLocaleString()}`}
            {listingLimit === Infinity && " (unlimited)"}
          </p>
        </div>
        {listingLimit !== Infinity && (
          <>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${listingPct >= 90 ? "bg-red-500" : listingPct >= 70 ? "bg-amber-400" : "bg-navy"}`}
                style={{ width: `${listingPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">{listingPct}% of your yearly allowance used</p>
            {listingPct >= 90 && (
              <p className="text-xs text-red-600 mt-1 font-medium">Approaching limit — consider upgrading to avoid interruptions.</p>
            )}
          </>
        )}
        <p className="text-xs text-gray-400 mt-3">Resets on January 1st each year.</p>
      </div>

      {/* Plan cards — always shown */}
      <div className="mb-6">
        <h2 className="font-display text-navy text-base mb-3">
          {subscribed ? "Your Plan" : "Choose a Plan"}
        </h2>
        <div className="space-y-3">
          {PLANS.map((p) => {
            const isCurrent = plan === p.id;
            const isOther   = subscribed && !isCurrent;

            return (
              <div key={p.id}
                className={`flex items-center justify-between p-4 rounded-sm border transition-all
                  ${isCurrent
                    ? "border-2 border-navy bg-navy/5 shadow-sm"
                    : isOther
                      ? "border-gray-100 bg-gray-50 opacity-60"
                      : "border-gray-200 bg-white"}`}>
                <div className="flex items-start gap-3">
                  {isCurrent && (
                    <span className="mt-0.5 text-xs font-semibold bg-navy text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                      Current Plan
                    </span>
                  )}
                  <div>
                    <p className={`font-medium text-sm ${isCurrent ? "text-navy" : "text-gray-600"}`}>{p.name}</p>
                    <p className="text-xs text-gray-500">{p.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`text-sm font-semibold ${isCurrent ? "text-navy" : "text-gray-400"}`}>
                    ${p.price}/mo
                  </span>
                  {isCurrent && subscribed && (
                    <span className="text-xs text-green-700 font-medium">Active</span>
                  )}
                  {isOther && subscribed && (
                    <button onClick={openPortal} disabled={working}
                      className="text-xs px-3 py-1.5 rounded-sm border border-gray-300 text-gray-500 hover:bg-white transition-colors disabled:opacity-50">
                      {working ? "…" : "Upgrade via portal"}
                    </button>
                  )}
                  {!subscribed && (
                    <button onClick={() => subscribe(p.id)} disabled={working}
                      className="btn-primary text-xs px-3 py-1.5">
                      {working ? "…" : "Subscribe"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stripe Connect */}
      <div className="bg-white rounded-sm border border-gray-200 p-6">
        <h2 className="font-display text-navy text-base mb-4">Stripe Connect — Accept Payments</h2>
        {tenant?.stripeConnectOnboarded ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl">✅</span>
            <div>
              <p className="font-medium text-green-700 text-sm">Stripe account connected</p>
              <p className="text-xs text-gray-400">Client payments flow directly to your bank account.</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Connect your Stripe account to accept client deposits and balance payments.
              Funds go directly to you. We take a 1.5% platform fee.
            </p>
            <button onClick={startConnect} disabled={working}
              className="btn-primary px-6 py-2 text-sm">
              {working ? "Loading…" : "Connect Stripe Account"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
