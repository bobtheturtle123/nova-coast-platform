"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";

const STATUS_LABELS = {
  pending_payment: { label: "Awaiting payment", cls: "bg-gray-50 text-gray-600" },
  requested:       { label: "Pending review",   cls: "bg-amber-50 text-amber-700" },
  confirmed:       { label: "Confirmed",         cls: "bg-green-50 text-green-700" },
  completed:       { label: "Completed",         cls: "bg-blue-50 text-blue-700" },
  cancelled:       { label: "Cancelled",         cls: "bg-red-50 text-red-700" },
  payment_failed:  { label: "Payment failed",    cls: "bg-red-50 text-red-700" },
};

const EMPTY_FORM = {
  clientName: "", clientEmail: "", clientPhone: "",
  address: "", city: "", state: "CA", zip: "",
  preferredDate: "", preferredTime: "",
  notes: "", totalPrice: "", depositPaid: false, status: "confirmed",
  selectedPackage: "", selectedServices: [], selectedAddons: [],
  customLineItems: [], // [{ label, price }]
};

export default function BookingsPage() {
  const [bookings,    setBookings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState("all");
  const [showCreate,  setShowCreate]  = useState(false);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [createError, setCreateError] = useState("");
  const [catalog,     setCatalog]     = useState(null);
  const [newLineLabel, setNewLineLabel] = useState("");
  const [newLinePrice, setNewLinePrice] = useState("");

  useEffect(() => {
    loadBookings();
    loadCatalog();
  }, []);

  async function loadCatalog() {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    // Get the tenant's slug first, then load catalog
    const tenantRes = await fetch("/api/dashboard/tenant", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!tenantRes.ok) return;
    const { tenant } = await tenantRes.json();
    const catRes = await fetch(`/api/tenant-public/${tenant.slug}/catalog`);
    if (catRes.ok) setCatalog(await catRes.json());
  }

  async function loadBookings() {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch("/api/dashboard/bookings", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setBookings(data.bookings);
    }
    setLoading(false);
  }

  function setField(f) {
    return (e) => setForm((prev) => ({ ...prev, [f]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  }

  function toggleService(id) {
    setForm((prev) => ({
      ...prev,
      selectedPackage: "",
      selectedServices: prev.selectedServices.includes(id)
        ? prev.selectedServices.filter((s) => s !== id)
        : [...prev.selectedServices, id],
    }));
  }

  function toggleAddon(id) {
    setForm((prev) => ({
      ...prev,
      selectedAddons: prev.selectedAddons.includes(id)
        ? prev.selectedAddons.filter((a) => a !== id)
        : [...prev.selectedAddons, id],
    }));
  }

  function addCustomLine() {
    const label = newLineLabel.trim();
    const price = Number(newLinePrice) || 0;
    if (!label) return;
    setForm((prev) => ({ ...prev, customLineItems: [...prev.customLineItems, { label, price }] }));
    setNewLineLabel(""); setNewLinePrice("");
  }

  function removeCustomLine(i) {
    setForm((prev) => ({ ...prev, customLineItems: prev.customLineItems.filter((_, idx) => idx !== i) }));
  }

  function calcAutoPrice() {
    if (!catalog) return 0;
    let base = 0;
    if (form.selectedPackage) {
      const pkg = catalog.packages?.find((p) => p.id === form.selectedPackage);
      base = pkg?.price || 0;
    } else {
      base = form.selectedServices.reduce((sum, id) => {
        const svc = catalog.services?.find((s) => s.id === id);
        return sum + (svc?.price || 0);
      }, 0);
    }
    const addons = form.selectedAddons.reduce((sum, id) => {
      const a = catalog.addons?.find((x) => x.id === id);
      return sum + (a?.price || 0);
    }, 0);
    const custom = form.customLineItems.reduce((sum, l) => sum + (l.price || 0), 0);
    return base + addons + custom;
  }

  const autoPrice = calcAutoPrice();

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
      const finalPrice = form.totalPrice !== "" ? Number(form.totalPrice) : autoPrice;
      const res = await fetch("/api/dashboard/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...form,
          totalPrice:      finalPrice,
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

  const filtered = filter === "all"
    ? bookings
    : bookings.filter((b) => b.status === filter);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-navy">Bookings</h1>
        <button onClick={() => setShowCreate(true)}
          className="btn-primary px-4 py-2 text-sm">
          + New Booking
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "requested", "confirmed", "completed", "cancelled"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors
              ${filter === s ? "bg-navy text-white border-navy" : "text-gray-500 border-gray-200 hover:border-navy hover:text-navy"}`}>
            {s === "all" ? "All" : STATUS_LABELS[s]?.label || s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-sm border border-gray-200 p-12 text-center text-gray-400 text-sm">
          No bookings found.
        </div>
      ) : (
        <div className="bg-white rounded-sm border border-gray-200 divide-y divide-gray-50">
          {filtered.map((b) => {
            const s = STATUS_LABELS[b.status] || { label: b.status, cls: "bg-gray-50 text-gray-600" };
            return (
              <div key={b.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-navy truncate">{b.clientName}</p>
                    {b.source === "manual" && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">manual</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{b.fullAddress || b.address}</p>
                  <p className="text-xs text-gray-400">
                    {b.preferredDate ? new Date(b.preferredDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date set"}
                    {b.preferredTime && b.preferredTime !== "flexible" && b.preferredTime !== "morning" && b.preferredTime !== "afternoon"
                      ? ` · ${b.preferredTime}`
                      : b.preferredTime ? ` · ${b.preferredTime.charAt(0).toUpperCase() + b.preferredTime.slice(1)}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-navy">${(b.totalPrice || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">
                      {b.depositPaid ? "Deposit paid" : "No deposit"}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
                  <Link href={`/dashboard/bookings/${b.id}`}
                    className="text-xs text-navy hover:underline whitespace-nowrap">
                    View →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create booking modal ──────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8 px-4">
          <div className="bg-white rounded-sm shadow-xl w-full max-w-2xl my-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-display text-lg text-navy">New Manual Booking</h2>
              <button onClick={() => { setShowCreate(false); setCreateError(""); setForm(EMPTY_FORM); }}
                className="text-gray-400 hover:text-navy text-xl leading-none">×</button>
            </div>

            <form onSubmit={createBooking} className="p-6 space-y-5">
              {createError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-sm">
                  {createError}
                </div>
              )}

              {/* Client info */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Client Information</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label-field">Full Name *</label>
                      <input type="text" value={form.clientName} onChange={setField("clientName")}
                        className="input-field w-full" placeholder="Jane Smith" />
                    </div>
                    <div>
                      <label className="label-field">Phone</label>
                      <input type="tel" value={form.clientPhone} onChange={setField("clientPhone")}
                        className="input-field w-full" placeholder="(619) 555-0100" />
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Email *</label>
                    <input type="email" value={form.clientEmail} onChange={setField("clientEmail")}
                      className="input-field w-full" placeholder="jane@example.com" />
                  </div>
                </div>
              </div>

              {/* Property */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Property</p>
                <div className="space-y-3">
                  <div>
                    <label className="label-field">Street Address *</label>
                    <input type="text" value={form.address} onChange={setField("address")}
                      className="input-field w-full" placeholder="123 Ocean Dr" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="label-field">City</label>
                      <input type="text" value={form.city} onChange={setField("city")}
                        className="input-field w-full" />
                    </div>
                    <div>
                      <label className="label-field">State</label>
                      <input type="text" value={form.state} onChange={setField("state")}
                        className="input-field w-full" maxLength={2} />
                    </div>
                    <div>
                      <label className="label-field">ZIP</label>
                      <input type="text" value={form.zip} onChange={setField("zip")}
                        className="input-field w-full" maxLength={5} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Schedule</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-field">Shoot Date</label>
                    <input type="date" value={form.preferredDate} onChange={setField("preferredDate")}
                      className="input-field w-full" />
                  </div>
                  <div>
                    <label className="label-field">Shoot Time</label>
                    <input type="time" value={form.preferredTime} onChange={setField("preferredTime")}
                      className="input-field w-full" />
                  </div>
                </div>
              </div>

              {/* Services */}
              {catalog && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Services</p>

                  {/* Packages */}
                  {catalog.packages?.length > 0 && (
                    <div className="mb-3">
                      <label className="label-field">Package</label>
                      <select value={form.selectedPackage}
                        onChange={(e) => setForm((p) => ({ ...p, selectedPackage: e.target.value, selectedServices: [] }))}
                        className="input-field w-full text-sm">
                        <option value="">— None (build custom) —</option>
                        {catalog.packages.map((pkg) => (
                          <option key={pkg.id} value={pkg.id}>{pkg.name} — ${pkg.price?.toLocaleString()}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Individual services (when no package selected) */}
                  {!form.selectedPackage && catalog.services?.length > 0 && (
                    <div className="mb-3">
                      <label className="label-field">Services</label>
                      <div className="space-y-1 max-h-36 overflow-y-auto border border-gray-200 rounded-sm p-2">
                        {catalog.services.map((svc) => (
                          <label key={svc.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-sm">
                            <input type="checkbox" checked={form.selectedServices.includes(svc.id)}
                              onChange={() => toggleService(svc.id)} className="rounded" />
                            <span className="flex-1 text-charcoal">{svc.name}</span>
                            <span className="text-gray-400 text-xs">${svc.price?.toLocaleString()}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add-ons */}
                  {catalog.addons?.length > 0 && (
                    <div className="mb-3">
                      <label className="label-field">Add-ons</label>
                      <div className="space-y-1 max-h-28 overflow-y-auto border border-gray-200 rounded-sm p-2">
                        {catalog.addons.map((a) => (
                          <label key={a.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-1 py-0.5 rounded text-sm">
                            <input type="checkbox" checked={form.selectedAddons.includes(a.id)}
                              onChange={() => toggleAddon(a.id)} className="rounded" />
                            <span className="flex-1 text-charcoal">{a.name}</span>
                            <span className="text-gray-400 text-xs">${a.price?.toLocaleString()}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom line items */}
                  <div>
                    <label className="label-field">Custom Line Items</label>
                    {form.customLineItems.map((line, i) => (
                      <div key={i} className="flex items-center gap-2 mb-1">
                        <span className="text-sm flex-1 text-charcoal">{line.label}</span>
                        <span className="text-sm text-navy">${(line.price || 0).toLocaleString()}</span>
                        <button onClick={() => removeCustomLine(i)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-1">
                      <input type="text" value={newLineLabel} onChange={(e) => setNewLineLabel(e.target.value)}
                        placeholder="Description" className="input-field flex-1 text-sm" />
                      <input type="number" value={newLinePrice} onChange={(e) => setNewLinePrice(e.target.value)}
                        placeholder="$" className="input-field w-20 text-sm" min="0" />
                      <button type="button" onClick={addCustomLine}
                        className="btn-outline px-3 py-2 text-sm">+ Add</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Pricing & status */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Pricing & Status</p>
                {autoPrice > 0 && (
                  <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1.5 mb-3">
                    Auto-calculated total: <strong>${autoPrice.toLocaleString()}</strong> — leave price blank to use this
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-field">Total Price ($) <span className="font-normal text-gray-400">— override auto</span></label>
                    <input type="number" value={form.totalPrice} onChange={setField("totalPrice")}
                      className="input-field w-full" placeholder={autoPrice > 0 ? `Auto: $${autoPrice}` : "0"} min="0" />
                  </div>
                  <div>
                    <label className="label-field">Status</label>
                    <select value={form.status} onChange={setField("status")} className="input-field w-full">
                      <option value="confirmed">Confirmed</option>
                      <option value="requested">Pending review</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input type="checkbox" id="depositPaid" checked={form.depositPaid} onChange={setField("depositPaid")}
                    className="rounded border-gray-300 text-navy" />
                  <label htmlFor="depositPaid" className="text-sm text-gray-600 cursor-pointer">
                    Mark deposit as paid (client already paid)
                  </label>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label-field">Notes (internal)</label>
                <textarea value={form.notes} onChange={setField("notes")} rows={2}
                  className="input-field w-full text-sm" placeholder="Called in, requested exterior + drone…" />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button type="button"
                  onClick={() => { setShowCreate(false); setCreateError(""); setForm(EMPTY_FORM); }}
                  className="btn-outline px-6 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary px-6 py-2 text-sm">
                  {saving ? "Creating…" : "Create Booking"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
