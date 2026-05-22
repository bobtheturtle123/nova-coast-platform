"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { getAppUrl } from "@/lib/appUrl";

const STEPS = [
  { id: "branding",  label: "Business",  desc: "Your identity" },
  { id: "stripe",    label: "Payments",  desc: "Get paid" },
  { id: "areas",     label: "Coverage",  desc: "Where you shoot" },
  { id: "done",      label: "Done",      desc: "All set" },
];

const BRAND_COLORS = [
  "#3486cf", "#1e6091", "#6366f1", "#8b5cf6",
  "#059669", "#0891b2", "#d97706", "#dc2626",
  "#0f172a", "#374151",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step,    setStep]    = useState(0);
  const [user,    setUser]    = useState(null);
  const [tenant,  setTenant]  = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [copied,  setCopied]  = useState(false);

  // Step 0 — Business & Branding
  const [businessName,  setBusinessName]  = useState("");
  const [phone,         setPhone]         = useState("");
  const [fromZip,       setFromZip]       = useState("");
  const [tagline,       setTagline]       = useState("");
  const [primaryColor,  setPrimaryColor]  = useState("#3486cf");
  const [logoUrl,       setLogoUrl]       = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Step 2 — Service areas
  const [travelRadius, setTravelRadius] = useState("");
  const [travelRate,   setTravelRate]   = useState("");

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
        if (t.slug) setSlug(t.slug);
        if (t.phone) setPhone(t.phone);
        if (t.fromZip) setFromZip(t.fromZip);
        if (t.businessName || t.branding?.businessName) setBusinessName(t.businessName || t.branding?.businessName || "");
        if (t.branding?.tagline) setTagline(t.branding.tagline);
        if (t.branding?.primaryColor) setPrimaryColor(t.branding.primaryColor);
        if (t.branding?.logoUrl) setLogoUrl(t.branding.logoUrl);
        if (t.onboardingCompleted) { router.push("/dashboard"); return; }
        if (t.onboardingStep) setStep(Math.min(t.onboardingStep, STEPS.length - 1));
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

  function next() { setError(""); setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
  function prev() { setError(""); setStep((s) => Math.max(s - 1, 0)); }

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

  async function uploadLogo(file) {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/dashboard/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: file.name, contentType: file.type, folder: "branding" }),
      });
      if (!res.ok) throw new Error();
      const { uploadUrl, publicUrl } = await res.json();
      await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      setLogoUrl(publicUrl);
    } catch { setError("Logo upload failed. Try again."); }
    setUploadingLogo(false);
  }

  async function saveBranding() {
    if (!businessName.trim()) { setError("Business name is required."); return; }
    setSaving(true); setError("");
    try {
      const res = await patch({
        businessName: businessName.trim(),
        phone: phone.trim(),
        fromZip: fromZip.trim(),
        branding: {
          ...(tenant?.branding || {}),
          businessName: businessName.trim(),
          tagline:      tagline.trim(),
          primaryColor: primaryColor,
          logoUrl:      logoUrl || null,
        },
        onboardingStep: 1,
      });
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
      if (data.url) {
        await patch({ onboardingStep: 1 }).catch(() => {});
        window.location.href = data.url;
      } else throw new Error(data.error || "Could not start Stripe Connect");
    } catch (err) { setError(err.message); setSaving(false); }
  }

  async function saveCoverage() {
    setSaving(true); setError("");
    try {
      const fields = { onboardingStep: 3 };
      if (travelRadius) fields.travelRadiusMiles = travelRadius === "unlimited" ? 9999 : Number(travelRadius);
      if (travelRate)   fields.travelRatePerMile = Number(travelRate);
      const res = await patch(fields);
      if (!res.ok) throw new Error();
      next();
    } catch { setError("Couldn't save. Please try again."); }
    finally { setSaving(false); }
  }

  async function finish() {
    setSaving(true);
    await patch({ onboardingCompleted: true, onboardingStep: STEPS.length }).catch(() => {});
    setSaving(false);
    router.push("/dashboard");
  }

  function copyUrl() {
    navigator.clipboard.writeText(`${getAppUrl()}/${slug}/book`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
      </div>
    );
  }

  const pct = Math.round((step / (STEPS.length - 1)) * 100);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <img src="/kyoriaos-logo.png" alt="KyoriaOS" className="h-7 w-auto object-contain" />
        <button
          onClick={async () => {
            await patch({ onboardingCompleted: true, onboardingStep: STEPS.length }).catch(() => {});
            router.push("/dashboard");
          }}
          className="text-xs text-gray-400 hover:text-[#3486cf] transition-colors">
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
            <div className="h-full bg-[#3486cf] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            {STEPS.map((s, i) => (
              <span key={s.id} className={`text-[10px] font-medium transition-colors ${
                i < step ? "text-emerald-600" : i === step ? "text-[#3486cf]" : "text-gray-300"
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

        {/* ── STEP 0: Business & Branding ──────────────────────────────────── */}
        {step === 0 && (
          <div>
            <h1 className="font-display text-3xl text-[#3486cf] mb-1">Set up your business</h1>
            <p className="text-gray-500 mb-8 leading-relaxed">
              Tell us about your business. This information shows on your booking page, client emails, and invoices.
            </p>

            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-sm">
              <div>
                <label className="label-field">Business Name <span className="text-red-400">*</span></label>
                <input type="text" value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="input-field w-full mt-1" placeholder="Nova Coast Photography" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-field">Phone Number</label>
                  <input type="tel" value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-field w-full mt-1" placeholder="(555) 555-5555" />
                </div>
                <div>
                  <label className="label-field">Home Base ZIP</label>
                  <input type="text" value={fromZip}
                    onChange={(e) => setFromZip(e.target.value)}
                    className="input-field w-full mt-1" placeholder="92108" maxLength={5} />
                </div>
              </div>

              <div>
                <label className="label-field">Tagline <span className="text-gray-300 font-normal">(optional)</span></label>
                <input type="text" value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  className="input-field w-full mt-1" placeholder="Premium real estate photography & video" />
              </div>

              {/* Brand color */}
              <div>
                <label className="label-field">Brand Color</label>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {BRAND_COLORS.map((c) => (
                    <button key={c} type="button"
                      onClick={() => setPrimaryColor(c)}
                      style={{ background: c }}
                      className={`w-8 h-8 rounded-full transition-all ${primaryColor === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : "hover:scale-105"}`} />
                  ))}
                  <div className="flex items-center gap-2 ml-1">
                    <div className="w-8 h-8 rounded-full border border-gray-200 overflow-hidden">
                      <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-10 h-10 -m-1 cursor-pointer border-0" />
                    </div>
                    <span className="text-xs text-gray-400 font-mono">{primaryColor}</span>
                  </div>
                </div>
              </div>

              {/* Logo upload */}
              <div>
                <label className="label-field">Business Logo <span className="text-gray-300 font-normal">(optional)</span></label>
                <div className="flex items-center gap-4 mt-2">
                  {logoUrl ? (
                    <div className="relative w-24 h-16 border border-gray-200 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
                      <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
                      <button type="button" onClick={() => setLogoUrl("")}
                        className="absolute top-1 right-1 w-5 h-5 bg-white rounded-full shadow flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors border border-gray-200">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="w-24 h-16 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-300">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 3h18M3 21h18" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <label className={`inline-flex items-center gap-2 text-sm px-3 py-2 border border-gray-200 rounded-xl cursor-pointer hover:border-[#3486cf]/40 transition-colors ${uploadingLogo ? "opacity-50 pointer-events-none" : ""}`}>
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      {uploadingLogo ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                    </label>
                    <p className="text-xs text-gray-400 mt-1">PNG or SVG recommended.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview chip */}
            {(businessName || primaryColor !== "#3486cf") && (
              <div className="mt-4 flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: primaryColor }} />
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">{businessName || "Your Business"}</p>
                  {tagline && <p className="text-xs text-gray-400 mt-0.5">{tagline}</p>}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button onClick={saveBranding} disabled={saving || uploadingLogo} className="btn-primary flex-1 py-3">
                {saving ? "Saving…" : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 1: Stripe ───────────────────────────────────────────────── */}
        {step === 1 && (
          <div>
            <h1 className="font-display text-3xl text-[#3486cf] mb-1">Connect Stripe to get paid</h1>
            <p className="text-gray-500 mb-6 leading-relaxed">
              Deposits are collected when clients book. Balances are collected before they can download their media. Funds go directly to your bank — no manual transfers.
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
                  { icon: "🔒", title: "PCI-compliant, fully secure",   desc: "Stripe handles all card data. You never see or store sensitive payment info." },
                  { icon: "📊", title: "Automatic receipts & invoicing", desc: "Clients receive email receipts and can pay their balance straight from the gallery link." },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-base flex-shrink-0">{item.icon}</div>
                    <div>
                      <p className="font-medium text-[#0F172A] text-sm">{item.title}</p>
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
              <button onClick={prev} className="flex-1 text-center text-sm text-gray-400 hover:text-[#3486cf] transition-colors">← Back</button>
              <button onClick={next} className="flex-1 text-center text-sm text-gray-400 hover:text-[#3486cf] transition-colors">
                {tenant?.stripeConnectOnboarded ? "Continue →" : "Skip for now →"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Service areas ─────────────────────────────────────────── */}
        {step === 2 && (
          <div>
            <h1 className="font-display text-3xl text-[#3486cf] mb-1">Where do you shoot?</h1>
            <p className="text-gray-500 mb-6 leading-relaxed">
              Set your travel range and rate so clients are automatically charged for distant shoots. You can draw precise coverage zones from your dashboard after setup.
            </p>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5 mb-4">
              <div>
                <label className="label-field">Travel radius from your home base</label>
                <select value={travelRadius} onChange={(e) => setTravelRadius(e.target.value)} className="input-field w-full mt-1">
                  <option value="">Select a range…</option>
                  <option value="10">Up to 10 miles</option>
                  <option value="25">Up to 25 miles</option>
                  <option value="50">Up to 50 miles</option>
                  <option value="100">Up to 100 miles</option>
                  <option value="unlimited">No limit — I travel anywhere</option>
                </select>
                <p className="text-xs text-gray-400 mt-1.5">Shoots beyond this range will have a travel fee added at checkout.</p>
              </div>

              <div>
                <label className="label-field">Travel fee per mile <span className="text-gray-300 font-normal">(optional)</span></label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-gray-400 text-sm">$</span>
                  <input type="number" min="0" step="0.01" value={travelRate}
                    onChange={(e) => setTravelRate(e.target.value)}
                    className="input-field w-32" placeholder="0.67" />
                  <span className="text-xs text-gray-400">per mile (IRS rate is $0.67)</span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 flex items-start gap-3">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#3486cf" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-[#1e5a8a] leading-relaxed">
                <span className="font-semibold">Want to draw precise zones on a map?</span>{" "}
                After setup, go to <strong>Dashboard → Service Areas</strong> to draw polygon zones, assign them to specific photographers, and set exclusion zones.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={prev} className="btn-outline px-5 py-3">← Back</button>
              <button onClick={saveCoverage} disabled={saving} className="btn-primary flex-1 py-3">
                {saving ? "Saving…" : "Continue →"}
              </button>
              <button onClick={skip} className="text-sm text-gray-400 hover:text-[#3486cf] px-5 py-3 transition-colors">Skip →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Done ─────────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-emerald-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="font-display text-3xl text-[#3486cf] mb-2">You're set up.</h1>
            <p className="text-gray-500 mb-8 leading-relaxed max-w-sm mx-auto">
              Your booking page is live. We'll walk you through pricing, services, and your first booking — step by step in the dashboard.
            </p>

            {slug && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6 text-left shadow-sm">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2 font-medium">Your booking page</p>
                <div className="flex items-center gap-3">
                  <code className="text-sm text-[#3486cf] font-mono flex-1 truncate">
                    {getAppUrl()}/{slug}/book
                  </code>
                  <button onClick={copyUrl}
                    className={`text-xs font-medium border px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ${
                      copied ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-[#3486cf]/20 text-[#3486cf] hover:bg-[#3486cf]/5"
                    }`}>
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl p-5 text-left shadow-sm mb-6">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your starter guide awaits</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                Once you're in the dashboard, you'll see a step-by-step guide to finish setting up: pricing, booking settings, products and services, and your team — in the right order.
              </p>
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
