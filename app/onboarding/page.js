"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";

const STEPS = [
  { id: "business",  label: "Business",    icon: "🏢" },
  { id: "stripe",    label: "Payments",    icon: "💳" },
  { id: "team",      label: "Invite Team", icon: "👥" },
  { id: "areas",     label: "Service Areas", icon: "🗺️" },
  { id: "done",      label: "Go Live",     icon: "🚀" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step,   setStep]   = useState(0);
  const [user,   setUser]   = useState(null);
  const [tenant, setTenant] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  // Step state
  const [business,    setBusiness]    = useState({ phone: "", fromZip: "" });
  const [inviteEmails, setInviteEmails] = useState([""]);
  const [inviteSent, setInviteSent] = useState(false);
  const [slug, setSlug] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/auth/login"); return; }
      const token = await u.getIdTokenResult();
      if (token.claims.tenantId) {
        setTenant({ id: token.claims.tenantId });
      }
      setUser(u);

      // Load slug for booking URL preview
      const idToken = await u.getIdToken();
      const res = await fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${idToken}` } });
      if (res.ok) {
        const d = await res.json();
        if (d.tenant?.slug) setSlug(d.tenant.slug);
        // Only skip ahead if they've already saved business info (returning user)
        if (d.tenant?.phone && step === 0) setStep(1);
      }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function next() { setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
  function prev() { setStep((s) => Math.max(s - 1, 0)); }
  function skip() { next(); }

  async function saveBusiness() {
    setSaving(true); setError("");
    try {
      const token = await user.getIdToken(true);
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ phone: business.phone, fromZip: business.fromZip }),
      });
      if (!res.ok) throw new Error("Failed to save");
      next();
    } catch { setError("Failed to save. Please try again."); }
    finally { setSaving(false); }
  }

  async function startConnect() {
    setSaving(true); setError("");
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/connect/onboard", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || "Could not start Stripe Connect");
    } catch (err) { setError(err.message); setSaving(false); }
  }

  async function sendTeamInvites() {
    const validEmails = inviteEmails.filter((e) => e.trim() && e.includes("@"));
    if (!validEmails.length) { next(); return; }
    setSaving(true);
    const token = await user.getIdToken();
    await Promise.all(validEmails.map((email) =>
      fetch("/api/dashboard/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim() }),
      })
    ));
    setInviteSent(true);
    setSaving(false);
    setTimeout(() => next(), 1200);
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
      </div>
    );
  }

  const currentStep = STEPS[step];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 py-4 px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-display text-navy text-lg tracking-wide">ShootFlow</span>
          <Link href="/dashboard" className="text-xs text-gray-400 hover:text-navy transition-colors">
            Skip setup → Go to dashboard
          </Link>
        </div>
      </header>

      {/* Progress bar */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-6">
          <div className="flex">
            {STEPS.map((s, i) => (
              <div key={s.id} className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                i === step ? "border-navy text-navy" : i < step ? "border-green-400 text-green-600" : "border-transparent text-gray-300"
              }`}>
                <span className="text-lg block">{s.icon}</span>
                <span className="text-[10px] font-medium hidden sm:block mt-0.5">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-sm mb-6">{error}</div>
        )}

        {/* ── STEP 0: Business ───────────────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <h1 className="font-display text-3xl text-navy mb-2">Welcome to ShootFlow</h1>
            <p className="text-gray-500 mb-6">Let's get a few basics in place so we can configure your account correctly.</p>
            <div className="bg-white rounded-sm border border-gray-200 p-6 space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">Phone Number</label>
                <input type="tel" value={business.phone}
                  onChange={(e) => setBusiness((b) => ({ ...b, phone: e.target.value }))}
                  className="input-field w-full" placeholder="(555) 555-5555" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 uppercase tracking-wide mb-1.5">Home Base ZIP Code</label>
                <input type="text" value={business.fromZip}
                  onChange={(e) => setBusiness((b) => ({ ...b, fromZip: e.target.value }))}
                  className="input-field w-full" placeholder="92108" maxLength={5} />
                <p className="text-xs text-gray-400 mt-1">Used to calculate travel fees for distant shoots.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveBusiness} disabled={saving} className="btn-primary px-8 py-3 flex-1">
                {saving ? "Saving…" : "Continue →"}
              </button>
              <button onClick={skip} className="btn-outline px-6 py-3 text-gray-400">Skip</button>
            </div>
          </div>
        )}

        {/* ── STEP 1: Stripe ─────────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h1 className="font-display text-3xl text-navy mb-2">Connect Stripe to get paid</h1>
            <p className="text-gray-500 mb-8">Deposits and balance payments go directly to your bank. We charge a 1.5% platform fee per transaction.</p>
            <div className="bg-white rounded-sm border border-gray-200 p-6 space-y-4">
              {[
                { icon: "⚡", title: "Instant payouts to your bank", desc: "Stripe deposits funds directly — no manual transfers." },
                { icon: "🔒", title: "PCI-compliant and secure", desc: "Stripe handles all card data. You never touch sensitive payment info." },
                { icon: "📊", title: "Automatic invoicing", desc: "Clients get receipts and can pay the balance through your gallery link." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center flex-shrink-0 text-xl">{item.icon}</div>
                  <div>
                    <p className="font-medium text-navy text-sm">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={startConnect} disabled={saving} className="btn-primary w-full py-4 mt-6 text-base">
              {saving ? "Redirecting to Stripe…" : "Connect Stripe Account"}
            </button>
            <div className="flex gap-3 mt-3">
              <button onClick={prev} className="flex-1 text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">← Back</button>
              <button onClick={skip} className="flex-1 text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">Skip for now →</button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Invite Team ────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h1 className="font-display text-3xl text-navy mb-2">Invite your photographers</h1>
            <p className="text-gray-500 mb-8">They'll get a link to join your team and set up calendar sync. You can invite more later.</p>
            <div className="bg-white rounded-sm border border-gray-200 p-6 space-y-3">
              {inviteEmails.map((email, i) => (
                <div key={i} className="flex gap-2">
                  <input type="email" value={email}
                    onChange={(e) => setInviteEmails((arr) => arr.map((v, j) => j === i ? e.target.value : v))}
                    className="input-field flex-1" placeholder={`photographer${i + 1}@email.com`} />
                  {inviteEmails.length > 1 && (
                    <button onClick={() => setInviteEmails((arr) => arr.filter((_, j) => j !== i))}
                      className="text-gray-300 hover:text-red-400 px-2">×</button>
                  )}
                </div>
              ))}
              {inviteEmails.length < 5 && (
                <button onClick={() => setInviteEmails((arr) => [...arr, ""])}
                  className="text-sm text-navy hover:underline">+ Add another</button>
              )}
            </div>
            {inviteSent && <p className="text-sm text-green-700 mt-3">Invites sent!</p>}
            <div className="flex gap-3 mt-6">
              <button onClick={prev} className="btn-outline px-6 py-3">← Back</button>
              <button onClick={sendTeamInvites} disabled={saving} className="btn-primary px-8 py-3 flex-1">
                {saving ? "Sending…" : inviteEmails.some((e) => e.trim()) ? "Send Invites →" : "Continue →"}
              </button>
              <button onClick={skip} className="btn-outline px-6 py-3 text-gray-400">Skip</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Service Areas ──────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h1 className="font-display text-3xl text-navy mb-2">Define where you work</h1>
            <p className="text-gray-600 mb-6">
              Service areas let you draw coverage zones on a map, block bookings from outside those zones, and assign photographers to specific regions.
            </p>
            <div className="bg-white rounded-sm border border-gray-200 p-6 mb-4">
              <div className="space-y-4">
                {[
                  { icon: "🗺️", color: "bg-blue-50",  title: "Draw coverage zones", desc: "Use the map tool to draw polygons around the areas you serve. Multiple zones are supported." },
                  { icon: "📸", color: "bg-green-50", title: "Assign team members per zone", desc: "Route shoots to the right photographer based on where the property is located." },
                  { icon: "🚫", color: "bg-amber-50",  title: "Block outside bookings (optional)", desc: "Turn on \"Require Service Area\" in Settings → Booking to prevent clients from booking outside your zones." },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className={`w-8 h-8 ${item.color} rounded-lg flex items-center justify-center text-lg flex-shrink-0`}>{item.icon}</div>
                    <div>
                      <p className="font-medium text-charcoal text-sm">{item.title}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500">Opens in a new tab — your progress here is saved.</p>
                <Link
                  href="/dashboard/service-areas"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-navy border border-navy/20 px-3 py-1.5 rounded hover:bg-navy/5 transition-colors">
                  Set Up Service Areas ↗
                </Link>
              </div>
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={prev} className="btn-outline px-6 py-3">← Back</button>
              <button onClick={next} className="btn-primary px-8 py-3 flex-1">Continue →</button>
              <button onClick={skip} className="btn-outline px-6 py-3 text-gray-400">Skip</button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Done ───────────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="text-center">
            <div className="text-6xl mb-6">🚀</div>
            <h1 className="font-display text-3xl text-navy mb-3">You&apos;re all set!</h1>
            <p className="text-gray-500 mb-8">
              Your account is ready. Add your services and share your booking link to start taking jobs.
            </p>

            {slug && (
              <div className="bg-white border border-gray-200 rounded-sm p-4 mb-6 text-left">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Your booking page</p>
                <div className="flex items-center gap-3">
                  <code className="text-sm text-navy font-mono flex-1 truncate">
                    {typeof window !== "undefined" ? window.location.origin : ""}/{slug}/book
                  </code>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${slug}/book`)}
                    className="text-xs text-navy border border-navy/20 px-3 py-1.5 rounded hover:bg-navy/5">
                    Copy
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 mb-8">
              <Link href="/dashboard"
                className="py-3.5 px-6 rounded-sm text-sm font-semibold text-center bg-navy text-white hover:bg-navy/90 transition-colors">
                Go to Dashboard →
              </Link>
              <Link href="/dashboard/products"
                className="py-3 px-6 rounded-sm text-sm font-medium text-center border border-gray-200 text-charcoal hover:bg-gray-50 transition-colors">
                Set Up Services & Pricing
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
