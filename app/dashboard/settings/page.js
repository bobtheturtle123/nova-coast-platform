"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

const DEFAULT_TIERS = [
  { name: "Tiny",   label: "Studio / Under 800 sqft",  max: 800 },
  { name: "Small",  label: "801 – 2,500 sqft",         max: 2500 },
  { name: "Medium", label: "2,501 – 4,000 sqft",       max: 4000 },
  { name: "Large",  label: "4,001 – 6,000 sqft",       max: 6000 },
  { name: "XL",     label: "6,001 – 8,500 sqft",       max: 8500 },
  { name: "XXL",    label: "8,500+ sqft",               max: 999999 },
];

export default function SettingsPage() {
  const [tenant,  setTenant]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState({ text: "", type: "" });

  const [form, setForm] = useState({
    businessName: "", phone: "", fromZip: "",
    tagline: "", primaryColor: "#0b2a55", accentColor: "#c9a96e",
  });

  // Pricing config state
  const [pricingMode,  setPricingMode]  = useState("sqft");
  const [tiers,        setTiers]        = useState(DEFAULT_TIERS);
  const [savingTiers,  setSavingTiers]  = useState(false);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch("/api/dashboard/tenant", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTenant(data.tenant);
        setForm({
          businessName:  data.tenant.businessName || "",
          phone:         data.tenant.phone || "",
          fromZip:       data.tenant.fromZip || "",
          tagline:       data.tenant.branding?.tagline || "",
          primaryColor:  data.tenant.branding?.primaryColor || "#0b2a55",
          accentColor:   data.tenant.branding?.accentColor  || "#c9a96e",
        });
        // Load pricing config
        if (data.tenant.pricingConfig) {
          setPricingMode(data.tenant.pricingConfig.mode || "sqft");
          if (data.tenant.pricingConfig.tiers?.length) {
            setTiers(data.tenant.pricingConfig.tiers);
          }
        }
      }
      setLoading(false);
    });
  }, []);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function showMsg(text, type = "success") {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 3000);
  }

  async function saveBranding(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          businessName: form.businessName,
          phone: form.phone,
          fromZip: form.fromZip,
          branding: {
            ...(tenant?.branding || {}),
            businessName: form.businessName,
            tagline:      form.tagline,
            primaryColor: form.primaryColor,
            accentColor:  form.accentColor,
          },
        }),
      });
      if (res.ok) showMsg("Settings saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSaving(false);
  }

  async function savePricingConfig() {
    setSavingTiers(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pricingConfig: { mode: pricingMode, tiers },
        }),
      });
      if (res.ok) showMsg("Pricing configuration saved.");
      else showMsg("Failed to save pricing.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingTiers(false);
  }

  function updateTier(i, field, value) {
    setTiers((prev) => prev.map((t, idx) =>
      idx === i ? { ...t, [field]: field === "max" ? Number(value) || 0 : value } : t
    ));
  }

  function addTier() {
    setTiers((prev) => [...prev, { name: `Tier ${prev.length + 1}`, label: "New tier", max: 0 }]);
  }

  function removeTier(i) {
    if (tiers.length <= 2) return;
    setTiers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function resetTiers() {
    setTiers(DEFAULT_TIERS);
    setPricingMode("sqft");
  }

  if (loading) return (
    <div className="p-8 flex justify-center">
      <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );

  const APP_URL = typeof window !== "undefined" ? window.location.origin : "";
  const bookingUrl = `${APP_URL}/${tenant?.slug}/book`;

  const modeLabels = {
    sqft:   { unit: "Sq. Ft.", gate: "Square footage" },
    photos: { unit: "Photos",  gate: "Number of photos" },
    custom: { unit: "Value",   gate: "Custom value" },
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display text-2xl text-navy mb-2">Settings</h1>
      <p className="text-gray-500 text-sm mb-8">Manage your business profile, branding, and pricing.</p>

      {msg.text && (
        <div className={`text-sm px-4 py-2 rounded-sm mb-6 ${
          msg.type === "success" ? "bg-green-50 border border-green-200 text-green-700"
          : "bg-red-50 border border-red-200 text-red-700"
        }`}>{msg.text}</div>
      )}

      {/* Booking URL */}
      <div className="bg-cream rounded-sm border border-gray-200 p-4 mb-6">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Your Booking Page</p>
        <div className="flex items-center gap-2">
          <code className="text-sm text-navy flex-1 truncate">{bookingUrl}</code>
          <button onClick={() => { navigator.clipboard.writeText(bookingUrl); showMsg("Copied!"); }}
            className="text-xs text-navy border border-navy/20 px-2 py-1 rounded hover:bg-navy/5">Copy</button>
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-navy border border-navy/20 px-2 py-1 rounded hover:bg-navy/5">Open</a>
        </div>
      </div>

      <form onSubmit={saveBranding} className="space-y-6">
        {/* Business info */}
        <div className="bg-white rounded-sm border border-gray-200 p-6">
          <h2 className="font-display text-navy text-base mb-4">Business Info</h2>
          <div className="space-y-4">
            <div>
              <label className="label-field">Business Name</label>
              <input type="text" value={form.businessName} onChange={set("businessName")} className="input-field w-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Phone</label>
                <input type="tel" value={form.phone} onChange={set("phone")} className="input-field w-full" />
              </div>
              <div>
                <label className="label-field">Home ZIP Code</label>
                <input type="text" value={form.fromZip} onChange={set("fromZip")} maxLength={5} className="input-field w-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white rounded-sm border border-gray-200 p-6">
          <h2 className="font-display text-navy text-base mb-4">Branding</h2>
          <div className="space-y-4">
            <div>
              <label className="label-field">Tagline</label>
              <input type="text" value={form.tagline} onChange={set("tagline")} className="input-field w-full"
                placeholder="Professional real estate photography" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-field">Primary Color</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.primaryColor} onChange={set("primaryColor")}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-200" />
                  <input type="text" value={form.primaryColor} onChange={set("primaryColor")}
                    className="input-field flex-1 font-mono text-sm" />
                </div>
              </div>
              <div>
                <label className="label-field">Accent Color</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={form.accentColor} onChange={set("accentColor")}
                    className="w-10 h-10 rounded cursor-pointer border border-gray-200" />
                  <input type="text" value={form.accentColor} onChange={set("accentColor")}
                    className="input-field flex-1 font-mono text-sm" />
                </div>
              </div>
            </div>
            {/* Preview */}
            <div className="rounded-sm overflow-hidden border border-gray-200 mt-2">
              <div style={{ background: form.primaryColor }} className="px-4 py-3">
                <span style={{ color: form.accentColor }} className="font-display text-sm tracking-widest uppercase">
                  {form.businessName || "Your Business"}
                </span>
              </div>
              <div className="px-4 py-3 bg-white text-xs text-gray-500">{form.tagline || "Your tagline"}</div>
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="btn-primary px-8 py-3">
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </form>

      {/* ─── Pricing Tiers ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-sm border border-gray-200 p-6 mt-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-display text-navy text-base">Pricing Tiers</h2>
          <button onClick={resetTiers} className="text-xs text-gray-400 hover:text-navy">Reset to defaults</button>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Customize how pricing tiers work. Each product can have a price per tier.
        </p>

        {/* Pricing mode */}
        <div className="mb-5">
          <label className="label-field">Pricing mode</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "sqft",   label: "By Square Footage", desc: "Client enters sq ft at booking" },
              { value: "photos", label: "By Photo Count",    desc: "Client enters # of photos needed" },
              { value: "custom", label: "Custom Value",      desc: "You define what the tiers mean" },
            ].map((m) => (
              <button key={m.value} type="button" onClick={() => setPricingMode(m.value)}
                className={`p-3 border rounded-sm text-left transition-colors ${
                  pricingMode === m.value ? "border-navy bg-navy/5" : "border-gray-200 hover:border-navy/30"
                }`}>
                <p className={`text-sm font-semibold ${pricingMode === m.value ? "text-navy" : "text-charcoal"}`}>{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Tier table */}
        <div className="space-y-2 mb-4">
          <div className="grid grid-cols-12 text-xs text-gray-400 uppercase tracking-wide font-medium px-1 mb-1">
            <div className="col-span-3">Tier name</div>
            <div className="col-span-5">Label (shown to client)</div>
            <div className="col-span-3">Max {modeLabels[pricingMode]?.unit || "value"}</div>
            <div className="col-span-1" />
          </div>
          {tiers.map((tier, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-3">
                <input type="text" value={tier.name} onChange={(e) => updateTier(i, "name", e.target.value)}
                  className="input-field py-2 text-sm font-mono" placeholder="Tier ID" />
              </div>
              <div className="col-span-5">
                <input type="text" value={tier.label} onChange={(e) => updateTier(i, "label", e.target.value)}
                  className="input-field py-2 text-sm" placeholder="Shown to client" />
              </div>
              <div className="col-span-3">
                {i < tiers.length - 1 ? (
                  <input type="number" value={tier.max === 999999 ? "" : tier.max}
                    onChange={(e) => updateTier(i, "max", e.target.value)}
                    className="input-field py-2 text-sm" placeholder="e.g. 800" min="1" />
                ) : (
                  <span className="text-sm text-gray-400 px-3">Unlimited (last tier)</span>
                )}
              </div>
              <div className="col-span-1 flex justify-center">
                {tiers.length > 2 && (
                  <button onClick={() => removeTier(i)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={addTier}
            className="text-sm text-navy border border-navy/20 px-3 py-1.5 rounded hover:bg-navy/5">
            + Add tier
          </button>
          <p className="text-xs text-gray-400">
            {pricingMode === "flat" ? "With flat pricing, all products use their base price." :
             `Client will be asked for their ${modeLabels[pricingMode]?.gate?.toLowerCase() || "value"} at booking.`}
          </p>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100">
          <button onClick={savePricingConfig} disabled={savingTiers} className="btn-primary px-8 py-3">
            {savingTiers ? "Saving…" : "Save Pricing Config"}
          </button>
        </div>
      </div>
    </div>
  );
}
