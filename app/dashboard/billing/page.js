"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { isDemo, getDemoBilling } from "@/lib/demoData";

const PLANS = [
  { id: "solo",   name: "Solo",   price: 49,  desc: "125 listings / year · 1 team member",   tagline: "Solo real estate media photographers" },
  { id: "studio", name: "Studio", price: 99,  desc: "300 listings / year · 3 team members",  tagline: "Small teams & growing media businesses" },
  { id: "pro",    name: "Pro",    price: 179, desc: "600 listings / year · 5 team members",  tagline: "Growing teams with higher volume" },
  { id: "scale",  name: "Scale",  price: 349, desc: "1,000 listings / year · 10 team members", tagline: "High-volume media teams" },
];

const PLAN_NAMES  = { solo: "Solo", studio: "Studio", pro: "Pro", scale: "Scale", starter: "Solo" };
const PLAN_PRICES = { solo: 49, studio: 99, pro: 179, scale: 349, starter: 49 };
const PLAN_LIMITS = { solo: 125, studio: 300, pro: 600, scale: 1000, starter: 125 };

// Per-plan expansion caps — null means unlimited (Scale)
const ADDON_CAPS = {
  solo:   { extraSeats: 0,    topupListings: 50  },
  studio: { extraSeats: 3,    topupListings: 100 },
  pro:    { extraSeats: 8,    topupListings: 200 },
  scale:  { extraSeats: null, topupListings: null },
};
const NEXT_PLAN_NAME = { solo: "Studio", studio: "Pro", pro: "Scale", scale: null };
const PLAN_ORDER     = { solo: 0, starter: 0, studio: 1, pro: 2, scale: 3 };

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
  const [loading,       setLoading]      = useState(true);
  const [working,       setWorking]      = useState(false);
  const [msg,           setMsg]          = useState({ text: "", type: "error" });
  const [cancelStep,      setCancelStep]     = useState(null); // null | "feedback" | "discount"
  const [cancelReason,    setCancelReason]   = useState("");
  const [cancelNote,      setCancelNote]     = useState("");
  const [discountSaving,  setDiscountSaving] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState(null); // { planId, seatBlock }
  const [upgradeTarget,   setUpgradeTarget]   = useState(null); // { planId }
  const [agentProWorking, setAgentProWorking] = useState(false);
  const [isOwner,       setIsOwner]      = useState(true); // staff admins cannot manage billing
  const [seatTarget,    setSeatTarget]   = useState(null); // desired total add-on seats (selector)

  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("subscribed") === "true") {
      setMsg({ text: "You're subscribed! Welcome aboard. Your plan is now active.", type: "success" });
    }
    if (searchParams.get("topup") === "success") {
      setMsg({ text: "Listing credits added successfully. Your balance has been updated.", type: "success" });
    }
    if (searchParams.get("agentpro") === "success") {
      setMsg({ text: "Agent Pro is now active. All your agents can access Pro features.", type: "success" });
    }
  }, [searchParams]);

  useEffect(() => {
    if (isDemo()) {
      const d = getDemoBilling();
      setTenant(d.tenant);
      setListingsThisYear(d.listingsThisYear);
      setTeamMemberCount(d.teamMemberCount);
      setLoading(false);
      return;
    }
    auth.currentUser?.getIdTokenResult().then(async (result) => {
      // Manager/staff cannot manage billing; admin and owner can.
      const role = result.claims.role;
      if (role === "manager" || role === "staff") setIsOwner(false);

      const token = result.token;
      const [tenantRes, statsRes, teamRes] = await Promise.all([
        fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/stats",  { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/team",   { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      let tenantData = null;
      if (tenantRes.ok) { const data = await tenantRes.json(); tenantData = data.tenant; }
      if (statsRes.ok)  { const data = await statsRes.json();  setListingsThisYear(data.stats?.listingsThisYear || 0); }
      if (teamRes.ok)   { const data = await teamRes.json();   setTeamMemberCount(data.members?.length || 0); }

      // If no subscription recorded but we have a Stripe customer, sync from Stripe to recover
      // missed webhooks before rendering the billing UI (prevents showing "Get started" for already-paid users).
      if (tenantData && !tenantData.stripeSubscriptionId && !tenantData.permanentPlan && tenantData.stripeCustomerId) {
        try {
          const syncRes = await fetch("/api/billing/sync", { headers: { Authorization: `Bearer ${token}` } });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            if (syncData.synced) {
              const refreshed = await fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${token}` } });
              if (refreshed.ok) { const d = await refreshed.json(); tenantData = d.tenant || tenantData; }
            }
          }
        } catch {}
      }

      setTenant(tenantData);
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

  async function updateSeats(quantity) {
    setWorking(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/billing/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ quantity }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Could not update seats."); return; }
      setTenant((t) => ({ ...t, addonSeats: data.addonSeats }));
      setSeatTarget(data.addonSeats);
      setMsg({
        text: data.charged
          ? "Seats added — your card on file was charged the prorated amount."
          : "Seats updated. The lower amount applies from your next billing cycle (no refund for the current month).",
        type: "success",
      });
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

  async function subscribeAgentPro() {
    setAgentProWorking(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/billing/agent-pro", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.error || "Could not start Agent Pro checkout.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setAgentProWorking(false);
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

  const plan       = tenant?.permanentPlan || tenant?.subscriptionPlan || "starter";
  const status     = tenant?.subscriptionStatus || "inactive";
  const cancelAtPeriodEnd = !!tenant?.cancelAtPeriodEnd;
  // A canceled/inactive subscription is no longer a live membership, even if a
  // Stripe subscription id lingers on the tenant record.
  const isCanceled = status === "canceled" || status === "inactive";
  const subscribed = !!tenant?.stripeSubscriptionId && !isCanceled;

  function formatRenewalDate(raw) {
    if (!raw) return null;
    const d = raw?.seconds ? new Date(raw.seconds * 1000) : new Date(raw);
    return isNaN(d) ? null : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  const renewalDateStr = formatRenewalDate(tenant?.subscriptionRenewalAt);

  const agentProActive       = !!(tenant?.agentProActive);
  const agentProSubStatus    = tenant?.agentProSubscriptionStatus || null;

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
  const BASE_SEATS     = { solo: 1, studio: 3, pro: 5, scale: 10, starter: 1 };
  const baseSeatLimit  = Object.prototype.hasOwnProperty.call(BASE_SEATS, plan) ? BASE_SEATS[plan] : 1;
  const totalSeats     = baseSeatLimit === null ? null : baseSeatLimit + addonSeats;
  const seatsUsed      = teamMemberCount + 1; // +1 for owner
  const seatPct        = totalSeats === null ? 0 : Math.min(100, Math.round((seatsUsed / totalSeats) * 100));

  async function changePlan(targetPlanId) {
    setWorking(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: targetPlanId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ text: `Plan changed to ${PLAN_NAMES[targetPlanId]}. Proration applied automatically.`, type: "success" });
        setTenant((t) => t ? { ...t, subscriptionPlan: targetPlanId } : t);
      } else {
        setError(data.error || "Could not change plan.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setWorking(false);
    }
  }

  function handlePlanChange(targetPlanId) {
    const fromOrder = PLAN_ORDER[plan] ?? 0;
    const toOrder   = PLAN_ORDER[targetPlanId] ?? 0;
    // Upgrades go straight through (or show an upsell) — never the "you'll lose
    // access" downgrade warning. Show the upsell modal so they see what they gain.
    if (toOrder > fromOrder) {
      setUpgradeTarget({ planId: targetPlanId });
      return;
    }
    const targetSeats = BASE_SEATS[targetPlanId];
    if (toOrder < fromOrder && targetSeats !== null && seatsUsed > targetSeats) {
      setDowngradeTarget({ planId: targetPlanId, seatBlock: true });
      return;
    }
    // Genuine downgrade.
    setDowngradeTarget({ planId: targetPlanId, seatBlock: false });
  }

  async function submitCancelFeedback(applyDiscount) {
    setDiscountSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/billing/cancel-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: cancelReason, note: cancelNote, applyDiscount }),
      });
      const data = await res.json().catch(() => ({}));
      if (applyDiscount) {
        if (data.discountApplied) {
          // Reflect the active discount immediately so it's clearly visible.
          setTenant((t) => ({ ...(t || {}), retentionDiscount: { active: true, amountOffCents: 2000, months: 3, appliedAt: new Date().toISOString() } }));
          setMsg({ text: "Discount applied: $20/month off your next 3 invoices. You'll see it on your billing page below.", type: "success" });
        } else {
          setMsg({ text: "This discount has already been used on your account.", type: "error" });
        }
        setCancelStep(null); setCancelReason(""); setCancelNote("");
      } else {
        setCancelStep(null); setCancelReason(""); setCancelNote("");
        openPortal();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setDiscountSaving(false);
    }
  }

  const msgStyles = {
    success: "bg-green-50 border border-green-300 text-green-800",
    error:   "bg-red-50 border border-red-300 text-red-800",
    config:  "bg-amber-50 border border-amber-300 text-amber-900",
  };

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="page-title mb-1">Billing</h1>
      <p className="page-subtitle mb-8">Manage your subscription and payment settings.</p>

      {/* Active retention discount — persistent so the tenant can confirm it worked.
          Hidden once the (repeating, N-month) discount has run its course. */}
      {tenant?.retentionDiscount?.active && (() => {
        const r = tenant.retentionDiscount;
        const appliedMs = r.appliedAt ? new Date(r.appliedAt).getTime() : Date.now();
        const expiresMs = appliedMs + (r.months || 3) * 31 * 24 * 60 * 60 * 1000;
        return Date.now() < expiresMs;
      })() && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" className="flex-shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              ${((tenant.retentionDiscount.amountOffCents || 2000) / 100).toFixed(0)}/month discount active
              {tenant.retentionDiscount.months ? ` for ${tenant.retentionDiscount.months} months` : ""}
            </p>
            <p className="text-xs text-emerald-700">
              Applied{tenant.retentionDiscount.appliedAt ? ` ${new Date(tenant.retentionDiscount.appliedAt).toLocaleDateString()}` : ""}. It comes off your next {tenant.retentionDiscount.months || 3} invoices automatically.
            </p>
          </div>
        </div>
      )}

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
              status === "past_due" ? "bg-red-50 text-red-700"         :
              "bg-gray-100 text-gray-600"}`}>
            {status}
          </span>
        </div>


        {status === "active" && renewalDateStr && (
          <p className="text-xs text-gray-400 mt-3">
            Renews <span className="font-medium text-gray-600">{renewalDateStr}</span>
          </p>
        )}
        {status === "past_due" && (
          <p className="text-xs text-red-600 mt-3 font-medium">
            Payment past due — update your payment method to avoid service interruption.
          </p>
        )}

        {!isOwner && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            Billing is managed by the account owner. Contact them to make changes.
          </p>
        )}
        {cancelAtPeriodEnd && subscribed && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            Your membership is set to cancel{renewalDateStr ? ` on ${renewalDateStr}` : " at the end of this billing period"}. You&apos;ll keep access until then. Use “Manage subscription” to resume it.
          </p>
        )}
        {subscribed ? (
          <div className="flex flex-wrap gap-2 mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            {isOwner && !isDemo() && (
              <>
                <button onClick={openPortal} disabled={working} className="btn-outline">
                  {working ? "Loading…" : "Manage subscription →"}
                </button>
                {/* Only offer the cancel/retention flow on a live membership that
                    isn't already scheduled to cancel. */}
                {!cancelAtPeriodEnd && (
                  <button onClick={() => setCancelStep("feedback")} disabled={working}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-[13px] font-medium hover:bg-red-50 transition-colors disabled:opacity-50">
                    Cancel subscription
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-400 mt-3">
            {isCanceled && tenant?.stripeSubscriptionId
              ? "Your membership is canceled. Select a plan below to reactivate."
              : "No active subscription. Select a plan below to get started."}
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
              <button onClick={() => changePlan(Object.keys(PLAN_ORDER).find((k) => PLAN_ORDER[k] === (PLAN_ORDER[plan] ?? 0) + 1))} disabled={working} className="btn-primary text-xs">
                {working ? "…" : `Upgrade to ${nextPlanName} →`}
              </button>
            )}
          </div>
        ) : (
          (() => {
            const availablePacks = plan === "scale" ? TOPUP_PACKS.filter((t) => t.credits >= 50) : TOPUP_PACKS;
            return (
          <div className={`grid gap-3 ${availablePacks.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {availablePacks.map((t) => {
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
            );
          })()
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
              <button onClick={() => changePlan("studio")} disabled={working} className="btn-primary text-xs">
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
              <button onClick={() => changePlan(Object.keys(PLAN_ORDER).find((k) => PLAN_ORDER[k] === (PLAN_ORDER[plan] ?? 0) + 1))} disabled={working} className="btn-primary text-xs">
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
            {(() => {
              const max     = seatCap === null ? 50 : seatCap;
              const target  = seatTarget ?? addonSeats;
              const changed = target !== addonSeats;
              return (
                <>
                  <div className="flex items-center gap-4 mb-3 flex-wrap">
                    <div className="inline-flex items-center rounded-lg border border-gray-200 overflow-hidden">
                      <button onClick={() => setSeatTarget(Math.max(0, target - 1))} disabled={working || target <= 0}
                        className="px-3.5 py-2 text-lg leading-none text-gray-600 hover:bg-gray-50 disabled:opacity-30">−</button>
                      <span className="px-4 py-2 text-sm font-semibold text-[#0F172A] min-w-[3rem] text-center border-x border-gray-200">{target}</span>
                      <button onClick={() => setSeatTarget(Math.min(max, target + 1))} disabled={working || target >= max}
                        className="px-3.5 py-2 text-lg leading-none text-gray-600 hover:bg-gray-50 disabled:opacity-30">+</button>
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold text-[#0F172A]">{target} add-on seat{target !== 1 ? "s" : ""}</p>
                      <p className="text-xs text-gray-400">${target * 19}/mo{addonSeats !== target ? ` · currently ${addonSeats}` : ""}</p>
                    </div>
                  </div>
                  {changed && (
                    <button onClick={() => updateSeats(target)} disabled={working} className="btn-primary text-xs">
                      {working
                        ? "Updating…"
                        : target > addonSeats
                          ? `Add ${target - addonSeats} seat${target - addonSeats !== 1 ? "s" : ""} — charge card now`
                          : `Reduce to ${target} seat${target !== 1 ? "s" : ""}`}
                    </button>
                  )}
                  {changed && target < addonSeats && (
                    <p className="text-xs text-gray-400 mt-2">
                      Removing seats won&apos;t refund the current month — the lower price starts next billing cycle.
                    </p>
                  )}
                </>
              );
            })()}
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
            const isCurrent  = plan === p.id;
            const isOther    = subscribed && !isCurrent;
            const isUpgrade  = subscribed && PLAN_ORDER[p.id] > PLAN_ORDER[plan];
            const isNextTier = subscribed && PLAN_ORDER[p.id] === (PLAN_ORDER[plan] ?? 0) + 1;
            return (
              <div key={p.id}
                className="flex items-center justify-between p-4 rounded-xl border transition-all"
                style={{
                  border: isCurrent ? "2px solid #0F172A" : isNextTier ? "2px solid #3486cf" : "1px solid var(--border-subtle)",
                  background: isCurrent ? "rgb(15 23 42 / 0.03)" : isNextTier ? "rgba(52,134,207,0.05)" : isOther && !isUpgrade ? "var(--bg-subtle)" : "white",
                  // Only dim downgrade options — keep upgrades fully legible/enticing.
                  opacity: isOther && !isUpgrade ? 0.6 : 1,
                }}>
                <div className="flex items-center gap-3">
                  {isCurrent && (
                    <span className="text-[10px] font-bold bg-[#0F172A] text-white px-2.5 py-1 rounded-full uppercase tracking-wide whitespace-nowrap">
                      Current
                    </span>
                  )}
                  {isNextTier && (
                    <span className="text-[10px] font-bold text-white px-2.5 py-1 rounded-full uppercase tracking-wide whitespace-nowrap" style={{ background: "#3486cf" }}>
                      Recommended
                    </span>
                  )}
                  <div>
                    <p className={`font-semibold text-sm ${isCurrent ? "text-[#0F172A]" : "text-gray-600"}`}>{p.name}</p>
                    {p.tagline && <p className="text-[11px] text-[#3486cf] font-medium">{p.tagline}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{p.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`text-sm font-bold ${isCurrent ? "text-[#0F172A]" : "text-gray-400"}`}>${p.price}<span className="text-xs font-normal">/mo</span></span>
                  {isCurrent && subscribed && <span className="tag-green">Active</span>}
                  {isOther && subscribed && isOwner && (
                    PLAN_ORDER[p.id] > PLAN_ORDER[plan] ? (
                      <button onClick={() => handlePlanChange(p.id)} disabled={working}
                        className="text-xs font-semibold py-2 px-4 rounded-lg text-white shadow-sm hover:shadow-md hover:-translate-y-px transition-all disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #3486cf 0%, #5ba8e5 100%)" }}>
                        {working ? "…" : "Upgrade →"}
                      </button>
                    ) : (
                      <button onClick={() => handlePlanChange(p.id)} disabled={working} className="btn-outline text-xs py-1.5">
                        {working ? "…" : "Downgrade"}
                      </button>
                    )
                  )}
                  {!subscribed && (
                    <button onClick={() => subscribe(p.id)} disabled={working} className="btn-primary text-xs py-1.5">
                      {working ? "…" : "Get started"}
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

      {/* Cancel modal — multi-step churn prevention */}
      {cancelStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => { setCancelStep(null); setCancelReason(""); setCancelNote(""); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}>

            {cancelStep === "feedback" && (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-amber-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0F172A] text-[15px]">Before you go...</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Help us understand why you&apos;re leaving</p>
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5">
                  <p className="text-xs font-semibold text-amber-800 mb-1.5">What happens when you cancel</p>
                  <ul className="text-xs text-amber-700 space-y-1 list-disc pl-4">
                    <li>You won&apos;t be able to take new orders or create new bookings.</li>
                    <li>Your public booking page and agent portal stop accepting new work.</li>
                    <li>You keep access until the end of your current billing period.</li>
                    <li>Existing galleries and delivered listings stay available to your clients.</li>
                    <li>You can resubscribe anytime to pick back up where you left off.</li>
                  </ul>
                </div>
                <div className="space-y-4 mb-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">What&apos;s the main reason?</label>
                    <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                      className="input-field w-full text-sm">
                      <option value="">Select a reason…</option>
                      <option value="too_expensive">Too expensive</option>
                      <option value="not_using">Not using it enough</option>
                      <option value="missing_features">Missing features I need</option>
                      <option value="switching">Switching to another tool</option>
                      <option value="business_closed">Closing my business</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Anything else you&apos;d like us to know?</label>
                    <textarea value={cancelNote} onChange={(e) => setCancelNote(e.target.value)}
                      rows={3} placeholder="Optional feedback…"
                      className="input-field w-full text-sm resize-none" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setCancelStep(null); setCancelReason(""); setCancelNote(""); }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Stay on KyoriaOS
                  </button>
                  <button
                    onClick={() => {
                      if (!cancelReason) return;
                      if (tenant?.churnDiscountOffered) { submitCancelFeedback(false); } else { setCancelStep("discount"); }
                    }}
                    disabled={!cancelReason}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-semibold hover:bg-gray-900 transition-colors disabled:opacity-40">
                    Continue →
                  </button>
                </div>
              </>
            )}

            {cancelStep === "discount" && (
              <>
                <div className="text-center mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-emerald-600">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-[#0F172A] text-lg">Here&apos;s a deal just for you</h3>
                  <p className="text-sm text-gray-500 mt-1">We&apos;d love to keep you around.</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-5 text-center">
                  <p className="text-3xl font-bold text-emerald-700 mb-1">$20<span className="text-lg font-normal text-emerald-600">/month off</span></p>
                  <p className="text-sm text-emerald-700 font-medium">for your next 3 months</p>
                  <p className="text-xs text-emerald-600 mt-2 opacity-75">One-time offer · applied automatically · no commitment required</p>
                </div>
                <div className="flex flex-col gap-2.5">
                  <button onClick={() => submitCancelFeedback(true)} disabled={discountSaving}
                    className="w-full px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                    {discountSaving ? "Applying…" : "Accept $20/month off →"}
                  </button>
                  <button onClick={() => submitCancelFeedback(false)} disabled={discountSaving}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-40">
                    {discountSaving ? "…" : "No thanks, cancel anyway"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Downgrade warning / seat-block modal */}
      {downgradeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setDowngradeTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}>

            {downgradeTarget.seatBlock ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-red-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0F172A] text-[15px]">Can&apos;t downgrade yet</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Too many team members for {PLAN_NAMES[downgradeTarget.planId]}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  The <strong>{PLAN_NAMES[downgradeTarget.planId]}</strong> plan supports <strong>{BASE_SEATS[downgradeTarget.planId]} seat{BASE_SEATS[downgradeTarget.planId] !== 1 ? "s" : ""}</strong>, but you currently have <strong>{seatsUsed} seat{seatsUsed !== 1 ? "s" : ""} in use</strong> (including yourself).
                </p>
                <p className="text-sm text-gray-500 mb-5">
                  Remove <strong>{seatsUsed - BASE_SEATS[downgradeTarget.planId]} team member{(seatsUsed - BASE_SEATS[downgradeTarget.planId]) !== 1 ? "s" : ""}</strong> from the Team page before downgrading.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setDowngradeTarget(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Close
                  </button>
                  <a href="/dashboard/team"
                    className="flex-1 text-center px-4 py-2.5 rounded-xl bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1e293b] transition-colors">
                    Go to Team page →
                  </a>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-amber-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#0F172A] text-[15px]">Downgrade to {PLAN_NAMES[downgradeTarget.planId]}?</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Review what you&apos;ll lose</p>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-2.5">You&apos;ll lose access to:</p>
                  <ul className="space-y-1.5">
                    {(() => {
                      const losses = [];
                      const fromLimit = PLAN_LIMITS[plan] || 120;
                      const toLimit   = PLAN_LIMITS[downgradeTarget.planId] || 120;
                      if (fromLimit > toLimit) {
                        losses.push(`${fromLimit.toLocaleString()} → ${toLimit.toLocaleString()} listing credits per year`);
                      }
                      const fromSeats = BASE_SEATS[plan];
                      const toSeats   = BASE_SEATS[downgradeTarget.planId];
                      if (fromSeats !== null && toSeats !== null && fromSeats > toSeats) {
                        losses.push(`Team seats: ${fromSeats} → ${toSeats} (extra members will lose access)`);
                      }
                      const FEE_PCT = { solo: 2.0, starter: 2.0, studio: 2.0, pro: 1.5, scale: 1.25 };
                      if ((FEE_PCT[plan] || 2.0) < (FEE_PCT[downgradeTarget.planId] || 2.0)) {
                        losses.push(`Platform fee: ${FEE_PCT[plan]}% → ${FEE_PCT[downgradeTarget.planId]}% per transaction`);
                      }
                      if (losses.length === 0) losses.push("Lower listing credits and feature limits apply");
                      return losses.map((l, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0 mt-1" />
                          {l}
                        </li>
                      ));
                    })()}
                  </ul>
                </div>
                <p className="text-xs text-gray-400 mb-5">Changes take effect at the end of your current billing period.</p>
                <div className="flex gap-3">
                  <button onClick={() => setDowngradeTarget(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                    Stay on {PLAN_NAMES[plan]}
                  </button>
                  <button onClick={() => { setDowngradeTarget(null); changePlan(downgradeTarget.planId); }} disabled={working}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
                    {working ? "Loading…" : `Downgrade to ${PLAN_NAMES[downgradeTarget.planId]} →`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Upgrade upsell modal */}
      {upgradeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setUpgradeTarget(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#3486cf]/10 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-[#3486cf]">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-[#0F172A] text-[15px]">Upgrade to {PLAN_NAMES[upgradeTarget.planId]}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Here&apos;s what you unlock</p>
              </div>
            </div>
            <div className="bg-[#3486cf]/5 border border-[#3486cf]/20 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-[#1E5A8A] uppercase tracking-wide mb-2.5">You&apos;ll gain:</p>
              <ul className="space-y-1.5">
                {(() => {
                  const gains = [];
                  const fromLimit = PLAN_LIMITS[plan] || 120;
                  const toLimit   = PLAN_LIMITS[upgradeTarget.planId] || 120;
                  if (toLimit > fromLimit) gains.push(`${fromLimit.toLocaleString()} → ${toLimit.toLocaleString()} listing credits per year`);
                  const fromSeats = BASE_SEATS[plan];
                  const toSeats   = BASE_SEATS[upgradeTarget.planId];
                  if (fromSeats !== null && toSeats !== null && toSeats > fromSeats) gains.push(`Team seats: ${fromSeats} → ${toSeats}`);
                  const FEE_PCT = { solo: 2.0, starter: 2.0, studio: 1.5, pro: 1.25, scale: 1.0 };
                  if ((FEE_PCT[upgradeTarget.planId] || 2.0) < (FEE_PCT[plan] || 2.0)) gains.push(`Lower platform fee: ${FEE_PCT[plan]}% → ${FEE_PCT[upgradeTarget.planId]}% per transaction`);
                  if (gains.length === 0) gains.push("Higher limits and more features");
                  return gains.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[#1E5A8A]">
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0 mt-px text-[#3486cf]"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      {g}
                    </li>
                  ));
                })()}
              </ul>
            </div>
            <p className="text-xs text-gray-400 mb-5">Upgrade is prorated — you&apos;re only charged the difference for the rest of this billing period.</p>
            <div className="flex gap-3">
              <button onClick={() => setUpgradeTarget(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Not now
              </button>
              <button onClick={() => { const id = upgradeTarget.planId; setUpgradeTarget(null); changePlan(id); }} disabled={working}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#3486cf] text-white text-sm font-semibold hover:bg-[#2a6dab] transition-colors disabled:opacity-50">
                {working ? "Loading…" : `Upgrade to ${PLAN_NAMES[upgradeTarget.planId]} →`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
