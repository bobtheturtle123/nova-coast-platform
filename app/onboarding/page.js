"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const STEPS = ["Business", "Branding", "Services", "Payments"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step,   setStep]   = useState(0);
  const [user,   setUser]   = useState(null);
  const [tenant, setTenant] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  // ── Step state ─────────────────────────────────────────────────────────────
  const [business, setBusiness] = useState({ phone: "", fromZip: "", website: "" });
  const [branding, setBranding] = useState({ primaryColor: "#0b2a55", accentColor: "#c9a96e", tagline: "" });
  const [connectStarted, setConnectStarted] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/auth/login"); return; }
      const token = await u.getIdTokenResult();
      if (token.claims.tenantId) {
        // Already has tenant — check if they just need Connect
        setTenant({ id: token.claims.tenantId });
        setStep(3); // Jump to payments step
      }
      setUser(u);
    });
    return unsub;
  }, [router]);

  async function saveBusiness() {
    setSaving(true);
    setError("");
    try {
      // Force-refresh so custom claims (tenantId) are included
      const token = await user.getIdToken(true);
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: business.phone, fromZip: business.fromZip }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setStep(1);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBranding() {
    setSaving(true);
    setError("");
    try {
      const token = await user.getIdToken(true);
      await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ branding }),
      });
      setStep(2);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function startConnect() {
    setSaving(true);
    setError("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/connect/onboard", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Could not start Stripe Connect");
      }
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  function skipConnect() {
    router.push("/dashboard");
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-display text-navy text-lg tracking-wide">ShootFlow</span>
          <span className="text-xs text-gray-400">Setup ({step + 1} of {STEPS.length})</span>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex">
            {STEPS.map((s, i) => (
              <div key={s} className={`flex-1 py-4 text-center text-xs font-medium border-b-2 transition-colors
                ${i === step ? "border-navy text-navy" : i < step ? "border-gold text-gold" : "border-transparent text-gray-400"}`}>
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-sm mb-6">
            {error}
          </div>
        )}

        {/* STEP 0: Business details */}
        {step === 0 && (
          <div>
            <h1 className="font-display text-3xl text-navy mb-2">Tell us about your business</h1>
            <p className="text-gray-500 mb-8">This helps us set up travel fees and display your contact info.</p>

            <div className="bg-white rounded-sm border border-gray-200 p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">
                  Phone Number
                </label>
                <input type="tel" value={business.phone}
                  onChange={(e) => setBusiness((b) => ({ ...b, phone: e.target.value }))}
                  className="input-field w-full" placeholder="(555) 555-5555" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">
                  Home Base ZIP Code
                </label>
                <input type="text" value={business.fromZip}
                  onChange={(e) => setBusiness((b) => ({ ...b, fromZip: e.target.value }))}
                  className="input-field w-full" placeholder="92108" maxLength={5} />
                <p className="text-xs text-gray-400 mt-1">Used to calculate travel fees for distant shoots.</p>
              </div>
            </div>

            <button onClick={saveBusiness} disabled={saving} className="btn-primary mt-6 px-8 py-3">
              {saving ? "Saving…" : "Continue"}
            </button>
          </div>
        )}

        {/* STEP 1: Branding */}
        {step === 1 && (
          <div>
            <h1 className="font-display text-3xl text-navy mb-2">Customize your branding</h1>
            <p className="text-gray-500 mb-8">Your booking page will use these colors and tagline.</p>

            <div className="bg-white rounded-sm border border-gray-200 p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">
                  Tagline
                </label>
                <input type="text" value={branding.tagline}
                  onChange={(e) => setBranding((b) => ({ ...b, tagline: e.target.value }))}
                  className="input-field w-full" placeholder="Professional real estate photography" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">
                    Primary Color
                  </label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={branding.primaryColor}
                      onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                      className="w-10 h-10 rounded cursor-pointer border border-gray-200" />
                    <input type="text" value={branding.primaryColor}
                      onChange={(e) => setBranding((b) => ({ ...b, primaryColor: e.target.value }))}
                      className="input-field flex-1 font-mono text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">
                    Accent Color
                  </label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={branding.accentColor}
                      onChange={(e) => setBranding((b) => ({ ...b, accentColor: e.target.value }))}
                      className="w-10 h-10 rounded cursor-pointer border border-gray-200" />
                    <input type="text" value={branding.accentColor}
                      onChange={(e) => setBranding((b) => ({ ...b, accentColor: e.target.value }))}
                      className="input-field flex-1 font-mono text-sm" />
                  </div>
                </div>
              </div>

              {/* Live preview */}
              <div className="mt-4 rounded-sm overflow-hidden border border-gray-200">
                <div style={{ background: branding.primaryColor }} className="px-4 py-3">
                  <span style={{ color: branding.accentColor }} className="font-display text-sm tracking-widest uppercase">
                    Your Business Name
                  </span>
                </div>
                <div className="px-4 py-3 bg-white text-xs text-gray-500">
                  {branding.tagline || "Your tagline appears here"}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(0)} className="btn-outline px-6 py-3">Back</button>
              <button onClick={saveBranding} disabled={saving} className="btn-primary px-8 py-3">
                {saving ? "Saving…" : "Continue"}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Services note */}
        {step === 2 && (
          <div>
            <h1 className="font-display text-3xl text-navy mb-2">Your services are ready</h1>
            <p className="text-gray-500 mb-8">We've pre-loaded standard real estate photography services and packages. You can customize prices anytime from your dashboard.</p>

            <div className="bg-white rounded-sm border border-gray-200 p-6">
              <h3 className="font-display text-navy text-sm uppercase tracking-wider mb-4">Default Packages</h3>
              <div className="space-y-3">
                {[
                  { name: "Core", price: "$299", desc: "Photography — 25–35 edited photos" },
                  { name: "Growth", price: "$449", desc: "Photography + Drone" },
                  { name: "Signature", price: "$649", desc: "Photography + Drone + Listing Video" },
                ].map((p) => (
                  <div key={p.name} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-navy">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.desc}</p>
                    </div>
                    <span className="text-sm font-semibold text-navy">{p.price}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4">Edit these anytime in Dashboard → Settings → Services.</p>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(1)} className="btn-outline px-6 py-3">Back</button>
              <button onClick={() => setStep(3)} className="btn-primary px-8 py-3">Continue</button>
            </div>
          </div>
        )}

        {/* STEP 3: Stripe Connect */}
        {step === 3 && (
          <div>
            <h1 className="font-display text-3xl text-navy mb-2">Connect your Stripe account</h1>
            <p className="text-gray-500 mb-8">
              Connect Stripe so client deposits and balance payments go directly to your bank account.
              We take a 1.5% platform fee per transaction.
            </p>

            <div className="bg-white rounded-sm border border-gray-200 p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center flex-shrink-0 text-lg">
                  ⚡
                </div>
                <div>
                  <p className="font-medium text-navy text-sm">Instant payouts to your bank</p>
                  <p className="text-xs text-gray-400 mt-0.5">Stripe deposits funds directly to your account — no manual transfers.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0 text-lg">
                  🔒
                </div>
                <div>
                  <p className="font-medium text-navy text-sm">PCI-compliant and secure</p>
                  <p className="text-xs text-gray-400 mt-0.5">Stripe handles all card data. You never touch sensitive payment info.</p>
                </div>
              </div>
            </div>

            <button onClick={startConnect} disabled={saving}
              className="btn-primary w-full py-4 mt-6 text-base">
              {saving ? "Redirecting to Stripe…" : "Connect Stripe Account"}
            </button>

            <button onClick={skipConnect}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-4 transition-colors">
              Skip for now — I'll connect Stripe later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
