"use client";

import { useEffect, useState, useRef } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { getSqftTier, getItemPrice, calculateTenantPrice, getActiveTiers, formatPrice } from "@/lib/catalogUtils";

const STATUS_LABELS = {
  pending_payment: { label: "Awaiting payment", cls: "bg-gray-50 text-gray-500" },
  requested:       { label: "Pending review",   cls: "bg-amber-50 text-amber-600" },
  confirmed:       { label: "Confirmed",         cls: "bg-green-50 text-green-700" },
  completed:       { label: "Completed",         cls: "bg-blue-50 text-blue-600" },
  cancelled:       { label: "Cancelled",         cls: "bg-red-50 text-red-500" },
  payment_failed:  { label: "Payment failed",    cls: "bg-red-50 text-red-500" },
};

const EMPTY_FORM = {
  clientName: "", clientEmail: "", clientPhone: "",
  address: "", city: "", state: "CA", zip: "", sqft: "",
  preferredDate: "", preferredTime: "",
  photographerEmail: "", photographerName: "",
  notes: "",
  totalPrice: "",
  depositPaid: false,
  status: "confirmed",
  selectedPackage: "",
  selectedServices: [],
  selectedAddons: [],
  customLineItems: [],
};

// ── Selectable card for a package ─────────────────────────────────────────────
function PackageCard({ pkg, tier, selected, onSelect }) {
  const price = getItemPrice(pkg, tier);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative text-left rounded-sm border p-4 transition-all ${
        selected
          ? "border-navy bg-navy text-white"
          : "border-gray-200 bg-white hover:border-navy/40"
      }`}
    >
      <p className={`text-sm font-semibold leading-tight ${selected ? "text-white" : "text-charcoal"}`}>
        {pkg.name}
      </p>
      {pkg.description && (
        <p className={`text-xs mt-0.5 leading-snug ${selected ? "text-white/70" : "text-gray-400"}`}>
          {pkg.description}
        </p>
      )}
      <p className={`text-base font-bold mt-2 ${selected ? "text-gold" : "text-navy"}`}>
        {formatPrice(price)}
      </p>
    </button>
  );
}

// ── Selectable row for a service / add-on ─────────────────────────────────────
function ServiceRow({ item, tier, checked, onToggle }) {
  const price = getItemPrice(item, tier);
  const [expanded, setExpanded] = useState(false);
  const long = item.description && item.description.length > 80;
  return (
    <div
      className={`w-full rounded-sm border transition-all ${
        checked
          ? "border-navy/60 bg-navy/5"
          : "border-transparent bg-gray-50 hover:border-gray-200"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
            checked ? "bg-navy border-navy" : "border-gray-300"
          }`}>
            {checked && (
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm text-charcoal font-medium leading-none">{item.name}</p>
            {item.description && !long && (
              <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
            )}
            {item.description && long && !expanded && (
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
            )}
          </div>
        </div>
        <span className="text-sm font-semibold text-navy ml-4 flex-shrink-0">{formatPrice(price)}</span>
      </button>
      {item.description && long && (
        <div className="px-3 pb-2">
          {expanded && (
            <p className="text-xs text-gray-500 leading-relaxed mb-1">{item.description}</p>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className="text-xs text-navy/60 hover:text-navy underline underline-offset-2"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function BookingsPage() {
  const [bookings,    setBookings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState("all");
  const [showCreate,  setShowCreate]  = useState(false);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [createError, setCreateError] = useState("");
  const [catalog,     setCatalog]     = useState(null);
  const [customLabel, setCustomLabel] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [agents,       setAgents]      = useState([]);
  const [teamMembers,  setTeamMembers] = useState([]);
  const [agentQuery,   setAgentQuery]  = useState("");
  const [showAgentDD,  setShowAgentDD] = useState(false);
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  useEffect(() => {
    loadBookings();
    loadCatalog();
  }, []);

  // Google Maps Places autocomplete for address
  useEffect(() => {
    if (!showCreate) { autocompleteRef.current = null; return; }
    const timer = setTimeout(() => {
      function initAC() {
        if (!addressInputRef.current || autocompleteRef.current) return;
        if (!window.google?.maps?.places) return;
        const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
          types: ["address"],
          componentRestrictions: { country: "us" },
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place.address_components) return;
          const get = (t) => place.address_components.find((c) => c.types.includes(t));
          const street = [get("street_number")?.long_name, get("route")?.long_name].filter(Boolean).join(" ");
          const city   = get("locality")?.long_name || get("sublocality_level_1")?.long_name || "";
          const state  = get("administrative_area_level_1")?.short_name || "";
          const zip    = get("postal_code")?.long_name || "";
          setForm((p) => ({ ...p, address: street || p.address, city, state, zip }));
        });
        autocompleteRef.current = ac;
      }
      const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
      if (!key) return;
      if (window.google?.maps?.places) {
        initAC();
      } else if (!document.getElementById("gmap-booking-script")) {
        const s = document.createElement("script");
        s.id    = "gmap-booking-script";
        s.src   = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
        s.async = true;
        s.onload = initAC;
        document.head.appendChild(s);
      } else {
        const retry = setInterval(() => {
          if (window.google?.maps?.places) { clearInterval(retry); initAC(); }
        }, 200);
        setTimeout(() => clearInterval(retry), 10000);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [showCreate]);

  async function loadCatalog() {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const tenantRes = await fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${token}` } });
    if (!tenantRes.ok) return;
    const { tenant } = await tenantRes.json();
    const [catRes, agentsRes, teamRes] = await Promise.all([
      fetch(`/api/tenant-public/${tenant.slug}/catalog`),
      fetch("/api/dashboard/agents", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("/api/dashboard/team",   { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (catRes.ok)    setCatalog(await catRes.json());
    if (agentsRes.ok) { const d = await agentsRes.json(); setAgents(d.agents || []); }
    if (teamRes.ok)   { const d = await teamRes.json();   setTeamMembers(d.members || []); }
  }

  async function loadBookings() {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch("/api/dashboard/bookings", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setBookings((await res.json()).bookings);
    setLoading(false);
  }

  function setField(f, val) {
    setForm((p) => ({ ...p, [f]: val }));
  }

  function toggleService(id) {
    setForm((p) => ({
      ...p,
      selectedPackage: "",
      selectedServices: p.selectedServices.includes(id)
        ? p.selectedServices.filter((s) => s !== id)
        : [...p.selectedServices, id],
    }));
  }

  function toggleAddon(id) {
    setForm((p) => ({
      ...p,
      selectedAddons: p.selectedAddons.includes(id)
        ? p.selectedAddons.filter((a) => a !== id)
        : [...p.selectedAddons, id],
    }));
  }

  function selectPackage(id) {
    setForm((p) => ({
      ...p,
      selectedPackage:  p.selectedPackage === id ? "" : id,
      selectedServices: [],
    }));
  }

  function addCustomLine() {
    const label = customLabel.trim();
    const price = parseFloat(customPrice) || 0;
    if (!label) return;
    setForm((p) => ({ ...p, customLineItems: [...p.customLineItems, { label, price }] }));
    setCustomLabel("");
    setCustomPrice("");
  }

  // ── Live pricing ─────────────────────────────────────────────────────────────
  const pricingConfig = catalog?.pricingConfig || null;
  const bookingConfig = catalog?.bookingConfig || null;
  const tier = getSqftTier(form.sqft, pricingConfig);
  const pricingMode = pricingConfig?.mode || "sqft";
  const showSqft = pricingMode !== "flat";

  const pricing = catalog
    ? calculateTenantPrice(
        form.selectedPackage || null,
        form.selectedServices,
        form.selectedAddons,
        0,
        catalog,
        form.sqft || 0,
      )
    : { subtotal: 0, base: 0, addonTotal: 0, deposit: 0, balance: 0 };

  const customTotal = form.customLineItems.reduce((s, l) => s + (l.price || 0), 0);
  const total = form.totalPrice !== "" ? Number(form.totalPrice) : (pricing.subtotal + customTotal);

  const activeTiers = getActiveTiers(pricingConfig);
  const tierLabel = tier ? activeTiers.find((t) => t.name === tier)?.label || tier : null;

  // Line items for summary
  const lines = [];
  if (form.selectedPackage && catalog) {
    const pkg = catalog.packages?.find((p) => p.id === form.selectedPackage);
    if (pkg) lines.push({ name: pkg.name, price: getItemPrice(pkg, tier) });
  } else {
    form.selectedServices.forEach((id) => {
      const s = catalog?.services?.find((x) => x.id === id);
      if (s) lines.push({ name: s.name, price: getItemPrice(s, tier) });
    });
  }
  form.selectedAddons.forEach((id) => {
    const a = catalog?.addons?.find((x) => x.id === id);
    if (a) lines.push({ name: `+ ${a.name}`, price: getItemPrice(a, tier) });
  });
  form.customLineItems.forEach((l) => lines.push({ name: l.label, price: l.price }));

  async function createBooking(e) {
    e.preventDefault();
    if (!form.clientName || !form.clientEmail || !form.address) {
      setCreateError("Name, email, and address are required.");
      return;
    }
    setSaving(true);
    setCreateError("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/dashboard/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          totalPrice:      total,
          packageId:       form.selectedPackage || null,
          serviceIds:      form.selectedServices,
          addonIds:        form.selectedAddons,
          customLineItems: form.customLineItems,
          source:          "manual",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create booking");
      setShowCreate(false);
      setForm(EMPTY_FORM);
      await loadBookings();
    } catch (err) {
      setCreateError(err.message);
    }
    setSaving(false);
  }

  const filtered = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-navy">Bookings</h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary px-4 py-2 text-sm">
          + New Booking
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "requested", "confirmed", "completed", "cancelled"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors
              ${filter === s ? "bg-navy text-white border-navy" : "text-gray-500 border-gray-200 hover:border-navy/40 hover:text-navy"}`}>
            {s === "all" ? "All" : STATUS_LABELS[s]?.label || s}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-sm border border-gray-100 p-16 text-center text-gray-400 text-sm">
          No bookings found.
        </div>
      ) : (
        <div className="bg-white rounded-sm border border-gray-100 divide-y divide-gray-50">
          {filtered.map((b) => {
            const s = STATUS_LABELS[b.status] || { label: b.status, cls: "bg-gray-50 text-gray-500" };
            const dateStr = b.preferredDate
              ? new Date(b.preferredDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "No date";
            const timeStr = b.preferredTime && !["flexible","morning","afternoon"].includes(b.preferredTime)
              ? ` · ${b.preferredTime}` : "";
            return (
              <div key={b.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-navy truncate">{b.clientName}</p>
                    {b.source === "manual" && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">manual</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{b.fullAddress || b.address}</p>
                  <p className="text-xs text-gray-300">{dateStr}{timeStr}</p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-navy">${(b.totalPrice || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">{b.depositPaid ? "Deposit paid" : "No deposit"}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                  <Link href={`/dashboard/bookings/${b.id}`} className="text-xs text-navy hover:underline whitespace-nowrap">
                    View →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create booking modal ──────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-6 px-4">
          <div className="bg-white rounded-sm shadow-2xl w-full max-w-4xl my-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100">
              <div>
                <h2 className="font-display text-xl text-navy">New Booking</h2>
                <p className="text-xs text-gray-400 mt-0.5">Manually create a confirmed booking for a phone or in-person client.</p>
              </div>
              <button
                onClick={() => { setShowCreate(false); setCreateError(""); setForm(EMPTY_FORM); setAgentQuery(""); setShowAgentDD(false); }}
                className="text-gray-300 hover:text-gray-500 transition-colors text-2xl leading-none w-8 h-8 flex items-center justify-center">
                ×
              </button>
            </div>

            <form onSubmit={createBooking}>
              <div className="flex divide-x divide-gray-100">

                {/* ── LEFT: form fields ─────────────────────────────────────── */}
                <div className="flex-1 px-8 py-6 space-y-7 overflow-y-auto max-h-[70vh]">

                  {createError && (
                    <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-2.5 rounded-sm">
                      {createError}
                    </div>
                  )}

                  {/* Client */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Agent / Client</p>
                    <div className="space-y-3">
                      {/* Customer autocomplete */}
                      {agents.length > 0 && (
                        <div className="relative">
                          <input
                            type="text"
                            value={agentQuery}
                            onChange={(e) => { setAgentQuery(e.target.value); setShowAgentDD(true); }}
                            onFocus={() => agentQuery && setShowAgentDD(true)}
                            onBlur={() => setTimeout(() => setShowAgentDD(false), 150)}
                            placeholder="Search existing customers…"
                            className="input-field w-full text-sm"
                          />
                          {showAgentDD && agentQuery.trim() && (
                            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                              {agents
                                .filter((a) => {
                                  const q = agentQuery.toLowerCase();
                                  return a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q);
                                })
                                .slice(0, 8)
                                .map((a) => (
                                  <button key={a.id} type="button"
                                    onMouseDown={() => {
                                      setForm((p) => ({ ...p, clientName: a.name || "", clientEmail: a.email || "", clientPhone: a.phone || "" }));
                                      setAgentQuery(a.name || "");
                                      setShowAgentDD(false);
                                    }}
                                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-b-0">
                                    <div className="w-7 h-7 rounded-full bg-navy/10 flex items-center justify-center text-xs font-semibold text-navy flex-shrink-0">
                                      {a.name?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm text-charcoal font-medium truncate">{a.name}</p>
                                      <p className="text-xs text-gray-400 truncate">{a.email}</p>
                                    </div>
                                  </button>
                                ))}
                              {agents.filter((a) => {
                                const q = agentQuery.toLowerCase();
                                return a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q);
                              }).length === 0 && (
                                <p className="px-4 py-3 text-sm text-gray-400 text-center">No matching customers</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      <input
                        type="text" autoFocus
                        value={form.clientName} onChange={(e) => setField("clientName", e.target.value)}
                        placeholder="Full name *"
                        className="input-field w-full"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="email"
                          value={form.clientEmail} onChange={(e) => setField("clientEmail", e.target.value)}
                          placeholder="Email address *"
                          className="input-field w-full"
                        />
                        <input
                          type="tel"
                          value={form.clientPhone} onChange={(e) => setField("clientPhone", e.target.value)}
                          placeholder="Phone (optional)"
                          className="input-field w-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Property */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Property</p>
                    <div className="space-y-3">
                      <input
                        ref={addressInputRef}
                        type="text"
                        value={form.address} onChange={(e) => setField("address", e.target.value)}
                        placeholder="Street address *"
                        className="input-field w-full"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <input type="text" value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="City" className="input-field text-sm" />
                        <input type="text" value={form.state} onChange={(e) => setField("state", e.target.value)} placeholder="State" className="input-field text-sm" maxLength={2} />
                        <input type="text" value={form.zip} onChange={(e) => setField("zip", e.target.value)} placeholder="ZIP" className="input-field text-sm" />
                      </div>
                      {showSqft && (
                        <div className="flex items-center gap-3">
                          <input
                            type="number"
                            value={form.sqft} onChange={(e) => setField("sqft", e.target.value)}
                            placeholder="Square footage (for pricing)"
                            className="input-field flex-1"
                            min="0"
                          />
                          {tierLabel && (
                            <span className="text-xs px-2.5 py-1.5 rounded-sm bg-navy/10 text-navy font-medium whitespace-nowrap">
                              {tierLabel}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Schedule */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Schedule</p>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        value={form.preferredDate} onChange={(e) => setField("preferredDate", e.target.value)}
                        className="input-field w-full"
                      />
                      <input
                        type="time"
                        value={form.preferredTime} onChange={(e) => setField("preferredTime", e.target.value)}
                        className="input-field w-full"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      A calendar invite will be emailed to the client and photographer if a date and time are set.
                    </p>
                  </div>

                  {/* Services */}
                  {catalog && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Services</p>

                      {/* Packages */}
                      {catalog.packages?.filter((p) => p.active !== false).length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-400 mb-2">Packages</p>
                          <div className="grid grid-cols-2 gap-2">
                            {catalog.packages.filter((p) => p.active !== false).map((pkg) => (
                              <PackageCard
                                key={pkg.id}
                                pkg={pkg}
                                tier={tier}
                                selected={form.selectedPackage === pkg.id}
                                onSelect={() => selectPackage(pkg.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Individual services — only when no package */}
                      {!form.selectedPackage && catalog.services?.filter((s) => s.active !== false).length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-400 mb-2">Services</p>
                          <div className="space-y-1">
                            {catalog.services.filter((s) => s.active !== false).map((svc) => (
                              <ServiceRow
                                key={svc.id}
                                item={svc}
                                tier={tier}
                                checked={form.selectedServices.includes(svc.id)}
                                onToggle={() => toggleService(svc.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add-ons */}
                      {catalog.addons?.filter((a) => a.active !== false).length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-400 mb-2">Add-ons</p>
                          <div className="space-y-1">
                            {catalog.addons.filter((a) => a.active !== false).map((addon) => (
                              <ServiceRow
                                key={addon.id}
                                item={addon}
                                tier={tier}
                                checked={form.selectedAddons.includes(addon.id)}
                                onToggle={() => toggleAddon(addon.id)}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom line items */}
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Custom items</p>
                        {form.customLineItems.map((line, i) => (
                          <div key={i} className="flex items-center gap-2 mb-1.5 px-3 py-2 bg-gray-50 rounded-sm">
                            <span className="text-sm text-charcoal flex-1">{line.label}</span>
                            <span className="text-sm font-semibold text-navy">{formatPrice(line.price || 0)}</span>
                            <button type="button" onClick={() => setForm((p) => ({ ...p, customLineItems: p.customLineItems.filter((_, j) => j !== i) }))}
                              className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                          </div>
                        ))}
                        <div className="flex gap-2 mt-1">
                          <input
                            type="text" value={customLabel}
                            onChange={(e) => setCustomLabel(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomLine())}
                            placeholder="e.g. Rush fee"
                            className="input-field flex-1 text-sm"
                          />
                          <input
                            type="number" value={customPrice}
                            onChange={(e) => setCustomPrice(e.target.value)}
                            placeholder="$0"
                            className="input-field w-24 text-sm"
                            min="0"
                          />
                          <button type="button" onClick={addCustomLine}
                            className="btn-outline px-3 text-sm">
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Photographer */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Photographer (optional)</p>
                    <div className="space-y-2">
                      {teamMembers.filter((m) => m.active !== false).length > 0 && (
                        <select
                          value={teamMembers.find((m) => m.email === form.photographerEmail)?.id || ""}
                          onChange={(e) => {
                            const member = teamMembers.find((m) => m.id === e.target.value);
                            if (member) setForm((p) => ({ ...p, photographerName: member.name, photographerEmail: member.email }));
                            else setForm((p) => ({ ...p, photographerName: "", photographerEmail: "" }));
                          }}
                          className="input-field w-full text-sm">
                          <option value="">— Select from your team —</option>
                          {teamMembers.filter((m) => m.active !== false).map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={form.photographerName} onChange={(e) => setField("photographerName", e.target.value)}
                          placeholder="Name (or external)"
                          className="input-field w-full text-sm"
                        />
                        <input
                          type="email"
                          value={form.photographerEmail} onChange={(e) => setField("photographerEmail", e.target.value)}
                          placeholder="Email for notification"
                          className="input-field w-full text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT: order summary ──────────────────────────────────── */}
                <div className="w-72 flex-shrink-0 px-6 py-6 flex flex-col bg-gray-50/60">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Order Summary</p>

                  {/* Line items */}
                  <div className="flex-1 space-y-2 mb-5">
                    {lines.length === 0 ? (
                      <p className="text-sm text-gray-300 italic">No services selected</p>
                    ) : (
                      lines.map((l, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 flex-1 pr-2">{l.name}</span>
                          <span className="text-xs font-semibold text-charcoal">{formatPrice(l.price || 0)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Tier badge */}
                  {tierLabel && form.sqft && (
                    <div className="text-xs px-2.5 py-1.5 bg-white border border-gray-200 rounded-sm text-gray-500 mb-4">
                      Priced as <span className="font-medium text-charcoal">{tierLabel}</span>
                      <span className="text-gray-300"> ({Number(form.sqft).toLocaleString()} sqft)</span>
                    </div>
                  )}

                  {/* Total */}
                  <div className="border-t border-gray-200 pt-4 mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">Total</span>
                      <span className="text-xl font-bold text-navy font-display">{formatPrice(total)}</span>
                    </div>

                    {/* Override total */}
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Override price</p>
                      <input
                        type="number"
                        value={form.totalPrice}
                        onChange={(e) => setField("totalPrice", e.target.value)}
                        placeholder={`Auto: ${formatPrice(pricing.subtotal + customTotal)}`}
                        className="input-field w-full text-sm"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Status + deposit */}
                  <div className="space-y-3 mb-5">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Booking status</p>
                      <select value={form.status} onChange={(e) => setField("status", e.target.value)}
                        className="input-field w-full text-sm">
                        <option value="confirmed">Confirmed</option>
                        <option value="requested">Pending review</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        onClick={() => setField("depositPaid", !form.depositPaid)}
                        className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${form.depositPaid ? "bg-navy" : "bg-gray-200"}`}
                      >
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${form.depositPaid ? "translate-x-4" : "translate-x-0.5"}`} />
                      </div>
                      <span className="text-xs text-gray-500">Deposit already collected</span>
                    </label>
                  </div>

                  {/* Notes */}
                  <div className="mb-6">
                    <p className="text-xs text-gray-400 mb-1">Internal notes</p>
                    <textarea
                      value={form.notes} onChange={(e) => setField("notes", e.target.value)}
                      rows={3}
                      placeholder="Called in — needs drone, gate code…"
                      className="input-field w-full text-sm resize-none"
                    />
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <button type="submit" disabled={saving}
                      className="w-full btn-primary py-3 text-sm font-semibold">
                      {saving ? "Creating…" : "Create Booking →"}
                    </button>
                    <button type="button"
                      onClick={() => { setShowCreate(false); setCreateError(""); setForm(EMPTY_FORM); setAgentQuery(""); setShowAgentDD(false); }}
                      className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
