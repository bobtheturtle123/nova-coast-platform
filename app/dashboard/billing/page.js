"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";

const PLANS = [
  { id: "solo",   name: "Solo",     price: 79,  desc: "120 listing credits / year · 1 seat" },
  { id: "studio", name: "Studio",   price: 159, desc: "300 listing credits / year · 5 seats" },
  { id: "pro",    name: "Pro Team", price: 279, desc: "600 listing credits / year · 12 seats" },
  { id: "scale",  name: "Scale",    price: 449, desc: "1,200 listing credits / year · Unlimited seats" },
];

const PLAN_NAMES  = { solo: "Solo", studio: "Studio", pro: "Pro Team", scale: "Scale", starter: "Solo" };
const PLAN_PRICES = { solo: 79, studio: 159, pro: 279, scale: 449, starter: 79 };
const PLAN_LIMITS = { solo: 120, studio: 300, pro: 600, scale: 1200, starter: 120 };

// Per-plan expansion caps — null means unlimited (Scale)
const ADDON_CAPS = {
  solo:   { extraSeats: 0,    topupListings: 50  },
  studio: { extraSeats: 3,    topupListings: 100 },
  pro:    { extraSeats: 8,    topupListings: 200 },
  scale:  { extraSeats: null, topupListings: null },
};
const NEXT_PLAN_NAME = { solo: "Studio", studio: "Pro Team", pro: "Scale", scale: null };

const TOPUP_PACKS = [
  { pack: "pack25",  label: "+25 Credits",  price: "$175", credits: 25 },
  { pack: "pack50",  label: "+50 Credits",  price: "$325", credits: 50 },
  { pack: "pack100", label: "+100 Credits", price: "$600", credits: 100 },
];

function isStripeNotConfigured(errorMsg) {
  if (!errorMsg) return false;
  const lower = errorMsg.toLowerCase();
  return lower.includes("invalid plan") || lower.includes("no such price") || lower.includes("price_");
}

export default function BillingPage() {
  const [tenant,           setTenant]          = useState(null);
  const [listingsThisYear, setListingsThisYear] = useState(0);
  const [teamMemberCount,  setTeamMemberCount]  = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [msg,     setMsg]     = useState({ text: "", type: "error" });

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("subscribed") === "true") {
      setMsg({ text: "You're subscribed! Welcome aboard. Your plan is now active.", type: "success" });
    }
    if (searchParams.get("topup") === "success") {
      setMsg({ text: "Listing credits added successfully. Your balance has been updated.", type: "success" });
    }
  }, [searchParams]);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const [tenantRes, statsRes, teamRes] = await Promise.all([
        fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/stats",  { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/team",   { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (tenantRes.ok) { const data = await tenantRes.json(); setTenant(data.tenant); }
      if (statsRes.ok)  { const data = await statsRes.json();  setListingsThisYear(data.stats?.listingsThisYear || 0); }
      if (teamRes.ok)   { const data = await teamRes.json();   setTeamMemberCount(data.members?.length || 0); }
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

  async function buyTopup(pack) {
    setWorking(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pack }),
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
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  const plan       = tenant?.subscriptionPlan || "starter";
  const status     = tenant?.subscriptionStatus || "trialing";
  const subscribed = !!tenant?.stripeSubscriptionId;

  const addonListings  = tenant?.addonListings || 0;
  const addonSeats     = tenant?.addonSeats || 0;
  const listingLimit   = (PLAN_LIMITS[plan] || 120) + addonListings;
  const listingsUsed   = listingsThisYear;
  const listingPct     = Math.min(100, Math.round((listingsUsed / listingLimit) * 100));

  const caps           = ADDON_CAPS[plan] || ADDON_CAPS.solo;
  const nextPlanName   = NEXT_PLAN_NAME[plan];
  const topupCap       = caps.topupListings;
  const topupAtCap     = topupCap !== null && addonListings >= topupCap;
  const topupRemaining = topupCap === null ? null : topupCap - addonListings;
  const seatCap        = caps.extraSeats; // 0 = not allowed, null = unlimited
  const seatAtCap      = seatCap !== null && addonSeats >= seatCap;

  // Seat usage
  const BASE_SEATS     = { solo: 1, studio: 5, pro: 12, scale: null, starter: 1 };
  const baseSeatLimit  = BASE_SEATS[plan] ?? 1;
  const totalSeats     = baseSeatLimit === null ? null : baseSeatLimit + addonSeats;
  const seatsUsed      = teamMemberCount + 1; // +1 for owner
  const seatPct        = totalSeats === null ? 0 : Math.min(100, Math.round((seatsUsed / totalSeats) * 100));

  const msgStyles = {
    success: "bg-green-50 border border-green-300 text-green-800",
    error:   "bg-red-50 border border-red-300 text-red-800",
    config:  "bg-amber-50 border border-amber-300 text-amber-900",
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="page-title mb-1">Billing</h1>
      <p className="page-subtitle mb-8">Manage your subscription and payment settings.</p>

      {/* Feedback message */}
      {msg.text && (
        <div className={`text-sm px-4 py-3 rounded-xl mb-6 font-medium ${msgStyles[msg.type] || msgStyles.error}`}>
          {msg.type === "config" && (
            <span className="font-bold block mb-0.5">Configuration required</span>
          )}
          {msg.text}
        </div>
      )}

      {/* Current plan summary */}
      <div className="card mb-5">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-semibold text-[#0F172A] text-sm">Current Plan</h2>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-[#0F172A] text-lg">{PLAN_NAMES[plan] || plan}</p>
            <p className="text-sm text-gray-500">${PLAN_PRICES[plan] || 0}/month</p>
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-full font-semibold
            ${status === "active"   ? "bg-emerald-50 text-emerald-700" :
              status === "trialing" ? "bg-blue-50 text-blue-700"       :
              status === "past_due" ? "bg-red-50 text-red-700"         :
              "bg-gray-100 text-gray-600"}`}>
            {status === "trialing" ? "Free trial" : status}
          </span>
        </div>

        {status === "trialing" && tenant?.trialEndsAt && (
          <p className="text-xs text-amber-600 mt-3 font-medium">
            Trial ends {(() => {
              const raw = tenant.trialEndsAt;
              const d = raw?.seconds ? new Date(raw.seconds * 1000) : new Date(raw);
              return isNaN(d) ? "in 14 days" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            })()}
          </p>
        )}

        {subscribed ? (
          <div className="flex flex-wrap gap-2 mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <button onClick={openPortal} disabled={working} className="btn-outline">
              {working ? "Loading…" : "Manage subscription →"}
            </button>
            <button onClick={openPortal} disabled={working}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-[13px] font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
              {working ? "Loading…" : "Cancel subscription"}
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-400 mt-3">
            No active subscription. Select a plan below to get started after your trial.
          </p>
        )}
      </div>

      {/* Listing credits usage */}
      <div className="card mb-5">
        <h2 className="font-semibold text-[#0F172A] text-sm mb-4">Listing Credits</h2>
        <div className="flex items-end justify-between mb-3">
          <p className="text-sm text-gray-500">Used this year</p>
          <p className="text-sm font-semibold text-[#0F172A]">
            {listingsUsed.toLocaleString()} / {listingLimit.toLocaleString()}
            {addonListings > 0 && <span className="text-xs text-gray-400 ml-1.5 font-normal">(+{addonListings} add-on)</span>}
          </p>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${listingPct >= 90 ? "bg-red-500" : listingPct >= 70 ? "bg-amber-400" : "bg-[#0F172A]"}`}
            style={{ width: `${listingPct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">{listingPct}% of your annual credits used</p>
        {listingPct >= 90 && (
          <p className="text-xs text-red-600 mt-1.5 font-medium">Approaching your credit limit. Consider upgrading or adding a credit pack.</p>
        )}
      </div>

      {/* Seat usage */}
      <div className="card mb-5">
        <h2 className="font-semibold text-[#0F172A] text-sm mb-4">Team Seats</h2>
        {totalSeats === null ? (
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-emerald-600">Unlimited seats</span> on Scale plan.
            Currently using <span className="font-semibold">{seatsUsed.toLocaleString()}</span> seats.
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between mb-3">
              <p className="text-sm text-gray-500">Seats used</p>
              <p className="text-sm font-semibold text-[#0F172A]">
                {seatsUsed.toLocaleString()} / {totalSeats.toLocaleString()}
                {addonSeats > 0 && <span className="text-xs text-gray-400 ml-1.5 font-normal">(+{addonSeats} add-on)</span>}
              </p>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${seatPct >= 90 ? "bg-red-500" : seatPct >= 70 ? "bg-amber-400" : "bg-[#0F172A]"}`}
                style={{ width: `${seatPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {Math.max(0, totalSeats - seatsUsed)} seat{totalSeats - seatsUsed !== 1 ? "s" : ""} remaining
            </p>
            {seatPct >= 90 && (
              <p className="text-xs text-red-600 mt-1.5 font-medium">Approaching your seat limit. Add a seat or upgrade to {nextPlanName || "Scale"}.</p>
            )}
          </>
        )}
      </div>

      {/* Listing credit top-ups */}
      <div className="card mb-5">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-semibold text-[#0F172A] text-sm">Need more listing credits?</h2>
          {topupCap !== null && (
            <span className="text-xs text-gray-400 mt-0.5">{addonListings} / {topupCap} add-on credits used</span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">One-time purchases. Credits added immediately. Non-refundable after purchase.</p>

        {topupAtCap ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900 mb-1">Credit expansion limit reached</p>
            <p className="text-xs text-amber-700 mb-3">
              Your {PLAN_NAMES[plan]} plan supports up to {topupCap} add-on listing credits.
              {nextPlanName && ` Upgrading to ${nextPlanName} significantly increases your capacity.`}
            </p>
            {nextPlanName && (
              <button onClick={openPortal} disabled={working} className="btn-primary text-xs">
                {working ? "…" : `Upgrade to ${nextPlanName} →`}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {TOPUP_PACKS.map((t) => {
              const wouldExceed = topupCap !== null && (addonListings + t.credits) > topupCap;
              const disabled    = working || wouldExceed;
              return (
                <button key={t.pack} onClick={() => buyTopup(t.pack)} disabled={disabled}
                  className={`flex flex-col items-center p-4 rounded-xl border transition-all text-center
                    ${wouldExceed
                      ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                      : "border-gray-200 bg-white hover:border-[#3486cf] hover:shadow-card-hover disabled:opacity-50"
                    }`}>
                  <span className="font-semibold text-[#0F172A] text-sm">{t.label}</span>
                  <span className="text-xs text-gray-500 mt-0.5">{t.price} one-time</span>
                  {wouldExceed && <span className="text-xs text-amber-600 mt-1">exceeds plan limit</span>}
                </button>
              );
            })}
          </div>
        )}

        {!topupAtCap && topupRemaining !== null && topupRemaining <= 50 && nextPlanName && (
          <p className="text-xs text-amber-600 mt-3">
            {topupRemaining} add-on credits remaining on this plan.
            Upgrading to {nextPlanName} gives more annual credits and higher expansion capacity.
          </p>
        )}
      </div>

      {/* Team seat add-ons */}
      <div className="card mb-5">
        <div className="flex items-start justify-between mb-1">
          <h2 className="font-semibold text-[#0F172A] text-sm">Additional Team Seats</h2>
          {seatCap !== null && seatCap > 0 && (
            <span className="text-xs text-gray-400 mt-0.5">{addonSeats} / {seatCap} add-on seats used</span>
          )}
        </div>

        {seatCap === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mt-3">
            <p className="text-sm font-semibold text-amber-900 mb-1">Seat add-ons not available on Solo</p>
            <p className="text-xs text-amber-700 mb-3">
              Solo is for individual owner-operators. Upgrade to Studio to add team members.
            </p>
            {nextPlanName && (
              <button onClick={openPortal} disabled={working} className="btn-primary text-xs">
                {working ? "…" : `Upgrade to ${nextPlanName} →`}
              </button>
            )}
          </div>
        ) : seatAtCap ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mt-3">
            <p className="text-sm font-semibold text-amber-900 mb-1">Seat expansion limit reached</p>
            <p className="text-xs text-amber-700 mb-3">
              Your {PLAN_NAMES[plan]} plan supports up to {seatCap} additional seats.
              {nextPlanName && ` ${nextPlanName} includes more built-in seats.`}
            </p>
            {nextPlanName && (
              <button onClick={openPortal} disabled={working} className="btn-primary text-xs">
                {working ? "…" : `Upgrade to ${nextPlanName} →`}
              </button>
            )}
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-3">
              $19/month per seat. Add photographers, videographers, admins, or managers.
              {seatCap !== null && ` Up to ${seatCap} additional seats on your current plan.`}
              {seatCap === null && " Unlimited seats on Scale."}
            </p>
            <button onClick={openPortal} disabled={working} className="btn-outline">
              {working ? "Loading…" : "Manage seats via portal →"}
            </button>
            {seatCap !== null && seatCap - addonSeats <= 1 && nextPlanName && (
              <p className="text-xs text-amber-600 mt-3">
                Approaching your seat limit. Upgrading to {nextPlanName} gives significantly more capacity.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Plan cards */}
      <div className="mb-5">
        <h2 className="font-semibold text-[#0F172A] text-sm mb-3">
          {subscribed ? "Your Plan" : "Choose a Plan"}
        </h2>
        <div className="space-y-2.5">
          {PLANS.map((p) => {
            const isCurrent = plan === p.id;
            const isOther   = subscribed && !isCurrent;
            return (
              <div key={p.id}
                className="flex items-center justify-between p-4 rounded-xl border transition-all"
                style={{
                  border: isCurrent ? "2px solid #0F172A" : "1px solid var(--border-subtle)",
                  background: isCurrent ? "rgb(15 23 42 / 0.03)" : isOther ? "var(--bg-subtle)" : "white",
                  opacity: isOther ? 0.65 : 1,
                }}>
                <div className="flex items-center gap-3">
                  {isCurrent && (
                    <span className="text-[10px] font-bold bg-[#0F172A] text-white px-2.5 py-1 rounded-full uppercase tracking-wide whitespace-nowrap">
                      Current
                    </span>
                  )}
                  <div>
                    <p className={`font-semibold text-sm ${isCurrent ? "text-[#0F172A]" : "text-gray-600"}`}>{p.name}</p>
                    <p className="text-xs text-gray-400">{p.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`text-sm font-bold ${isCurrent ? "text-[#0F172A]" : "text-gray-400"}`}>${p.price}/mo</span>
                  {isCurrent && subscribed && <span className="tag-green">Active</span>}
                  {isOther && subscribed && (
                    <button onClick={openPortal} disabled={working} className="btn-outline text-xs py-1.5">
                      {working ? "…" : "Upgrade via portal"}
                    </button>
                  )}
                  {!subscribed && (
                    <button onClick={() => subscribe(p.id)} disabled={working} className="btn-primary text-xs py-1.5">
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
      <div className="card">
        <h2 className="font-semibold text-[#0F172A] text-sm mb-4">Stripe Connect — Accept Payments</h2>
        {tenant?.stripeConnectOnboarded ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-emerald-700 text-sm">Stripe account connected</p>
              <p className="text-xs text-gray-400">Client payments flow directly to your bank account.</p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Connect your Stripe account to accept client deposits and balance payments directly through KyoriaOS.
            </p>
            <button onClick={startConnect} disabled={working} className="btn-primary">
              {working ? "Loading…" : "Connect Stripe Account"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
