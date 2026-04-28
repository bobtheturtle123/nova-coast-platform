"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";

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
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "price_hi", label: "Price: high" },
  { id: "price_lo", label: "Price: low" },
  { id: "alpha",  label: "A to Z" },
];

function PayBadge({ listing }) {
  if (listing.paidInFull || listing.balancePaid) return <span className="tag-green">Paid in Full</span>;
  if (listing.depositPaid)                        return <span className="tag-blue">Deposit Paid</span>;
  return <span className="tag-gray">Unpaid</span>;
}

function DeliveryBadge({ listing }) {
  if (listing.gallery?.delivered) return <span className="tag-green">Delivered</span>;
  return <span className="tag-amber">Undelivered</span>;
}

export default function ListingsPage() {
  const [listings,   setListings]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState("all");
  const [payFilter,  setPayFilter]  = useState("any");
  const [sortBy,     setSortBy]     = useState("newest");
  const [search,     setSearch]     = useState("");
  const [view,       setView]       = useState("list");

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
    // Status filter
    if (filter === "delivered") {
      list = list.filter((l) => l.gallery?.delivered);
    } else if (filter !== "all") {
      list = list.filter((l) => l.status === filter);
    }
    // Payment filter
    if (payFilter === "paid") {
      list = list.filter((l) => l.paidInFull || l.balancePaid);
    } else if (payFilter === "deposit") {
      list = list.filter((l) => l.depositPaid && !l.paidInFull && !l.balancePaid);
    } else if (payFilter === "unpaid") {
      list = list.filter((l) => !l.depositPaid && !l.paidInFull && !l.balancePaid);
    }
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        l.fullAddress?.toLowerCase().includes(q) ||
        l.address?.toLowerCase().includes(q) ||
        l.clientName?.toLowerCase().includes(q) ||
        l.clientEmail?.toLowerCase().includes(q)
      );
    }
    // Sort
    list = [...list];
    if (sortBy === "newest") {
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    } else if (sortBy === "oldest") {
      list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    } else if (sortBy === "price_hi") {
      list.sort((a, b) => (b.totalPrice || 0) - (a.totalPrice || 0));
    } else if (sortBy === "price_lo") {
      list.sort((a, b) => (a.totalPrice || 0) - (b.totalPrice || 0));
    } else if (sortBy === "alpha") {
      list.sort((a, b) => (a.address || a.fullAddress || "").localeCompare(b.address || b.fullAddress || ""));
    }
    return list;
  }, [listings, filter, payFilter, sortBy, search]);

  const counts = useMemo(() => ({
    all:       listings.length,
    requested: listings.filter((l) => l.status === "requested").length,
    confirmed: listings.filter((l) => l.status === "confirmed").length,
    completed: listings.filter((l) => l.status === "completed").length,
    delivered: listings.filter((l) => l.gallery?.delivered).length,
  }), [listings]);

  function formatDate(d) {
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt) ? null : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Listings</h1>
          {!loading && <p className="page-subtitle">{listings.length} total</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/bookings/create" className="btn-primary">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Listing
          </Link>
          {/* View toggle */}
          <div className="flex border bg-white rounded-xl overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => setView("grid")}
              className={`px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                view === "grid" ? "bg-[#0F172A] text-white" : "text-gray-500 hover:bg-gray-50"
              }`}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
              </svg>
              Grid
            </button>
            <button onClick={() => setView("list")}
              className={`px-3 py-2 text-xs font-medium border-l transition-colors flex items-center gap-1.5 ${
                view === "list" ? "bg-[#0F172A] text-white" : "text-gray-500 hover:bg-gray-50"
              }`}
              style={{ borderColor: "var(--border)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              List
            </button>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by address, name, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          {STATUS_FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all duration-150 ${
                filter === f.id
                  ? "bg-[#0F172A] text-white border-[#0F172A] shadow-xs"
                  : "text-gray-500 border-gray-200 bg-white hover:border-gray-300 hover:text-[#0F172A]"
              }`}>
              {f.label}
              {counts[f.id] > 0 && (
                <span className={`ml-1.5 tabular-nums ${filter === f.id ? "opacity-50" : "text-gray-400"}`}>{counts[f.id]}</span>
              )}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-200 mx-0.5" />
          {PAY_FILTERS.map((f) => (
            <button key={f.id} onClick={() => setPayFilter(f.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full border transition-all duration-150 ${
                payFilter === f.id
                  ? "bg-navy text-white border-navy shadow-xs"
                  : "text-gray-500 border-gray-200 bg-white hover:border-gray-300 hover:text-[#0F172A]"
              }`}>
              {f.label}
            </button>
          ))}
          <div className="w-px h-5 bg-gray-200 mx-0.5" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs border bg-white text-gray-500 rounded-xl px-3 py-1.5 cursor-pointer focus:outline-none"
            style={{ borderColor: "var(--border)" }}
          >
            {SORT_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <p className="font-semibold text-gray-600 mb-1">No listings found</p>
          <p className="text-sm text-gray-400 mt-1">Bookings from your booking page will appear here.</p>
        </div>
      ) : view === "grid" ? (
        // ── GRID ──────────────────────────────────────────────────────────────
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((listing) => {
            const coverUrl = listing.gallery?.coverUrl;
            const shootDateStr = formatDate(listing.shootDate || listing.preferredDate);
            return (
              <Link key={listing.id} href={`/dashboard/listings/${listing.id}`}
                className="group bg-white overflow-hidden hover:-translate-y-0.5 transition-all duration-200 flex flex-col"
                style={{
                  borderRadius: "var(--radius-card)",
                  border: "1px solid var(--border-subtle)",
                  boxShadow: "var(--shadow-card)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-hover)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-card)"; e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
              >
                <div className="relative h-44 bg-gray-100 flex-shrink-0">
                  {coverUrl ? (
                    <img src={coverUrl} alt={listing.fullAddress} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--bg-muted)" }}>
                      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1" className="text-gray-300">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                    <PayBadge listing={listing} />
                  </div>
                  {listing.gallery?.mediaCount > 0 && (
                    <div className="absolute bottom-2.5 right-2.5 bg-black/55 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur-sm">
                      {listing.gallery.mediaCount} photos
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <p className="font-semibold text-[#0F172A] text-sm leading-tight mb-0.5">{listing.address || listing.fullAddress}</p>
                  {listing.city && <p className="text-xs text-gray-400 mb-2.5">{listing.city}{listing.state ? `, ${listing.state}` : ""}</p>}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#0F172A] text-[10px] font-semibold">{listing.clientName?.[0]?.toUpperCase() || "?"}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{listing.clientName}</p>
                  </div>
                  <div className="mt-auto pt-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                    <p className="text-sm font-semibold text-[#0F172A]">${listing.totalPrice?.toLocaleString()}</p>
                    {shootDateStr && <p className="text-xs text-gray-400">{shootDateStr}</p>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        // ── LIST ───────────────────────────────────────────────────────────────
        <div className="card-section">
          {/* Table header */}
          <div
            className="grid grid-cols-12 px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-[0.06em]"
            style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-subtle)" }}
          >
            <div className="col-span-1" />
            <div className="col-span-4">Property</div>
            <div className="col-span-2">Client</div>
            <div className="col-span-2 text-center">Payment</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-1 text-right">Value</div>
            <div className="col-span-1 text-right">Date</div>
          </div>

          {filtered.map((listing) => {
            const coverUrl = listing.gallery?.coverUrl;
            const shootDateStr = formatDate(listing.shootDate || listing.preferredDate);
            return (
              <Link key={listing.id} href={`/dashboard/listings/${listing.id}`}
                className="grid grid-cols-12 items-center px-5 py-3.5 transition-colors group"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgb(15 23 42 / 0.02)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
              >
                {/* Thumbnail */}
                <div className="col-span-1">
                  <div className="w-10 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {coverUrl ? (
                      <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: "var(--bg-muted)" }}>
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div className="col-span-4 min-w-0 pr-4">
                  <p className="text-sm font-medium text-[#0F172A] truncate group-hover:text-navy transition-colors">{listing.address || listing.fullAddress}</p>
                  {listing.city && <p className="text-xs text-gray-400 truncate">{listing.city}{listing.state ? `, ${listing.state}` : ""}</p>}
                </div>

                {/* Client */}
                <div className="col-span-2 min-w-0 pr-3">
                  <p className="text-xs font-medium text-[#0F172A] truncate">{listing.clientName}</p>
                  <p className="text-xs text-gray-400 truncate">{listing.clientEmail}</p>
                </div>

                {/* Payment */}
                <div className="col-span-2 flex justify-center">
                  <PayBadge listing={listing} />
                </div>

                {/* Delivery */}
                <div className="col-span-1 flex justify-center">
                  <DeliveryBadge listing={listing} />
                </div>

                {/* Value */}
                <div className="col-span-1 text-right">
                  <p className="text-sm font-semibold text-[#0F172A]">${listing.totalPrice?.toLocaleString()}</p>
                </div>

                {/* Date */}
                <div className="col-span-1 text-right">
                  <p className="text-xs text-gray-400">{shootDateStr || "—"}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
