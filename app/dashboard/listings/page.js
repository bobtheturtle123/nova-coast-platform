"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import { resolveWorkflowStatus } from "@/lib/workflowStatus";
import { useDashboardPermissions } from "@/lib/dashboardPermissions";
import { avatarColor, initials } from "@/lib/avatar";
import { isDemo, getDemoListings } from "@/lib/demoData";

// ── Constants ─────────────────────────────────────────────────────────────────
const ACTIVE_STAGES = ["booked","appointment_confirmed","photographer_assigned","shot_completed","editing_complete","qa_review","postponed"];

const STATUS_FILTERS = [
  { id: "all",       label: "All" },
  { id: "active",    label: "Active" },
  { id: "delivered", label: "Delivered" },
  { id: "paid",      label: "Paid" },
  { id: "cancelled", label: "Cancelled" },
];

const PAY_FILTERS = [
  { id: "any",     label: "Any payment" },
  { id: "paid",    label: "Paid in full" },
  { id: "deposit", label: "Deposit only" },
  { id: "unpaid",  label: "Unpaid" },
];

const ALL_SORT_OPTIONS = [
  { id: "newest",   label: "Newest first" },
  { id: "oldest",   label: "Oldest first" },
  { id: "price_hi", label: "Price: high → low", priceOnly: true },
  { id: "price_lo", label: "Price: low → high", priceOnly: true },
  { id: "alpha",    label: "A → Z" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  if (dt.toDateString() === today.toDateString())    return { label: "Today",    highlight: "today" };
  if (dt.toDateString() === tomorrow.toDateString()) return { label: "Tomorrow", highlight: "tomorrow" };
  return { label: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }), highlight: null };
}

function statusDotColor(wfStatus) {
  if (["editing_complete","qa_review"].includes(wfStatus))                        return "#C9A96E";
  if (wfStatus === "delivered")                                                   return "#059669";
  if (["appointment_confirmed","photographer_assigned","shot_completed"].includes(wfStatus)) return "#3486cf";
  if (wfStatus === "booked")                                                      return "#9CA3AF";
  return "#9CA3AF";
}

function statusLabel(wfStatus) {
  return (wfStatus || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PayBadge({ listing }) {
  const base = { display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600, border: "1px solid" };
  if (listing.paidInFull || listing.balancePaid)
    return <span style={{ ...base, background: "#ECFDF5", color: "#059669", borderColor: "#A7F3D0" }}>Paid in full</span>;
  if (listing.depositPaid)
    return <span style={{ ...base, background: "#EEF4FA", color: "#1E5A8A", borderColor: "#DAE6F4" }}>Deposit paid</span>;
  return <span style={{ ...base, background: "#F9FAFB", color: "#6B7280", borderColor: "#E5E7EB" }}>Unpaid</span>;
}

function DateChip({ d }) {
  const info = formatDateShort(d);
  if (!info) return <span style={{ fontSize: 11, color: "#D1D5DB" }}>—</span>;
  if (info.highlight === "today")
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#EEF4FA", color: "#1E5A8A" }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#3486cf", display: "inline-block", flexShrink: 0 }} />
        Today
      </span>
    );
  if (info.highlight === "tomorrow")
    return <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#FEF3C7", color: "#92400E" }}>Tomorrow</span>;
  return (
    <span style={{ display: "inline-flex", padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, background: "#F2F4F8", color: "#6B7280" }}>
      {info.label}
    </span>
  );
}

// ── Grid card ─────────────────────────────────────────────────────────────────
function ListingCard({ listing, revCount = 0 }) {
  const { permissions, userRole } = useDashboardPermissions();
  const canViewPricing  = userRole === "owner" || userRole === "admin" || !!permissions?.canViewRevenue;
  const coverUrl        = listing.gallery?.coverUrl;
  const shootDate       = listing.shootDate || listing.preferredDate;
  const aColor          = avatarColor(listing.clientName || "");
  const wfStatus        = resolveWorkflowStatus(listing);
  const streetAddr      = listing.address?.split(",")[0] || listing.fullAddress?.split(",")[0];
  const cityLine        = listing.city
    ? `${listing.city}${listing.state ? `, ${listing.state}` : ""}`
    : listing.address?.split(",").slice(1, 2).join("").trim();
  const dotColor        = statusDotColor(wfStatus);
  const photogName      = listing.photographerName || "";
  const photogFirst     = photogName.split(" ")[0];
  const photogColor     = photogName ? avatarColor(photogName) : null;

  return (
    <Link href={`/dashboard/listings/${listing.id}`}
      className="group relative flex flex-col overflow-hidden transition-all duration-200"
      style={{ background: "#fff", borderRadius: 18, border: "1px solid #E9ECF0", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(0,0,0,0.10)"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; e.currentTarget.style.borderColor = "#E9ECF0"; }}>

      {/* Cover — 4:3 ratio */}
      <div className="relative w-full overflow-hidden flex-shrink-0" style={{ aspectRatio: "4/3" }}>
        {coverUrl ? (
          <img src={coverUrl} alt="" className="w-full h-full object-cover block" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{
            backgroundImage: "repeating-linear-gradient(45deg, rgba(15,23,42,0.06) 0 1px, transparent 1px 8px), linear-gradient(135deg, #E8E5DC, #DCD8CA)"
          }}>
            <svg width="30" height="30" fill="none" viewBox="0 0 24 24" stroke="rgba(15,23,42,0.22)" strokeWidth="1.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        )}

        {/* Status badge — top-left white pill */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: "rgba(255,255,255,0.94)", backdropFilter: "blur(6px)", border: "1px solid rgba(15,23,42,0.07)", fontSize: 10.5, fontWeight: 600, color: "#0F172A", lineHeight: 1 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
          {statusLabel(wfStatus)}
        </div>

        {/* Revision badge — top-right red pill */}
        {revCount > 0 && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full px-2.5 py-1"
            style={{ background: "#DC2626", color: "#fff", fontSize: 10.5, fontWeight: 700 }}>
            ! {revCount} revision{revCount !== 1 ? "s" : ""}
          </div>
        )}

        {/* Media count — top-right (only when no revisions) */}
        {revCount === 0 && listing.gallery?.mediaCount > 0 && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full px-2 py-0.5"
            style={{ background: "rgba(0,0,0,0.42)", color: "#fff", backdropFilter: "blur(4px)", fontSize: 10, fontWeight: 600 }}>
            <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {listing.gallery.mediaCount}
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Address */}
        <div>
          <p className="line-clamp-1" style={{ fontSize: 14.5, fontWeight: 600, color: "#0F172A", letterSpacing: "-0.2px", lineHeight: 1.3, margin: 0 }}>
            {streetAddr || "—"}
          </p>
          {cityLine && (
            <p className="truncate" style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{cityLine}</p>
          )}
        </div>

        {/* Client row */}
        <div className="flex items-center gap-1.5" style={{ marginTop: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: aColor, flexShrink: 0 }} />
          <p className="truncate" style={{ fontSize: 12.5, color: "#4B5261" }}>{listing.clientName || "—"}</p>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "#F1EEE5", margin: "6px 0 4px" }} />

        {/* Meta row: date chip + pay badge */}
        <div className="flex items-center justify-between gap-2">
          <DateChip d={shootDate} />
          <PayBadge listing={listing} />
        </div>

        {/* Total row: price + photographer chip */}
        <div className="flex items-center justify-between gap-2" style={{ marginTop: 2 }}>
          {canViewPricing ? (
            <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.3px" }}>
              ${(listing.totalPrice || 0).toLocaleString()}
            </span>
          ) : (
            <span style={{ fontSize: 15, color: "#D1D5DB" }}>—</span>
          )}
          {photogFirst && photogColor && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: photogColor, color: "#fff", fontSize: 8, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                {photogFirst[0].toUpperCase()}
              </span>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{photogFirst}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ListingsPage() {
  const { permissions, userRole } = useDashboardPermissions();
  const canViewPricing    = userRole === "owner" || userRole === "admin" || !!permissions?.canViewRevenue;
  const canCreateListings = userRole === "owner" || userRole === "admin" || !!permissions?.canViewListings;
  const canViewRevenue    = userRole === "owner" || userRole === "admin" || !!permissions?.canViewRevenue;
  const COLS = canViewPricing ? "52px 1fr 126px 154px 112px 76px 22px" : "52px 1fr 126px 154px 112px 22px";

  const [listings,         setListings]         = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [hasMore,          setHasMore]          = useState(false);
  const [cursor,           setCursor]           = useState(null);
  const [loadingMore,      setLoadingMore]      = useState(false);
  const [filter,           setFilter]           = useState("all");
  const [payFilter,        setPayFilter]        = useState("any");
  const [sortBy,           setSortBy]           = useState("newest");
  const [search,           setSearch]           = useState("");
  const [view,             setView]             = useState("grid");
  const [pendingRevCounts, setPendingRevCounts] = useState({});

  useEffect(() => {
    if (isDemo()) {
      const d = getDemoListings();
      setListings(d.listings);
      setPendingRevCounts(d.pendingRevCounts);
      setHasMore(false);
      setLoading(false);
      return;
    }
    auth.currentUser?.getIdToken(true).then(async (token) => {
      const headers = { Authorization: `Bearer ${token}` };
      const [listRes, revRes] = await Promise.all([
        fetch("/api/dashboard/listings?limit=50", { headers }),
        fetch("/api/dashboard/revisions?status=pending", { headers }),
      ]);
      if (listRes.ok) {
        const data = await listRes.json();
        setListings(data.listings || []);
        setHasMore(data.hasMore || false);
        setCursor(data.nextCursor || null);
      }
      if (revRes.ok) {
        const revData = await revRes.json();
        const counts = {};
        (revData.revisions || []).forEach((r) => {
          if (r.bookingId) counts[r.bookingId] = (counts[r.bookingId] || 0) + 1;
        });
        setPendingRevCounts(counts);
      }
      setLoading(false);
    });
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const res = await fetch(
        `/api/dashboard/listings?limit=50&after=${encodeURIComponent(cursor)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setListings((prev) => [...prev, ...(data.listings || [])]);
        setHasMore(data.hasMore || false);
        setCursor(data.nextCursor || null);
      }
    } catch { /* ignore */ }
    setLoadingMore(false);
  }

  const filtered = useMemo(() => {
    let list = listings;
    if (filter === "active") {
      list = list.filter((l) => ACTIVE_STAGES.includes(resolveWorkflowStatus(l)));
    } else if (filter === "delivered") {
      list = list.filter((l) => ["delivered", "paid"].includes(resolveWorkflowStatus(l)));
    } else if (filter === "paid") {
      list = list.filter((l) => l.paidInFull || l.balancePaid || resolveWorkflowStatus(l) === "paid");
    } else if (filter === "cancelled") {
      list = list.filter((l) => l.status === "cancelled" || resolveWorkflowStatus(l) === "cancelled");
    }
    if (payFilter === "paid")         list = list.filter((l) => l.paidInFull || l.balancePaid);
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
    if (sortBy === "newest")        list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    else if (sortBy === "oldest")   list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    else if (sortBy === "price_hi") list.sort((a, b) => (b.totalPrice || 0) - (a.totalPrice || 0));
    else if (sortBy === "price_lo") list.sort((a, b) => (a.totalPrice || 0) - (b.totalPrice || 0));
    else if (sortBy === "alpha")    list.sort((a, b) => (a.address || a.fullAddress || "").localeCompare(b.address || b.fullAddress || ""));
    return list;
  }, [listings, filter, payFilter, sortBy, search]);

  const counts = useMemo(() => ({
    all:       listings.length,
    active:    listings.filter(l => ACTIVE_STAGES.includes(resolveWorkflowStatus(l))).length,
    delivered: listings.filter(l => ["delivered","paid"].includes(resolveWorkflowStatus(l))).length,
    paid:      listings.filter(l => l.paidInFull || l.balancePaid || resolveWorkflowStatus(l) === "paid").length,
    cancelled: listings.filter(l => l.status === "cancelled" || resolveWorkflowStatus(l) === "cancelled").length,
  }), [listings]);

  const pendingCount = useMemo(() => listings.filter(l => l.status === "requested").length, [listings]);

  const revenue = useMemo(() =>
    listings.reduce((s, l) => {
      if (l.paidInFull || l.balancePaid) return s + (l.totalPrice || 0);
      if (l.depositPaid)                 return s + (l.depositAmount || 0);
      return s;
    }, 0),
  [listings]);

  function exportListingsCSV() {
    const headers = ["ID","Address","City","State","Client","Email","Shoot Date","Status","Payment","Total","Photographer","Created At"];
    const rows = listings.map(l => [
      l.id,
      l.address || l.fullAddress || "",
      l.city || "",
      l.state || "",
      l.clientName || "",
      l.clientEmail || "",
      l.shootDate || l.preferredDate || "",
      resolveWorkflowStatus(l),
      l.paidInFull || l.balancePaid ? "Paid in full" : l.depositPaid ? "Deposit paid" : "Unpaid",
      l.totalPrice || "",
      l.photographerName || "",
      l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `listings-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-[1300px] mx-auto px-6 py-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[26px] font-bold text-[#0F172A] leading-tight tracking-tight">Listings</h1>
            {!loading && (
              <p className="text-sm text-gray-400 mt-1.5 flex items-center gap-2 flex-wrap">
                <span>{listings.length} total</span>
                {counts.active > 0 && (
                  <><span className="text-gray-200">·</span><span className="text-[#3486cf] font-semibold">{counts.active} active</span></>
                )}
                {pendingCount > 0 && (
                  <><span className="text-gray-200">·</span><span className="text-amber-600 font-semibold">{pendingCount} pending review</span></>
                )}
                {revenue > 0 && canViewRevenue && (
                  <><span className="text-gray-200">·</span><span className="text-emerald-600 font-semibold">${revenue.toLocaleString()} collected</span></>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canViewRevenue && listings.length > 0 && (
              <button onClick={exportListingsCSV}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-lg transition-colors"
                style={{ border: "1px solid #E9ECF0", background: "#fff", color: "#475569" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#C7D2E8"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#E9ECF0"}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </button>
            )}
            {canCreateListings && (
              <Link href="/dashboard/bookings/create"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white px-4 py-2 rounded-lg transition-colors"
                style={{ background: "#3486cf" }}
                onMouseEnter={e => e.currentTarget.style.background = "#2a6dab"}
                onMouseLeave={e => e.currentTarget.style.background = "#3486cf"}>
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Listing
              </Link>
            )}
          </div>
        </div>

        {/* ── Filter bar ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-5">

          {/* Row 1: Status pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map((f) => {
              const on = filter === f.id;
              return (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  className="inline-flex items-center gap-1.5 transition-all"
                  style={{
                    height: 32, padding: "0 14px", borderRadius: 99,
                    border: on ? "1px solid #3486cf" : "1px solid #E9ECF0",
                    background: on ? "#3486cf" : "#fff",
                    color: on ? "#fff" : "#4B5261",
                    fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  }}>
                  {f.label}
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 99,
                    background: on ? "rgba(255,255,255,0.22)" : "#F2F4F8",
                    color: on ? "#fff" : "#6B7280",
                  }}>
                    {counts[f.id] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Row 2: Search + dropdowns + view toggle */}
          <div className="flex items-center gap-2.5 flex-wrap">

            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm"
              style={{ height: 36, display: "flex", alignItems: "center" }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#94A3B8" strokeWidth="2"
                className="absolute left-3.5 pointer-events-none">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search address or client…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 text-[13px]"
                style={{ height: 36, background: "#fff", border: "1px solid #E9ECF0", borderRadius: 9, outline: "none", color: "#0F172A" }}
              />
            </div>

            {/* Payment filter */}
            <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)}
              className="text-[13px] cursor-pointer focus:outline-none"
              style={{ height: 36, background: "#fff", border: "1px solid #E9ECF0", borderRadius: 9, padding: "0 12px", color: "#475569" }}>
              {PAY_FILTERS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>

            {/* Sort */}
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="text-[13px] cursor-pointer focus:outline-none"
              style={{ height: 36, background: "#fff", border: "1px solid #E9ECF0", borderRadius: 9, padding: "0 12px", color: "#475569" }}>
              {ALL_SORT_OPTIONS.filter((s) => !s.priceOnly || canViewPricing).map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>

            {/* View toggle */}
            <div className="flex overflow-hidden flex-shrink-0"
              style={{ border: "1px solid #E9ECF0", borderRadius: 9, background: "#fff", height: 36 }}>
              <button onClick={() => setView("grid")}
                className="flex items-center justify-center transition-colors"
                style={{ width: 36, background: view === "grid" ? "#3486cf" : "transparent", border: "none", cursor: "pointer" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke={view === "grid" ? "#fff" : "#9CA3AF"} strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                </svg>
              </button>
              <button onClick={() => setView("list")}
                className="flex items-center justify-center transition-colors"
                style={{ width: 36, background: view === "list" ? "#3486cf" : "transparent", border: "none", borderLeft: "1px solid #E9ECF0", cursor: "pointer" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke={view === "list" ? "#fff" : "#9CA3AF"} strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-[#3486cf] rounded-full animate-spin" />
          </div>

        ) : filtered.length === 0 ? (
          <div className="rounded-2xl p-16 text-center"
            style={{ background: "#fff", border: "1px solid #E9ECF0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: "#EEF5FC" }}>
              <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#6BAED0" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            {search || filter !== "all" || payFilter !== "any" ? (
              <>
                <p className="text-[15px] font-semibold text-[#0F172A] mb-1">No listings match this filter</p>
                <button onClick={() => { setFilter("all"); setPayFilter("any"); setSearch(""); }}
                  className="text-sm text-[#3486cf] mt-1 inline-block hover:underline">
                  Reset filters
                </button>
              </>
            ) : (
              <>
                <p className="text-[15px] font-semibold text-[#0F172A] mb-1">No listings found</p>
                <p className="text-sm text-gray-400">Bookings from your booking page will appear here.</p>
              </>
            )}
          </div>

        ) : view === "grid" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((listing) => (
                <ListingCard key={listing.id} listing={listing} revCount={pendingRevCounts[listing.id] || 0} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button onClick={loadMore} disabled={loadingMore}
                  className="px-6 py-2.5 text-sm font-semibold rounded-xl transition-colors"
                  style={{ background: "#fff", border: "1px solid #E9ECF0", color: loadingMore ? "#94A3B8" : "#0F172A" }}>
                  {loadingMore ? "Loading…" : "Load more listings"}
                </button>
              </div>
            )}
          </>

        ) : (
          /* ── LIST ── */
          <>
            <div className="rounded-2xl overflow-x-auto"
              style={{ background: "#fff", border: "1px solid #E9ECF0", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ minWidth: 640 }}>
                <div className="grid items-center px-5 py-3 gap-4"
                  style={{ gridTemplateColumns: COLS, borderBottom: "1px solid #E9ECF0", background: "#FAFAFA" }}>
                  {["", "Property & Client", "Date", "Status", "Payment", ...(canViewPricing ? ["Total"] : []), ""].map((h, i) => (
                    <div key={i} className={`text-[11px] font-semibold text-gray-400 uppercase tracking-[0.07em] ${i >= (canViewPricing ? 5 : 4) ? "text-right" : ""}`}>
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
                        borderBottom: idx < filtered.length - 1 ? "1px solid #E9ECF0" : "none",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgb(15 23 42 / 0.022)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>

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

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-semibold text-[#0F172A] truncate leading-snug group-hover:text-[#374151] transition-colors">
                            {streetAddr}
                          </p>
                          {(pendingRevCounts[listing.id] || 0) > 0 && (
                            <span className="flex-shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                              {pendingRevCounts[listing.id]} rev
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                            style={{ background: aColor }}>
                            {initials(listing.clientName)}
                          </div>
                          <p className="text-[12px] text-gray-400 truncate">{listing.clientName}</p>
                          {cityLine && <p className="text-[12px] text-gray-300 truncate hidden md:block">· {cityLine}</p>}
                        </div>
                      </div>

                      <div><DateChip d={shootDate} /></div>
                      <div><WorkflowStatusBadge status={resolveWorkflowStatus(listing)} size="xs" /></div>
                      <div><PayBadge listing={listing} /></div>

                      {canViewPricing && (
                        <div className="text-right">
                          <p className="text-[14px] font-bold text-[#0F172A]">${listing.totalPrice?.toLocaleString()}</p>
                        </div>
                      )}

                      <div className="flex justify-end">
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" strokeWidth="2"
                          stroke="#CBD5E1" className="group-hover:stroke-[#9CA3AF] transition-colors flex-shrink-0">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
            {hasMore && (
              <div className="mt-4 flex justify-center py-3">
                <button onClick={loadMore} disabled={loadingMore}
                  className="px-6 py-2 text-sm font-semibold rounded-xl transition-colors"
                  style={{ background: "#fff", border: "1px solid #E9ECF0", color: loadingMore ? "#94A3B8" : "#0F172A" }}>
                  {loadingMore ? "Loading…" : "Load more listings"}
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
