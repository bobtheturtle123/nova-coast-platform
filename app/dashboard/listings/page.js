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
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-semibold text-xl text-charcoal">Listings</h1>
          {!loading && <p className="text-gray-400 text-sm mt-0.5">{listings.length} total</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/bookings/create" className="btn-primary text-sm px-4 py-2">
            + New Listing
          </Link>
          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white shadow-card">
            <button onClick={() => setView("grid")}
              className={`px-3 py-2 text-xs font-medium transition-colors ${view === "grid" ? "bg-charcoal text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              Grid
            </button>
            <button onClick={() => setView("list")}
              className={`px-3 py-2 text-xs font-medium border-l border-gray-200 transition-colors ${view === "list" ? "bg-charcoal text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              List
            </button>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by address, name, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                filter === f.id
                  ? "bg-charcoal text-white border-charcoal"
                  : "text-gray-500 border-gray-200 bg-white hover:border-gray-300 hover:text-charcoal"
              }`}>
              {f.label}
              {counts[f.id] > 0 && (
                <span className={`ml-1.5 ${filter === f.id ? "opacity-60" : "text-gray-400"}`}>{counts[f.id]}</span>
              )}
            </button>
          ))}
          <div className="w-px h-6 bg-gray-200 self-center mx-1" />
          {PAY_FILTERS.map((f) => (
            <button key={f.id} onClick={() => setPayFilter(f.id)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                payFilter === f.id
                  ? "bg-navy text-white border-navy"
                  : "text-gray-500 border-gray-200 bg-white hover:border-gray-300 hover:text-charcoal"
              }`}>
              {f.label}
            </button>
          ))}
          <div className="w-px h-6 bg-gray-200 self-center mx-1" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-xs border border-gray-200 bg-white text-gray-500 rounded-lg px-2.5 py-1.5 cursor-pointer hover:border-gray-300 focus:outline-none"
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
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-card">
          <p className="font-medium text-gray-600 mb-1">No listings found</p>
          <p className="text-sm text-gray-400 mt-1">Bookings from your booking page will appear here.</p>
        </div>
      ) : view === "grid" ? (
        // ── GRID ──────────────────────────────────────────────────────────────
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((listing) => {
            const coverUrl = listing.gallery?.coverUrl;
            const shootDateStr = formatDate(listing.shootDate || listing.preferredDate);
            return (
              <Link key={listing.id} href={`/dashboard/listings/${listing.id}`}
                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
                <div className="relative h-44 bg-gray-100 flex-shrink-0">
                  {coverUrl ? (
                    <img src={coverUrl} alt={listing.fullAddress} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1" className="text-gray-200">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    <PayBadge listing={listing} />
                  </div>
                  {listing.gallery?.mediaCount > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                      {listing.gallery.mediaCount} photos
                    </div>
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <p className="font-semibold text-charcoal text-sm leading-tight mb-0.5">{listing.address || listing.fullAddress}</p>
                  {listing.city && <p className="text-xs text-gray-400 mb-2">{listing.city}{listing.state ? `, ${listing.state}` : ""}</p>}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-charcoal text-xs font-semibold">{listing.clientName?.[0]?.toUpperCase() || "?"}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{listing.clientName}</p>
                  </div>
                  <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-charcoal">${listing.totalPrice?.toLocaleString()}</p>
                    {shootDateStr && <p className="text-xs text-gray-400">{shootDateStr}</p>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        // ── LIST ───────────────────────────────────────────────────────────────
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-card">
          {/* Table header */}
          <div className="grid grid-cols-12 px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide border-b border-gray-100">
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
                className="grid grid-cols-12 items-center px-5 py-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 group">
                {/* Thumbnail */}
                <div className="col-span-1">
                  <div className="w-10 h-8 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {coverUrl ? (
                      <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div className="col-span-4 min-w-0 pr-4">
                  <p className="text-sm font-medium text-charcoal truncate group-hover:text-navy transition-colors">{listing.address || listing.fullAddress}</p>
                  {listing.city && <p className="text-xs text-gray-400 truncate">{listing.city}{listing.state ? `, ${listing.state}` : ""}</p>}
                </div>

                {/* Client */}
                <div className="col-span-2 min-w-0 pr-3">
                  <p className="text-xs font-medium text-charcoal truncate">{listing.clientName}</p>
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
                  <p className="text-sm font-semibold text-charcoal">${listing.totalPrice?.toLocaleString()}</p>
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
