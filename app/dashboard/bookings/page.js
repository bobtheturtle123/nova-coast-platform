"use client";

import { useEffect, useState, useRef } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { getSqftTier, getItemPrice, calculateTenantPrice, getActiveTiers, formatPrice } from "@/lib/catalogUtils";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import { resolveWorkflowStatus } from "@/lib/workflowStatus";
import { useDashboardPermissions } from "@/lib/dashboardPermissions";

const STATUS_LABELS = {
  pending_payment: { label: "Awaiting payment", cls: "bg-gray-50 text-gray-500" },
  requested:       { label: "Pending review",   cls: "bg-amber-50 text-amber-600" },
  confirmed:       { label: "Confirmed",         cls: "bg-[#EEF5FC] text-[#1E5A8A]" },
  completed:       { label: "Completed",         cls: "bg-emerald-50 text-emerald-700" },
  cancelled:       { label: "Cancelled",         cls: "bg-red-50 text-red-500" },
  payment_failed:  { label: "Payment failed",    cls: "bg-red-50 text-red-500" },
};

const EMPTY_FORM = {
  clientName: "", clientEmail: "", clientPhone: "",
  address: "", unit: "", city: "", state: "CA", zip: "", sqft: "", apn: "",
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
      className={`relative text-left rounded-xl border p-4 transition-all ${
        selected
          ? "border-[#3486cf] bg-[#3486cf] text-white"
          : "border-gray-200 bg-white hover:border-[#3486cf]/40"
      }`}
    >
      <p className={`text-sm font-semibold leading-tight ${selected ? "text-white" : "text-[#0F172A]"}`}>
        {pkg.name}
      </p>
      {pkg.description && (
        <p className={`text-xs mt-0.5 leading-snug ${selected ? "text-white/70" : "text-gray-400"}`}>
          {pkg.description}
        </p>
      )}
      <p className={`text-base font-bold mt-2 ${selected ? "text-white/90" : "text-[#3486cf]"}`}>
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
      className={`w-full rounded-xl border transition-all ${
        checked
          ? "border-[#3486cf]/60 bg-[#3486cf]/5"
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
            checked ? "bg-[#3486cf] border-[#3486cf]" : "border-gray-300"
          }`}>
            {checked && (
              <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <div>
            <p className="text-sm text-[#0F172A] font-medium leading-none">{item.name}</p>
            {item.description && !long && (
              <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
            )}
            {item.description && long && !expanded && (
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>
            )}
          </div>
        </div>
        <span className="text-sm font-semibold text-[#3486cf] ml-4 flex-shrink-0">{formatPrice(price)}</span>
      </button>
      {item.description && long && (
        <div className="px-3 pb-2">
          {expanded && (
            <p className="text-xs text-gray-500 leading-relaxed mb-1">{item.description}</p>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
            className="text-xs text-[#3486cf]/60 hover:text-[#3486cf] underline underline-offset-2"
          >
            {expanded ? "Show less" : "Read more"}
          </button>
        </div>
      )}
    </div>
  );
}

const TIME_OPTIONS = [
  "7:00 AM","8:00 AM","8:30 AM","9:00 AM","9:30 AM","10:00 AM","10:30 AM",
  "11:00 AM","11:30 AM","12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM",
];

function timeToValue(label) {
  const [time, ampm] = label.split(" ");
  let [h, m] = time.split(":").map(Number);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}

function valueToLabel(val) {
  if (!val) return "";
  const [h, m] = val.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
}

function DateTimePicker({ date, time, onConfirm, onClose }) {
  const today = new Date();
  const initDate = date ? new Date(date + "T12:00:00") : today;
  const [viewYear,  setViewYear]  = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  const [selDate,   setSelDate]   = useState(date || "");
  const [selTime,   setSelTime]   = useState(time || "");

  const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function firstDow(y, m)    { return new Date(y, m, 1).getDay(); }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  const totalDays = daysInMonth(viewYear, viewMonth);
  const startDow  = firstDow(viewYear, viewMonth);
  const cells = [...Array(startDow).fill(null), ...Array.from({length: totalDays}, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function dateStr(day) {
    return `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  return (
    <div className="modal-backdrop" style={{ zIndex: 60 }} onClick={onClose}>
      <div className="modal-card relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">‹</button>
            <p className="font-semibold text-sm text-[#0F172A]">{MONTHS[viewMonth]} {viewYear}</p>
            <button type="button" onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500">›</button>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>)}
          </div>
          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-y-1 mb-4">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const ds = dateStr(day);
              const isSelected = selDate === ds;
              const isToday = ds === todayStr;
              const isPast  = ds < todayStr;
              return (
                <button key={i} type="button" disabled={isPast}
                  onClick={() => setSelDate(ds)}
                  className={`w-8 h-8 mx-auto rounded-full text-sm transition-colors ${
                    isSelected ? "bg-[#3486cf] text-white font-semibold" :
                    isToday    ? "border border-[#3486cf] text-[#3486cf] font-semibold" :
                    isPast     ? "text-gray-200 cursor-not-allowed" :
                    "hover:bg-[#3486cf]/10 text-[#0F172A]"
                  }`}>
                  {day}
                </button>
              );
            })}
          </div>
          {/* Time grid */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Time</p>
          <div className="grid grid-cols-5 gap-1 mb-4">
            {TIME_OPTIONS.map((t) => {
              const val = timeToValue(t);
              return (
                <button key={t} type="button" onClick={() => setSelTime(val)}
                  className={`py-1.5 text-xs rounded transition-colors ${
                    selTime === val ? "bg-[#3486cf] text-white font-semibold" : "bg-gray-50 hover:bg-[#3486cf]/10 text-[#0F172A]"
                  }`}>
                  {t}
                </button>
              );
            })}
          </div>
          {/* Actions */}
          <div className="flex gap-2">
            <button type="button" onClick={() => onConfirm("", "")}
              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2">Clear</button>
            <div className="flex-1" />
            <button type="button" onClick={onClose}
              className="btn-outline px-4 py-2 text-sm">Cancel</button>
            <button type="button" onClick={() => onConfirm(selDate, selTime)} disabled={!selDate}
              className="btn-primary px-4 py-2 text-sm">
              Set Date
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingsPage() {
  const { permissions, userRole } = useDashboardPermissions();
  const canViewPricing = userRole === "owner" || userRole === "admin" || !!permissions?.canViewRevenue;

  const [bookings,    setBookings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [hasMore,     setHasMore]     = useState(false);
  const [cursor,      setCursor]      = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter,      setFilter]      = useState("all");
  const [search,      setSearch]      = useState("");
  const [showCreate,  setShowCreate]  = useState(false);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [saving,      setSaving]      = useState(false);
  const [createError, setCreateError] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [catalog,     setCatalog]     = useState(null);
  const [customLabel, setCustomLabel] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [agents,       setAgents]      = useState([]);
  const [teamMembers,  setTeamMembers] = useState([]);
  const [agentQuery,   setAgentQuery]  = useState("");
  const [showAgentDD,  setShowAgentDD] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", email: "", phone: "" });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [enableApn,         setEnableApn]         = useState(false);
  const [tenantSlug,        setTenantSlug]        = useState(null);
  const tenantSlugRef = useRef(null);
  const [zonePhotographers, setZonePhotographers] = useState(null); // null=unchecked []=[ids]
  const [zoneName,          setZoneName]          = useState(null);
  const zoneDebounceRef = useRef(null);

  useEffect(() => {
    loadBookings();
    loadCatalog();
  }, []);

  // Debounce zone check on manual address entry
  useEffect(() => {
    if (!form.city || !form.zip) return;
    clearTimeout(zoneDebounceRef.current);
    zoneDebounceRef.current = setTimeout(() => {
      checkZonePhotographers(form.address, form.city, form.state, form.zip);
    }, 1200);
    return () => clearTimeout(zoneDebounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.address, form.city, form.state, form.zip]);

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
    if (catRes.ok)    {
      const catData = await catRes.json();
      setCatalog(catData);
      if (catData.bookingConfig?.enableApn) setEnableApn(true);
    }
    if (agentsRes.ok) { const d = await agentsRes.json(); setAgents(d.agents || []); }
    if (teamRes.ok)   { const d = await teamRes.json();   setTeamMembers(d.members || []); }
    tenantSlugRef.current = tenant.slug;
    setTenantSlug(tenant.slug);
  }

  async function checkZonePhotographers(address, city, state, zip) {
    const slug = tenantSlugRef.current;
    if (!slug) return;
    const fullAddress = [address, city, state, zip].filter(Boolean).join(", ");
    if (!fullAddress.trim()) return;
    try {
      const res = await fetch(`/api/tenant-public/${slug}/check-service-area`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: fullAddress }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.covered && data.assignedPhotographers?.length > 0) {
        setZonePhotographers(data.assignedPhotographers);
        setZoneName(data.zoneName);
      } else {
        setZonePhotographers(null);
        setZoneName(null);
      }
    } catch { /* ignore */ }
  }

  async function loadBookings(afterCursor = null, append = false) {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) { if (!append) setLoading(false); return; }
      const url = afterCursor
        ? `/api/dashboard/bookings?limit=50&after=${encodeURIComponent(afterCursor)}`
        : "/api/dashboard/bookings?limit=50";
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setBookings((prev) => append ? [...prev, ...(data.bookings || [])] : (data.bookings || []));
        setHasMore(data.hasMore || false);
        setCursor(data.nextCursor || null);
      }
    } catch { /* ignore */ }
    if (!append) setLoading(false);
  }

  async function handleLoadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    await loadBookings(cursor, true);
    setLoadingMore(false);
  }

  function exportBookingsCSV() {
    const headers = ["ID","Client Name","Email","Phone","Address","City","State","Zip","Date","Time","Package/Services","Total","Deposit Paid","Balance Paid","Status","Twilight Time","Notes","Created At"];
    const rows = bookings.map((b) => [
      b.id,
      b.clientName || "",
      b.clientEmail || "",
      b.clientPhone || "",
      b.address || "",
      b.city || "",
      b.state || "",
      b.zip || "",
      b.preferredDate || b.shootDate || "",
      b.preferredTime || "",
      [b.packageId, ...(b.serviceIds || [])].filter(Boolean).join("; "),
      b.totalPrice ?? "",
      b.depositPaid ? "Yes" : "No",
      b.balancePaid ? "Yes" : "No",
      b.status || "",
      b.twilightTime || "",
      (b.notes || "").replace(/\n/g, " "),
      b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `bookings-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
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

  async function saveNewCustomer() {
    if (!newCustomer.name.trim() || !newCustomer.email.trim()) return;
    setSavingCustomer(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/dashboard/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(newCustomer),
      });
      if (res.ok) {
        const data = await res.json();
        const created = data.agent || { ...newCustomer, id: Date.now() };
        setAgents((prev) => [...prev, created]);
        setForm((p) => ({ ...p, clientName: created.name, clientEmail: created.email, clientPhone: created.phone || "" }));
        setAgentQuery(created.name);
        setShowNewCustomer(false);
        setNewCustomer({ name: "", email: "", phone: "" });
      }
    } catch { /* ignore */ }
    setSavingCustomer(false);
  }

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
          apn:             form.apn || null,
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

  const filtered = bookings.filter((b) => {
    if (filter !== "all" && b.status !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const name    = (b.clientName || "").toLowerCase();
      const addr    = (b.fullAddress || b.address || "").toLowerCase();
      const email   = (b.clientEmail || "").toLowerCase();
      if (!name.includes(q) && !addr.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Bookings</h1>
          <p className="page-subtitle">Track and manage your shoot appointments</p>
        </div>
        <div className="flex items-center gap-2">
          {bookings.length > 0 && (
            <button onClick={exportBookingsCSV}
              className="btn-outline px-4 py-2 text-sm flex items-center gap-1.5">
              Export CSV
            </button>
          )}
          <Link href="/dashboard/bookings/create" className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5">
            + New Booking
          </Link>
        </div>
      </div>

      {/* Filter pills + search */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-2 flex-wrap">
          {["all", "requested", "confirmed", "completed", "cancelled"].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors
                ${filter === s ? "bg-[#3486cf] text-white border-[#3486cf]" : "text-gray-500 border-gray-200 hover:border-[#3486cf]/40 hover:text-[#3486cf]"}`}>
              {s === "all" ? "All" : STATUS_LABELS[s]?.label || s}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, address…"
            className="input-field pl-8 text-sm w-52"
          />
        </div>
      </div>

      {/* Bookings list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center text-gray-400 text-sm">
          No bookings found.
        </div>
      ) : (
        <div className="card-section overflow-hidden">
          {filtered.map((b) => {
            const s           = STATUS_LABELS[b.status] || { label: b.status, cls: "bg-gray-50 text-gray-500" };
            const wfStatus    = resolveWorkflowStatus(b);
            const dateStr = b.preferredDate
              ? new Date(b.preferredDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "No date";
            const timeStr = b.preferredTime && !["flexible","morning","afternoon"].includes(b.preferredTime)
              ? ` · ${b.preferredTime}` : "";
            return (
              <div key={b.id} className="px-6 py-4 flex items-center gap-4 transition-colors"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgb(15 23 42 / 0.022)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{b.clientName}</p>
                    {b.source === "manual" && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded">manual</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{b.fullAddress || b.address}</p>
                  <p className="text-xs text-gray-300">{dateStr}{timeStr}</p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  {canViewPricing && (
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold text-[#0F172A]">${(b.totalPrice || 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{b.depositPaid ? "Deposit paid" : "No deposit"}</p>
                    </div>
                  )}
                  <WorkflowStatusBadge status={wfStatus} size="xs" />
                  <Link href={`/dashboard/bookings/${b.id}`} className="text-xs text-[#3486cf] hover:underline whitespace-nowrap">
                    Open →
                  </Link>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <div className="px-6 py-4 flex justify-center" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <button onClick={handleLoadMore} disabled={loadingMore}
                className="px-6 py-2 text-sm font-semibold rounded-xl border transition-colors"
                style={{ background: "#fff", border: "1px solid var(--border)", color: loadingMore ? "#94A3B8" : "#0F172A" }}>
                {loadingMore ? "Loading…" : "Load more bookings"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Create booking modal ──────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-4"
          style={{ background: "rgb(0 0 0 / 0.48)", backdropFilter: "blur(6px)" }}>
          <div className="relative bg-white w-full max-w-4xl my-auto" style={{ borderRadius: "18px", boxShadow: "var(--shadow-modal)" }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-8 py-5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <h2 className="font-semibold text-[#0F172A] text-base">New Booking</h2>
                <p className="text-xs text-gray-400 mt-0.5">Manually create a confirmed booking for a phone or in-person client.</p>
              </div>
              <button
                onClick={() => { setShowCreate(false); setCreateError(""); setForm(EMPTY_FORM); setAgentQuery(""); setShowAgentDD(false); }}
                className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-xl leading-none transition-colors">
                ×
              </button>
            </div>

            <form onSubmit={createBooking}>
              <div className="flex flex-col sm:flex-row" style={{ borderTop: "none" }}>

                {/* ── LEFT: form fields ─────────────────────────────────────── */}
                <div className="flex-1 px-5 sm:px-8 py-6 space-y-7 overflow-y-auto max-h-[60vh] sm:max-h-[70vh]">

                  {createError && (
                    <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-2.5 rounded-xl">
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
                                    <div className="w-7 h-7 rounded-full bg-[#3486cf]/10 flex items-center justify-center text-xs font-semibold text-[#3486cf] flex-shrink-0">
                                      {a.name?.[0]?.toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm text-[#0F172A] font-medium truncate">{a.name}</p>
                                      <p className="text-xs text-gray-400 truncate">{a.email}</p>
                                    </div>
                                  </button>
                                ))}
                              {agents.filter((a) => {
                                const q = agentQuery.toLowerCase();
                                return a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q);
                              }).length === 0 && (
                                <div>
                                  <p className="px-4 py-3 text-sm text-gray-400 text-center">No matching customers</p>
                                  <button type="button" onMouseDown={() => { setShowNewCustomer(true); setShowAgentDD(false); }}
                                    className="w-full text-left px-4 py-2.5 text-sm text-[#3486cf] font-medium hover:bg-[#3486cf]/5 border-t border-gray-50">
                                    + Add as new customer
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {agents.length === 0 && !showNewCustomer && (
                        <button type="button" onClick={() => setShowNewCustomer(true)}
                          className="text-xs text-[#3486cf] underline hover:no-underline">
                          + Add new customer
                        </button>
                      )}
                      {showNewCustomer && (
                        <div className="bg-[#3486cf]/5 border border-[#3486cf]/15 rounded-lg p-3 space-y-2">
                          <p className="text-xs font-semibold text-[#1E5A8A]">New Customer</p>
                          <input type="text" value={newCustomer.name}
                            onChange={(e) => setNewCustomer((c) => ({ ...c, name: e.target.value }))}
                            placeholder="Full name *" className="input-field w-full text-sm" autoFocus />
                          <input type="email" value={newCustomer.email}
                            onChange={(e) => setNewCustomer((c) => ({ ...c, email: e.target.value }))}
                            placeholder="Email *" className="input-field w-full text-sm" />
                          <input type="tel" value={newCustomer.phone}
                            onChange={(e) => setNewCustomer((c) => ({ ...c, phone: e.target.value }))}
                            placeholder="Phone (optional)" className="input-field w-full text-sm" />
                          <div className="flex gap-2">
                            <button type="button" onClick={saveNewCustomer} disabled={savingCustomer || !newCustomer.name || !newCustomer.email}
                              className="btn-primary px-3 py-1.5 text-xs">
                              {savingCustomer ? "Saving…" : "Save & Use"}
                            </button>
                            <button type="button" onClick={() => { setShowNewCustomer(false); setNewCustomer({ name: "", email: "", phone: "" }); }}
                              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">Cancel</button>
                          </div>
                        </div>
                      )}
                      <input
                        type="text" autoFocus={!showNewCustomer}
                        value={form.clientName} onChange={(e) => setField("clientName", e.target.value)}
                        placeholder="Full name *"
                        className="input-field w-full"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      <div className="relative">
                        <PlacesAutocomplete
                          value={form.address}
                          onChange={(val) => setField("address", val)}
                          onSelect={(parts) => {
                            setForm((p) => ({ ...p, address: parts.address, city: parts.city, state: parts.state, zip: parts.zip }));
                            checkZonePhotographers(parts.address, parts.city, parts.state, parts.zip);
                          }}
                          placeholder="Street address *"
                        />
                      </div>
                      <input
                        type="text"
                        value={form.unit} onChange={(e) => setField("unit", e.target.value)}
                        placeholder="Unit / Apt / Suite (optional)"
                        className="input-field w-full text-sm"
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
                            placeholder={pricingMode === "photos" ? "Photo count (for pricing)" : pricingMode === "custom" ? `${catalog?.pricingConfig?.customGateLabel || "Custom value"} (for pricing)` : "Square footage (for pricing)"}
                            className="input-field flex-1"
                            min="0"
                          />
                          {tierLabel && (
                            <span className="text-xs px-2.5 py-1.5 rounded-xl bg-[#3486cf]/10 text-[#3486cf] font-medium whitespace-nowrap">
                              {tierLabel}
                            </span>
                          )}
                        </div>
                      )}
                      {enableApn && (
                        <input
                          type="text"
                          value={form.apn} onChange={(e) => setField("apn", e.target.value)}
                          placeholder="APN (Assessor Parcel Number) — land/lot optional"
                          className="input-field w-full text-sm"
                        />
                      )}
                    </div>
                  </div>

                  {/* Schedule */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Schedule</p>
                    <button type="button" onClick={() => setShowDatePicker(true)}
                      className="input-field w-full text-left flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 flex-shrink-0">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <span className={form.preferredDate ? "text-[#0F172A]" : "text-gray-400"}>
                        {form.preferredDate
                          ? `${new Date(form.preferredDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}${form.preferredTime ? ` · ${form.preferredTime}` : ""}`
                          : "Select date & time"}
                      </span>
                    </button>
                    <p className="text-xs text-gray-400 mt-2">A calendar invite will be emailed to the client and photographer if a date and time are set.</p>
                  </div>

                  {/* Services */}
                  {catalog && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Services</p>

                      {/* Packages */}
                      {catalog.packages?.filter((p) => p.active !== false).length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-400 mb-2">Packages</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

                      {/* Custom line items — hidden from members without pricing access */}
                      {canViewPricing && (
                        <div>
                          <p className="text-xs text-gray-400 mb-2">Custom items</p>
                          {form.customLineItems.map((line, i) => (
                            <div key={i} className="flex items-center gap-2 mb-1.5 px-3 py-2 bg-gray-50 rounded-xl">
                              <span className="text-sm text-[#0F172A] flex-1">{line.label}</span>
                              <span className="text-sm font-semibold text-[#3486cf]">{formatPrice(line.price || 0)}</span>
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
                      )}
                    </div>
                  )}

                  {/* Photographer */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Photographer (optional)</p>
                    {zoneName && (
                      <p className="text-xs text-[#1E5A8A] bg-[#EEF5FC] border border-[#3486cf]/10 rounded px-2 py-1 mb-2">
                        Showing photographers for <strong>{zoneName}</strong> zone
                      </p>
                    )}
                    <div className="space-y-2">
                      {teamMembers.filter((m) => m.active !== false && (!m.role || m.role === "photographer" || m.role === "assistant")).length > 0 && (
                        <select
                          value={teamMembers.find((m) => m.email === form.photographerEmail)?.id || ""}
                          onChange={(e) => {
                            const member = teamMembers.find((m) => m.id === e.target.value);
                            if (member) setForm((p) => ({ ...p, photographerName: member.name, photographerEmail: member.email }));
                            else setForm((p) => ({ ...p, photographerName: "", photographerEmail: "" }));
                          }}
                          className="input-field w-full text-sm">
                          <option value="">— Select from your team —</option>
                          {teamMembers
                            .filter((m) => m.active !== false && (!m.role || m.role === "photographer" || m.role === "assistant"))
                            .filter((m) => !zonePhotographers || zonePhotographers.includes(m.id))
                            .map((m) => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="w-full sm:w-72 flex-shrink-0 px-5 sm:px-6 py-6 flex flex-col rounded-b-[18px] sm:rounded-b-none sm:rounded-r-[18px]"
                  style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--border-subtle)" }}>
                  {canViewPricing && (
                    <>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Order Summary</p>

                      {/* Line items */}
                      <div className="flex-1 space-y-2 mb-5">
                        {lines.length === 0 ? (
                          <p className="text-sm text-gray-300 italic">No services selected</p>
                        ) : (
                          lines.map((l, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-xs text-gray-500 flex-1 pr-2">{l.name}</span>
                              <span className="text-xs font-semibold text-[#0F172A]">{formatPrice(l.price || 0)}</span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Tier badge */}
                      {tierLabel && form.sqft && (
                        <div className="text-xs px-2.5 py-1.5 bg-white border border-gray-200 rounded-xl text-gray-500 mb-4">
                          Priced as <span className="font-medium text-[#0F172A]">{tierLabel}</span>
                          <span className="text-gray-300"> ({Number(form.sqft).toLocaleString()} sqft)</span>
                        </div>
                      )}

                      {/* Total */}
                      <div className="border-t border-gray-200 pt-4 mb-5">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500">Total</span>
                          <span className="text-xl font-bold text-[#0F172A] font-display">{formatPrice(total)}</span>
                        </div>
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
                    </>
                  )}

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
                        className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${form.depositPaid ? "bg-[#3486cf]" : "bg-gray-200"}`}
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

            {showDatePicker && (
              <DateTimePicker
                date={form.preferredDate}
                time={form.preferredTime}
                onConfirm={(d, t) => { setField("preferredDate", d); setField("preferredTime", t); setShowDatePicker(false); }}
                onClose={() => setShowDatePicker(false)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
