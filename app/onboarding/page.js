"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";

const STEPS = [
  { id: "basics",   label: "Basics",    desc: "Your contact info" },
  { id: "services", label: "Services",  desc: "What you offer" },
  { id: "stripe",   label: "Payments",  desc: "Get paid" },
  { id: "areas",    label: "Coverage",  desc: "Where you work" },
  { id: "team",     label: "Team",      desc: "Invite photographers" },
  { id: "done",     label: "Done",      desc: "You're live" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step,         setStep]         = useState(0);
  const [user,         setUser]         = useState(null);
  const [tenant,       setTenant]       = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");
  const [copied,       setCopied]       = useState(false);

  // Step 1 — basics
  const [phone,   setPhone]   = useState("");
  const [fromZip, setFromZip] = useState("");

  // Step 5 — team invites
  const [invites,    setInvites]    = useState([{ email: "", role: "photographer" }]);
  const [inviteSent, setInviteSent] = useState(false);

  const [slug, setSlug] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/auth/login"); return; }
      setUser(u);

      async function loadTenant(token) {
        const res = await fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return null;
        const d = await res.json();
        return d.tenant ?? null;
      }

      let idToken = await u.getIdToken();
      let t = await loadTenant(idToken);

      // If tenant API failed (claims missing), attempt repair then retry once
      if (!t) {
        try {
          const repairRes = await fetch("/api/auth/repair-claims", {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` },
          });
          const repairData = await repairRes.json();
          if (repairData.ok) {
            await u.getIdToken(true);
            idToken = await u.getIdToken();
            t = await loadTenant(idToken);
          }
        } catch {}
      }

      if (t) {
        setTenant(t);
        if (t.slug)    setSlug(t.slug);
        if (t.phone)   setPhone(t.phone);
        if (t.fromZip) setFromZip(t.fromZip);
        if (t.onboardingCompleted) { router.push("/dashboard"); return; }
        if (t.onboardingStep)      setStep(t.onboardingStep);
      }
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function patch(fields) {
    const token = await user.getIdToken();
    return fetch("/api/tenants/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(fields),
    });
  }

  function next() {
    setError("");
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function prev() {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  async function skip() {
    setError("");
    const nextStep = step + 1;
    if (nextStep >= STEPS.length - 1) {
      await patch({ onboardingCompleted: true, onboardingStep: STEPS.length }).catch(() => {});
      router.push("/dashboard");
      return;
    }
    await patch({ onboardingStep: nextStep }).catch(() => {});
    next();
  }

  async function saveBasics() {
    if (!phone.trim() && !fromZip.trim()) { next(); return; }
    setSaving(true); setError("");
    try {
      const res = await patch({ phone: phone.trim(), fromZip: fromZip.trim(), onboardingStep: 1 });
      if (!res.ok) throw new Error();
      next();
    } catch { setError("Couldn't save. Please try again."); }
    finally { setSaving(false); }
  }

  async function startConnect() {
    setSaving(true); setError("");
    try {
      const token = await user.getIdToken();
      const res  = await fetch("/api/connect/onboard", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || "Could not start Stripe Connect");
    } catch (err) { setError(err.message); setSaving(false); }
  }

  async function sendInvites() {
    const valid = invites.filter((i) => i.email.trim() && i.email.includes("@"));
    if (!valid.length) { next(); return; }
    setSaving(true);
    const token = await user.getIdToken();
    await Promise.all(valid.map((invite) =>
      fetch("/api/dashboard/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: invite.email.trim(), role: invite.role }),
      })
    ));
    setInviteSent(true);
    setSaving(false);
    setTimeout(() => next(), 1200);
  }

  async function finish() {
    setSaving(true);
    await patch({ onboardingCompleted: true, onboardingStep: STEPS.length }).catch(() => {});
    setSaving(false);
    router.push("/dashboard");
  }

  function copyUrl() {
    navigator.clipboard.writeText(`${window.location.origin}/${slug}/book`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
      </div>
    );
  }

  const pct = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <span className="font-display text-navy text-lg tracking-wide">KyoriaOS</span>
        <button
          onClick={async () => {
            await patch({ onboardingCompleted: true, onboardingStep: STEPS.length }).catch(() => {});
            router.push("/dashboard");
          }}
          className="text-xs text-gray-400 hover:text-navy transition-colors">
          Skip setup → Dashboard
        </button>
      </header>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 font-medium">
              Step {step + 1} of {STEPS.length} — {STEPS[step].desc}
            </span>
            <span className="text-xs text-gray-400">{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-navy rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((s, i) => (
              <span key={s.id} className={`text-[10px] font-medium transition-colors ${
                i < step ? "text-emerald-600" : i === step ? "text-navy" : "text-gray-300"
              }`}>{s.label}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-xl mx-auto w-full px-6 py-12">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">{error}</div>
        )}

        {/* ── STEP 0: Business basics ──────────────────────────────────────── */}
        {step === 0 && (
          <div>
            <h1 className="font-display text-3xl text-navy mb-1">Let's set up your account</h1>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Two quick fields so we can calculate travel fees and make sure your clients can reach you.
            </p>
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-sm">
              <div>
                <label className="label-field">Phone Number</label>
                <input type="tel" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field w-full mt-1" placeholder="(555) 555-5555" />
                <p className="text-xs text-gray-400 mt-1">Shown on client confirmation emails.</p>
              </div>
              <div>
                <label className="label-field">Home Base ZIP Code</label>
                <input type="text" value={fromZip}
                  onChange={(e) => setFromZip(e.target.value)}
                  className="input-field w-full mt-1" placeholder="92108" maxLength={5} />
                <p className="text-xs text-gray-400 mt-1">Used to auto-calculate travel fees when shoots are far away.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveBasics} disabled={saving} className="btn-primary flex-1 py-3">
                {saving ? "Saving…" : "Continue →"}
              </button>
              <button onClick={skip} className="btn-outline px-6 py-3 text-gray-400">Skip</button>
            </div>
          </div>
        )}

        {/* ── STEP 1: Services ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h1 className="font-display text-3xl text-navy mb-1">Add your services</h1>
            <p className="text-gray-500 mb-6 leading-relaxed">
              Services and packages are what clients see when they book. Without at least one, your booking form won't have anything to choose from.
            </p>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {[
                { icon: "📦", title: "Packages", desc: "Bundled offerings with a fixed price — e.g. \"Standard Shoot\" for $299. Clients pick one package per booking." },
                { icon: "🛠️", title: "Services", desc: "Standalone items clients can select — e.g. \"Aerial Drone\", \"Floor Plan\", \"Virtual Staging\"." },
                { icon: "➕", title: "Add-ons", desc: "Optional extras clients can add at checkout — e.g. \"Rush Delivery (+$50)\"." },
              ].map((item, i) => (
                <div key={item.title} className={`flex items-start gap-4 px-5 py-4 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                  <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center text-lg flex-shrink-0">{item.icon}</div>
                  <div>
                    <p className="font-medium text-charcoal text-sm">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                <Link href="/dashboard/products" target="_blank" rel="noopener noreferrer"
                  className="btn-primary text-sm px-5 py-2.5 inline-flex items-center gap-1.5">
                  Add Services & Packages ↗
                </Link>
                <p className="text-xs text-gray-400 mt-2">Opens in a new tab — come back here when done.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={prev} className="btn-outline px-5 py-3">← Back</button>
              <button onClick={next} className="btn-primary flex-1 py-3">I've added services →</button>
              <button onClick={skip} className="btn-outline px-5 py-3 text-gray-400">Skip</button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Stripe ───────────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h1 className="font-display text-3xl text-navy mb-1">Connect Stripe to get paid</h1>
            <p className="text-gray-500 mb-6 leading-relaxed">
              Deposits are collected when clients book, and balances are collected before they can download their media. Funds go directly to your bank — you never have to ask twice.
            </p>
            {tenant?.stripeConnectOnboarded ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-emerald-800 text-sm">Stripe is connected</p>
                  <p className="text-xs text-emerald-600">You're ready to collect payments.</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4 mb-6">
                {[
                  { icon: "⚡", title: "Same-day payouts to your bank", desc: "Stripe deposits funds directly — no waiting, no manual transfers." },
                  { icon: "🔒", title: "PCI-compliant, fully secure", desc: "Stripe handles all card data. You never see or store sensitive payment info." },
                  { icon: "📊", title: "Automatic receipts & invoicing", desc: "Clients receive email receipts, and can pay their balance straight from the gallery link." },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-base flex-shrink-0">{item.icon}</div>
                    <div>
                      <p className="font-medium text-charcoal text-sm">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!tenant?.stripeConnectOnboarded && (
              <button onClick={startConnect} disabled={saving} className="btn-primary w-full py-3.5 text-sm mb-3">
                {saving ? "Redirecting to Stripe…" : "Connect Stripe Account →"}
              </button>
            )}
            <div className="flex gap-3 mt-1">
              <button onClick={prev} className="flex-1 text-center text-sm text-gray-400 hover:text-navy transition-colors">← Back</button>
              <button onClick={next} className="flex-1 text-center text-sm text-gray-400 hover:text-navy transition-colors">
                {tenant?.stripeConnectOnboarded ? "Continue →" : "Skip for now →"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Service areas ─────────────────────────────────────────── */}
        {step === 3 && (
          <div>
            <h1 className="font-display text-3xl text-navy mb-1">Define where you work</h1>
            <p className="text-gray-500 mb-6 leading-relaxed">
              Draw coverage zones on a map so the booking form auto-calculates travel fees and prevents out-of-area bookings. Totally optional — skip if you work everywhere.
            </p>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
              {[
                { icon: "🗺️", title: "Draw coverage zones", desc: "Mark the areas you serve. Multiple zones are supported — cities, counties, or custom shapes." },
                { icon: "💰", title: "Auto travel fees", desc: "Shoots outside your home zone automatically add a travel fee at checkout. You set the rate." },
                { icon: "📸", title: "Route by photographer", desc: "On Studio plan+, assign team members to specific zones so the right person gets the job." },
              ].map((item, i) => (
                <div key={item.title} className={`flex items-start gap-4 px-5 py-4 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                  <div className="w-9 h-9 bg-gray-50 rounded-lg flex items-center justify-center text-lg flex-shrink-0">{item.icon}</div>
                  <div>
                    <p className="font-medium text-charcoal text-sm">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
              <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
                <Link href="/dashboard/service-areas" target="_blank" rel="noopener noreferrer"
                  className="btn-outline text-sm px-5 py-2.5 inline-flex items-center gap-1.5 text-navy border-navy/30">
                  Set Up Service Areas ↗
                </Link>
                <p className="text-xs text-gray-400 mt-2">Opens in a new tab — come back here when done.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={prev} className="btn-outline px-5 py-3">← Back</button>
              <button onClick={next} className="btn-primary flex-1 py-3">Continue →</button>
              <button onClick={skip} className="btn-outline px-5 py-3 text-gray-400">Skip</button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Team ─────────────────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <h1 className="font-display text-3xl text-navy mb-1">Invite your team</h1>
            <p className="text-gray-500 mb-6 leading-relaxed">
              Everyone gets their own login and sees only what their role allows. Photographers and editors see assigned shoots; managers see everything except billing; admins have full access.
            </p>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3 mb-4">
              {/* Role legend */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 pb-3 border-b border-gray-100">
                {[
                  ["Photographer", "Assigned shoots, calendar, uploads"],
                  ["Editor",       "Upload & deliver media only"],
                  ["Manager",      "All bookings + team, no billing"],
                  ["Admin",        "Full access except owner billing"],
                ].map(([role, desc]) => (
                  <div key={role} className="flex items-start gap-1.5">
                    <span className="text-[11px] font-semibold text-navy mt-px w-24 flex-shrink-0">{role}</span>
                    <span className="text-[11px] text-gray-400 leading-snug">{desc}</span>
                  </div>
                ))}
              </div>

              {invites.map((invite, i) => (
                <div key={i} className="flex gap-2">
                  <input type="email" value={invite.email}
                    onChange={(e) => setInvites((arr) => arr.map((v, j) => j === i ? { ...v, email: e.target.value } : v))}
                    className="input-field flex-1" placeholder="name@email.com" />
                  <select
                    value={invite.role}
                    onChange={(e) => setInvites((arr) => arr.map((v, j) => j === i ? { ...v, role: e.target.value } : v))}
                    className="input-field w-36 flex-shrink-0">
                    <option value="photographer">Photographer</option>
                    <option value="editor">Editor</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                  {invites.length > 1 && (
                    <button onClick={() => setInvites((arr) => arr.filter((_, j) => j !== i))}
                      className="text-gray-300 hover:text-red-400 px-2 text-lg">×</button>
                  )}
                </div>
              ))}
              {invites.length < 5 && (
                <button onClick={() => setInvites((arr) => [...arr, { email: "", role: "photographer" }])}
                  className="text-xs text-navy hover:underline">+ Add another</button>
              )}
              {inviteSent && (
                <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium pt-1">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Invites sent!
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">Add more team members anytime from Dashboard → Team.</p>
            <div className="flex gap-3">
              <button onClick={prev} className="btn-outline px-5 py-3">← Back</button>
              <button onClick={sendInvites} disabled={saving} className="btn-primary flex-1 py-3">
                {saving ? "Sending…" : invites.some((i) => i.email.trim()) ? "Send Invites →" : "Continue →"}
              </button>
              <button onClick={skip} className="btn-outline px-5 py-3 text-gray-400">Skip</button>
            </div>
          </div>
        )}

        {/* ── STEP 5: Done ─────────────────────────────────────────────────── */}
        {step === 5 && (
          <div className="text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-emerald-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="font-display text-3xl text-navy mb-2">You're ready to go.</h1>
            <p className="text-gray-500 mb-8 leading-relaxed max-w-sm mx-auto">
              Your booking page is live. Share the link with clients and start collecting deposits today.
            </p>

            {slug && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 text-left shadow-sm">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">Your booking page</p>
                <div className="flex items-center gap-3">
                  <code className="text-sm text-navy font-mono flex-1 truncate">
                    {typeof window !== "undefined" ? window.location.origin : ""}/{slug}/book
                  </code>
                  <button onClick={copyUrl}
                    className={`text-xs font-medium border px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                      copied ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-navy/20 text-navy hover:bg-navy/5"
                    }`}>
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 mb-6 text-left bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">What's next</p>
              {[
                { href: "/dashboard/settings", label: "Review booking settings", desc: "Deposit %, cancellation policy, availability windows" },
                { href: "/dashboard/products",  label: "Fine-tune your services",  desc: "Add photos, adjust descriptions and pricing" },
                { href: "/dashboard/billing",   label: "Connect Stripe",           desc: "Required to collect payments from clients", skip: !!tenant?.stripeConnectOnboarded },
              ].filter((i) => !i.skip).map((item) => (
                <Link key={item.href} href={item.href}
                  className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 group">
                  <div className="w-5 h-5 rounded-full border-2 border-gray-200 group-hover:border-navy flex-shrink-0 mt-0.5 transition-colors" />
                  <div>
                    <p className="text-sm font-medium text-navy group-hover:underline">{item.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </div>

            <button onClick={finish} disabled={saving} className="btn-primary w-full py-3.5 text-sm">
              {saving ? "Saving…" : "Go to Dashboard →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
