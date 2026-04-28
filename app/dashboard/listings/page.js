"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { id: "all",       label: "All" },
  { id: "requested", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "completed", label: "Complete" },
  { id: "delivered", label: "Delivered" },
];

const PAY_FILTERS = [
  { id: "any",     label: "Any payment" },
  { id: "paid",    label: "Paid in full" },
  { id: "deposit", label: "Deposit only" },
  { id: "unpaid",  label: "Unpaid" },
];

const SORT_OPTIONS = [
  { id: "newest",   label: "Newest first" },
  { id: "oldest",   label: "Oldest first" },
  { id: "price_hi", label: "Price: high → low" },
  { id: "price_lo", label: "Price: low → high" },
  { id: "alpha",    label: "A → Z" },
];

const STATUS_META = {
  pending_payment: { label: "Awaiting Payment", bg: "#FFF8ED", text: "#D97706", dot: "#FBBF24" },
  requested:       { label: "Pending Review",   bg: "#FFFBEB", text: "#B45309", dot: "#F59E0B" },
  confirmed:       { label: "Confirmed",         bg: "#EFF6FF", text: "#1D4ED8", dot: "#3B82F6" },
  completed:       { label: "Completed",         bg: "#ECFDF5", text: "#059669", dot: "#10B981" },
  cancelled:       { label: "Cancelled",         bg: "#F9FAFB", text: "#6B7280", dot: "#9CA3AF" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarColor(str) {
  const p = ["#0B2A55","#1e6091","#2e7d32","#6a1b9a","#d84315","#00695c","#b5872d","#c0392b"];
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

function initials(name) {
  return (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function formatDate(d) {
  if (!d) return null;
  const dt = new Date(d.includes("T") ? d : d + "T12:00:00");
  return isNaN(dt) ? null : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateShort(d) {
  if (!d) return null;
  const dt = new Date(d.includes("T") ? d : d + "T12:00:00");
  if (isNaN(dt)) return null;
  const today    = new Date();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  if (dt.toDateString() === today.toDateString())    return { label: "Today",    highlight: "navy" };
  if (dt.toDateString() === tomorrow.toDateString()) return { label: "Tomorrow", highlight: "amber" };
  return { label: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }), highlight: null };
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.requested;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ background: m.bg, color: m.text }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: m.dot }} />
      {m.label}
    </span>
  );
}

function PayBadge({ listing }) {
  if (listing.paidInFull || listing.balancePaid)
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">Paid in full</span>;
  if (listing.depositPaid)
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">Deposit paid</span>;
  return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-gray-50 text-gray-500 border-gray-200">Unpaid</span>;
}

function DateChip({ d }) {
  const info = formatDateShort(d);
  if (!info) return <span className="text-xs text-gray-300">—</span>;
  if (info.highlight === "navy")
    return <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white" style={{ background: "#0B2A55" }}>Today</span>;
  if (info.highlight === "amber")
    return <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700">Tomorrow</span>;
  return (
    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-gray-600"
      style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)" }}>
      {info.label}
    </span>
  );
}

// ── Grid card ─────────────────────────────────────────────────────────────────
function ListingCard({ listing }) {
  const coverUrl    = listing.gallery?.coverUrl;
  const shootDate   = listing.shootDate || listing.preferredDate;
  const fullDate    = formatDate(shootDate);
  const aColor      = avatarColor(listing.clientName || "");
  const meta        = STATUS_META[listing.status] || STATUS_META.requested;
  const streetAddr  = listing.address?.split(",")[0] || listing.fullAddress?.split(",")[0];
  const cityLine    = listing.city ? `${listing.city}${listing.state ? `, ${listing.state}` : ""}` : listing.address?.split(",").slice(1, 2).join("").trim();

  return (
    <Link href={`/dashboard/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden transition-all duration-200"
      style={{ background: "#fff", borderRadius: 18, border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,0.1)"; e.currentTarget.style.borderColor = "var(--border)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; e.currentTarget.style.borderColor = "var(--border-subtle)"; }}>

      {/* Image area */}
      <div className="relative h-[188px] flex-shrink-0 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)" }}>
        {coverUrl ? (
          <img src={coverUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#CBD5E1" strokeWidth="0.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <p className="text-[11px] font-medium text-gray-300">No photo yet</p>
          </div>
        )}

        {coverUrl && (
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.12) 55%, transparent 80%)" }} />
        )}

        {/* Status badge top-left */}
        <div className="absolute top-3 left-3">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={coverUrl
              ? { background: "rgba(0,0,0,0.5)", color: "#fff", backdropFilter: "blur(6px)" }
              : { background: meta.bg, color: meta.text }}>
            {meta.label}
          </span>
        </div>

        {/* Media count badge */}
        {listing.gallery?.mediaCount > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(0,0,0,0.42)", color: "#fff", backdropFilter: "blur(4px)" }}>
            <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {listing.gallery.mediaCount}
          </div>
        )}

        {/* Overlaid address on covered image */}
        {coverUrl && (
          <div className="absolute bottom-3 left-4 right-4">
            <p className="text-white text-sm font-semibold leading-tight line-clamp-1" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
              {streetAddr}
            </p>
            {cityLine && <p className="text-white/65 text-[11px] mt-0.5 line-clamp-1">{cityLine}</p>}
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-3">
        {!coverUrl && (
          <div>
            <p className="text-sm font-semibold text-[#0F172A] leading-tight line-clamp-1">{streetAddr}</p>
            {cityLine && <p className="text-[11px] text-gray-400 mt-0.5">{cityLine}</p>}
          </div>
        )}

        {/* Client */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
            style={{ background: aColor }}>
            {initials(listing.clientName)}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#0F172A] truncate">{listing.clientName}</p>
            {listing.clientEmail && <p className="text-[10px] text-gray-400 truncate">{listing.clientEmail}</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 flex items-end justify-between gap-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <div>
            <p className="text-base font-bold text-[#0F172A] leading-none mb-1.5">${listing.totalPrice?.toLocaleString()}</p>
            <PayBadge listing={listing} />
          </div>
          {fullDate && (
            <div className="text-right flex-shrink-0">
              <p className="text-[9px] font-semibold text-gray-300 uppercase tracking-wider mb-0.5">Shoot</p>
              <p className="text-[11px] font-semibold text-gray-500">{fullDate}</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── List row columns ──────────────────────────────────────────────────────────
const COLS = "52px 1fr 126px 154px 112px 76px 22px";

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ListingsPage() {
  const [listings,  setListings]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("all");
  const [payFilter, setPayFilter] = useState("any");
  const [sortBy,    setSortBy]    = useState("newest");
  const [search,    setSearch]    = useState("");
  const [view,      setView]      = useState("list");

  useEffect(() => {
    auth.currentUser?.getIdToken(true).then(async (token) => {
      const res = await fetch("/api/dashboard/listings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) { const data = await res.json(); setListings(data.listings); }
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    let list = listings;
    if (filter === "delivered") {
      list = list.filter((l) => l.gallery?.delivered);
    } else if (filter !== "all") {
      list = list.filter((l) => l.status === filter);
    }
    if (payFilter === "paid")    list = list.filter((l) => l.paidInFull || l.balancePaid);
    else if (payFilter === "deposit") list = list.filter((l) => l.depositPaid && !l.paidInFull && !l.balancePaid);
    else if (payFilter === "unpaid")  list = list.filter((l) => !l.depositPaid && !l.paidInFull && !l.balancePaid);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        l.fullAddress?.toLowerCase().includes(q) ||
        l.address?.toLowerCase().includes(q) ||
        l.clientName?.toLowerCase().includes(q) ||
        l.clientEmail?.toLowerCase().includes(q)
      );
    }
    list = [...list];
    if (sortBy === "newest")   list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    else if (sortBy === "oldest")   list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    else if (sortBy === "price_hi") list.sort((a, b) => (b.totalPrice || 0) - (a.totalPrice || 0));
    else if (sortBy === "price_lo") list.sort((a, b) => (a.totalPrice || 0) - (b.totalPrice || 0));
    else if (sortBy === "alpha")    list.sort((a, b) => (a.address || a.fullAddress || "").localeCompare(b.address || b.fullAddress || ""));
    return list;
  }, [listings, filter, payFilter, sortBy, search]);

  const counts = useMemo(() => ({
    all:       listings.length,
    requested: listings.filter((l) => l.status === "requested").length,
    confirmed: listings.filter((l) => l.status === "confirmed").length,
    completed: listings.filter((l) => l.status === "completed").length,
    delivered: listings.filter((l) => l.gallery?.delivered).length,
  }), [listings]);

  const revenue = useMemo(() =>
    listings.reduce((s, l) => {
      if (l.paidInFull || l.balancePaid) return s + (l.totalPrice || 0);
      if (l.depositPaid)                 return s + (l.depositAmount || 0);
      return s;
    }, 0),
  [listings]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-[1400px] mx-auto px-6 py-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-0.5">Property Management</p>
            <h1 className="text-[26px] font-bold text-[#0F172A] leading-tight tracking-tight">Listings</h1>
            {!loading && (
              <p className="text-sm text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                <span>{listings.length} total</span>
                {counts.confirmed > 0 && (
                  <><span className="text-gray-200">·</span><span className="text-[#0B2A55] font-semibold">{counts.confirmed} active</span></>
                )}
                {counts.requested > 0 && (
                  <><span className="text-gray-200">·</span><span className="text-amber-600 font-semibold">{counts.requested} pending</span></>
                )}
                {revenue > 0 && (
                  <><span className="text-gray-200">·</span><span className="text-emerald-600 font-semibold">${revenue.toLocaleString()} collected</span></>
                )}
              </p>
            )}
          </div>
          <Link href="/dashboard/bookings/create"
            className="flex-shrink-0 inline-flex items-center gap-2 text-xs font-semibold text-white px-4 py-2.5 rounded-xl"
            style={{ background: "linear-gradient(135deg, #0B2A55 0%, #0d3575 100%)", boxShadow: "0 2px 8px rgba(11,42,85,0.28)" }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Listing
          </Link>
        </div>

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 mb-5 flex-wrap">

          {/* Status segmented control */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl flex-shrink-0"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)" }}>
            {STATUS_FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className="relative px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center gap-1.5 whitespace-nowrap"
                style={filter === f.id
                  ? { background: "#fff", color: "#0F172A", boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.07)" }
                  : { color: "#94A3B8" }}>
                {f.label}
                {counts[f.id] > 0 && (
                  <span className={`text-[10px] font-bold tabular-nums px-1.5 py-px rounded-full leading-none ${filter === f.id ? "bg-gray-100 text-gray-500" : "bg-gray-200/70 text-gray-400"}`}>
                    {counts[f.id]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth="2"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search address or client…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white rounded-xl"
              style={{ border: "1px solid var(--border)", outline: "none" }}
            />
          </div>

          {/* Payment + sort */}
          <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)}
            className="text-xs bg-white text-gray-500 rounded-xl px-3 py-2 cursor-pointer focus:outline-none"
            style={{ border: "1px solid var(--border)" }}>
            {PAY_FILTERS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="text-xs bg-white text-gray-500 rounded-xl px-3 py-2 cursor-pointer focus:outline-none"
            style={{ border: "1px solid var(--border)" }}>
            {SORT_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>

          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden flex-shrink-0"
            style={{ border: "1px solid var(--border)", background: "#fff" }}>
            <button onClick={() => setView("grid")}
              className={`px-3 py-2 transition-colors flex items-center justify-center ${view === "grid" ? "bg-[#0F172A]" : "hover:bg-gray-50"}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={view === "grid" ? "#fff" : "#94A3B8"} strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
            </button>
            <button onClick={() => setView("list")}
              className={`px-3 py-2 transition-colors flex items-center justify-center border-l ${view === "list" ? "bg-[#0F172A]" : "hover:bg-gray-50"}`}
              style={{ borderColor: "var(--border)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={view === "list" ? "#fff" : "#94A3B8"} strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-[#0B2A55] rounded-full animate-spin" />
          </div>

        ) : filtered.length === 0 ? (
          <div className="rounded-2xl p-16 text-center"
            style={{ background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #EEF2F8 0%, #DBEAFE 100%)" }}>
              <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#0B2A55" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <p className="text-[15px] font-semibold text-[#0F172A] mb-1">No listings found</p>
            <p className="text-sm text-gray-400">Bookings from your booking page will appear here.</p>
          </div>

        ) : view === "grid" ? (
          /* ── GRID ────────────────────────────────────────────────────────── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

        ) : (
          /* ── LIST ────────────────────────────────────────────────────────── */
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>

            {/* Column header */}
            <div className="grid items-center px-5 py-3 gap-4"
              style={{ gridTemplateColumns: COLS, borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-subtle)" }}>
              {["", "Property & Client", "Date", "Status", "Payment", "Total", ""].map((h, i) => (
                <div key={i} className={`text-[10.5px] font-semibold text-gray-400 uppercase tracking-[0.07em] ${i >= 5 ? "text-right" : ""}`}>
                  {h}
                </div>
              ))}
            </div>

            {filtered.map((listing, idx) => {
              const coverUrl   = listing.gallery?.coverUrl;
              const aColor     = avatarColor(listing.clientName || "");
              const shootDate  = listing.shootDate || listing.preferredDate;
              const streetAddr = listing.address?.split(",")[0] || listing.fullAddress?.split(",")[0];
              const cityLine   = listing.city
                ? `${listing.city}${listing.state ? `, ${listing.state}` : ""}`
                : listing.address?.split(",").slice(1, 2).join("").trim();

              return (
                <Link key={listing.id} href={`/dashboard/listings/${listing.id}`}
                  className="group grid items-center px-5 py-3.5 gap-4 transition-colors"
                  style={{
                    gridTemplateColumns: COLS,
                    borderBottom: idx < filtered.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgb(15 23 42 / 0.022)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>

                  {/* Thumbnail */}
                  <div className="w-[52px] h-10 rounded-xl overflow-hidden flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #F1F5F9 0%, #E2E8F0 100%)" }}>
                    {coverUrl ? (
                      <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#CBD5E1" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Address + client */}
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-[#0F172A] truncate leading-snug group-hover:text-[#0B2A55] transition-colors">
                      {streetAddr}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                        style={{ background: aColor }}>
                        {initials(listing.clientName)}
                      </div>
                      <p className="text-[11px] text-gray-400 truncate">{listing.clientName}</p>
                      {cityLine && <p className="text-[11px] text-gray-300 truncate hidden md:block">· {cityLine}</p>}
                    </div>
                  </div>

                  {/* Date chip */}
                  <div><DateChip d={shootDate} /></div>

                  {/* Status */}
                  <div><StatusBadge status={listing.status} /></div>

                  {/* Payment */}
                  <div><PayBadge listing={listing} /></div>

                  {/* Price */}
                  <div className="text-right">
                    <p className="text-[13.5px] font-bold text-[#0F172A]">${listing.totalPrice?.toLocaleString()}</p>
                  </div>

                  {/* Chevron */}
                  <div className="flex justify-end">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" strokeWidth="2"
                      stroke="#CBD5E1"
                      className="group-hover:stroke-[#0B2A55] transition-colors flex-shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
