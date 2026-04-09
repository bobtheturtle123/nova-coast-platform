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

  // Booking config state
  const [depositType,   setDepositType]   = useState("percent"); // "percent" | "fixed" | "none"
  const [depositValue,  setDepositValue]  = useState(50);
  const [timeSlots,     setTimeSlots]     = useState([
    { value: "morning",   label: "Morning",   desc: "8am – 12pm",     enabled: true },
    { value: "afternoon", label: "Afternoon", desc: "12pm – 5pm",     enabled: true },
    { value: "flexible",  label: "Flexible",  desc: "Any time works", enabled: true },
    { value: "specific",  label: "Specific Time", desc: "Agent enters exact time", enabled: false },
  ]);
  const [customFields,  setCustomFields]  = useState([]); // [{ id, label, type, required }]
  const [savingBooking, setSavingBooking] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType,  setNewFieldType]  = useState("text");

  // Terms of service state
  const [termsText,    setTermsText]    = useState("");
  const [savingTerms,  setSavingTerms]  = useState(false);

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
        // Load booking config
        if (data.tenant.bookingConfig) {
          const bc = data.tenant.bookingConfig;
          if (bc.deposit) {
            setDepositType(bc.deposit.type || "percent");
            setDepositValue(bc.deposit.value ?? 50);
          }
          if (bc.timeSlots?.length) setTimeSlots(bc.timeSlots);
          if (bc.customFields?.length) setCustomFields(bc.customFields);
          if (bc.terms) setTermsText(bc.terms);
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

  // ─── Booking config helpers ───────────────────────────────────────────────
  function toggleTimeSlot(value) {
    setTimeSlots((prev) => prev.map((s) => s.value === value ? { ...s, enabled: !s.enabled } : s));
  }

  function updateTimeSlot(value, field, val) {
    setTimeSlots((prev) => prev.map((s) => s.value === value ? { ...s, [field]: val } : s));
  }

  function addCustomField() {
    const label = newFieldLabel.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 32) + "_" + Date.now().toString(36);
    setCustomFields((prev) => [...prev, { id, label, type: newFieldType, required: false }]);
    setNewFieldLabel(""); setNewFieldType("text");
  }

  function removeCustomField(id) {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  }

  function toggleFieldRequired(id) {
    setCustomFields((prev) => prev.map((f) => f.id === id ? { ...f, required: !f.required } : f));
  }

  function buildBookingConfig() {
    return {
      deposit:      { type: depositType, value: Number(depositValue) || 0 },
      timeSlots,
      customFields,
      terms:        termsText,
    };
  }

  async function saveBookingConfig() {
    setSavingBooking(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingConfig: buildBookingConfig() }),
      });
      if (res.ok) showMsg("Booking settings saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingBooking(false);
  }

  async function saveTerms() {
    setSavingTerms(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/tenants/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingConfig: buildBookingConfig() }),
      });
      if (res.ok) showMsg("Terms saved.");
      else showMsg("Failed to save.", "error");
    } catch { showMsg("Something went wrong.", "error"); }
    setSavingTerms(false);
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

      {/* ─── Booking Config ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-sm border border-gray-200 p-6 mt-8 space-y-8">
        <div>
          <h2 className="font-display text-navy text-base mb-1">Booking Settings</h2>
          <p className="text-sm text-gray-500">Configure deposit requirements, time slots, and custom form fields.</p>
        </div>

        {/* Deposit config */}
        <div>
          <h3 className="text-sm font-semibold text-charcoal mb-3">Deposit / Payment</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { value: "percent", label: "% of total",  desc: "e.g. 50% deposit" },
              { value: "fixed",   label: "Fixed amount", desc: "e.g. $200 flat deposit" },
              { value: "none",    label: "No deposit",   desc: "Clients pay in full" },
            ].map((m) => (
              <button key={m.value} type="button" onClick={() => setDepositType(m.value)}
                className={`p-3 border rounded-sm text-left transition-colors ${
                  depositType === m.value ? "border-navy bg-navy/5" : "border-gray-200 hover:border-navy/30"
                }`}>
                <p className={`text-sm font-semibold ${depositType === m.value ? "text-navy" : "text-charcoal"}`}>{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>

          {depositType !== "none" && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {depositType === "percent" ? "Percentage:" : "Amount: $"}
              </span>
              <input
                type="number" value={depositValue}
                onChange={(e) => setDepositValue(e.target.value)}
                min="0" max={depositType === "percent" ? 100 : undefined}
                className="input-field w-28 text-sm"
              />
              {depositType === "percent" && <span className="text-sm text-gray-400">%</span>}
              <span className="text-xs text-gray-400 ml-2">
                {depositType === "percent"
                  ? `On a $1,000 order, deposit = $${Math.round(1000 * (depositValue / 100))}`
                  : `Fixed deposit regardless of order size`}
              </span>
            </div>
          )}
          {depositType === "none" && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Clients will be required to pay the full amount upfront at booking.
            </p>
          )}
        </div>

        {/* Time slots */}
        <div>
          <h3 className="text-sm font-semibold text-charcoal mb-1">Preferred Time Slots</h3>
          <p className="text-xs text-gray-400 mb-3">Control which time options clients see when scheduling. You can rename them.</p>
          <div className="space-y-2">
            {timeSlots.map((slot) => (
              <div key={slot.value} className={`border rounded-sm px-3 py-2.5 flex items-center gap-3 ${slot.enabled ? "border-gray-200 bg-white" : "border-dashed border-gray-200 bg-gray-50 opacity-60"}`}>
                <div
                  onClick={() => toggleTimeSlot(slot.value)}
                  className={`relative w-9 h-5 rounded-full flex-shrink-0 cursor-pointer transition-colors ${slot.enabled ? "bg-navy" : "bg-gray-300"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${slot.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input type="text" value={slot.label} disabled={!slot.enabled}
                    onChange={(e) => updateTimeSlot(slot.value, "label", e.target.value)}
                    className="input-field py-1.5 text-sm" placeholder="Label" />
                  <input type="text" value={slot.desc} disabled={!slot.enabled}
                    onChange={(e) => updateTimeSlot(slot.value, "desc", e.target.value)}
                    className="input-field py-1.5 text-sm text-gray-500" placeholder="Description" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom form fields */}
        <div>
          <h3 className="text-sm font-semibold text-charcoal mb-1">Custom Booking Form Fields</h3>
          <p className="text-xs text-gray-400 mb-3">Add extra fields to the property step of your booking form (e.g. Gate Code, Planned Live Date).</p>

          {customFields.length > 0 && (
            <div className="space-y-2 mb-3">
              {customFields.map((f) => (
                <div key={f.id} className="flex items-center gap-3 border border-gray-200 rounded-sm px-3 py-2.5 bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{f.label}</p>
                    <p className="text-xs text-gray-400">{f.type}{f.required ? " · required" : " · optional"}</p>
                  </div>
                  <button
                    onClick={() => toggleFieldRequired(f.id)}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      f.required ? "bg-navy/10 border-navy/20 text-navy" : "border-gray-200 text-gray-400 hover:border-navy/30"
                    }`}
                  >
                    {f.required ? "Required" : "Optional"}
                  </button>
                  <button onClick={() => removeCustomField(f.id)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input type="text" value={newFieldLabel}
              onChange={(e) => setNewFieldLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomField()}
              placeholder="Field label (e.g. Gate Code)" className="input-field flex-1 text-sm" />
            <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)} className="input-field text-sm w-32">
              <option value="text">Text</option>
              <option value="date">Date</option>
              <option value="textarea">Long text</option>
            </select>
            <button onClick={addCustomField} disabled={!newFieldLabel.trim()}
              className="btn-primary px-4 py-2 text-sm">Add</button>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <button onClick={saveBookingConfig} disabled={savingBooking} className="btn-primary px-8 py-3">
            {savingBooking ? "Saving…" : "Save Booking Settings"}
          </button>
        </div>
      </div>

      {/* ─── Terms of Service ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-sm border border-gray-200 p-6 mt-8">
        <h2 className="font-display text-navy text-base mb-1">Terms of Service</h2>
        <p className="text-sm text-gray-500 mb-4">
          Clients must agree to these terms before completing a booking. Leave blank to disable the checkbox.
          Your terms are shown at <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">/{tenant?.slug}/terms</code>.
        </p>
        <textarea
          value={termsText}
          onChange={(e) => setTermsText(e.target.value)}
          rows={18}
          placeholder="Paste your Terms of Service here…"
          className="input-field w-full text-sm font-mono leading-relaxed resize-y"
        />
        <div className="mt-4 flex items-center gap-4">
          <button onClick={saveTerms} disabled={savingTerms} className="btn-primary px-8 py-3">
            {savingTerms ? "Saving…" : "Save Terms"}
          </button>
          {tenant?.slug && (
            <a href={`/${tenant.slug}/terms`} target="_blank" rel="noopener noreferrer"
              className="text-sm text-navy underline underline-offset-2 hover:opacity-70">
              Preview public terms page →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
