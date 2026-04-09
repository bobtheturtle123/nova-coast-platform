"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

const PLAN_NAMES = { starter: "Starter", pro: "Professional", agency: "Agency" };
const PLAN_PRICES = { starter: 49, pro: 99, agency: 199 };

export default function BillingPage() {
  const [tenant,  setTenant]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [msg,     setMsg]     = useState("");

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch("/api/dashboard/tenant", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTenant(data.tenant);
      }
      setLoading(false);
    });
  }, []);

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
      else setMsg(data.error || "Could not open billing portal.");
    } catch {
      setMsg("Something went wrong.");
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
      else setMsg(data.error || "Could not start checkout.");
    } catch {
      setMsg("Something went wrong.");
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
      else setMsg(data.error || "Could not start Stripe Connect.");
    } catch {
      setMsg("Something went wrong.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );

  const plan = tenant?.subscriptionPlan || "starter";
  const status = tenant?.subscriptionStatus || "trialing";

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display text-2xl text-navy mb-2">Billing</h1>
      <p className="text-gray-500 text-sm mb-8">Manage your subscription and payment settings.</p>

      {msg && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-2 rounded-sm mb-6">
          {msg}
        </div>
      )}

      {/* Current plan */}
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
            Trial ends {new Date(tenant.trialEndsAt?.seconds ? tenant.trialEndsAt.seconds * 1000 : tenant.trialEndsAt).toLocaleDateString()}
          </p>
        )}
        {tenant?.stripeSubscriptionId && (
          <button onClick={openPortal} disabled={working}
            className="btn-outline text-sm px-4 py-2 mt-4">
            {working ? "Loading…" : "Manage subscription →"}
          </button>
        )}
        {!tenant?.stripeSubscriptionId && (
          <p className="text-xs text-gray-400 mt-2">No active subscription. Select a plan below to get started after your trial.</p>
        )}
      </div>

      {/* Plan options */}
      {!tenant?.stripeSubscriptionId && (
        <div className="space-y-3 mb-6">
          <h2 className="font-display text-navy text-base">Choose a Plan</h2>
          {[
            { id: "starter", name: "Starter", price: 49, desc: "Up to 30 bookings/month · 1 team member" },
            { id: "pro",     name: "Professional", price: 99, desc: "Up to 150 bookings/month · 5 team members · Custom domain" },
            { id: "agency",  name: "Agency", price: 199, desc: "Unlimited bookings · 25 team members · White-label" },
          ].map((p) => (
            <div key={p.id} className={`flex items-center justify-between p-4 rounded-sm border
              ${plan === p.id ? "border-navy bg-navy/5" : "border-gray-200 bg-white"}`}>
              <div>
                <p className="font-medium text-navy text-sm">{p.name}</p>
                <p className="text-xs text-gray-500">{p.desc}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-navy">${p.price}/mo</span>
                <button onClick={() => subscribe(p.id)} disabled={working}
                  className="btn-primary text-xs px-3 py-1.5">
                  {working ? "…" : "Subscribe"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
