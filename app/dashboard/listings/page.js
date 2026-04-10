"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";

const FILTERS = [
  { id: "all",       label: "All" },
  { id: "requested", label: "Pending Review" },
  { id: "confirmed", label: "Confirmed" },
  { id: "completed", label: "Shoot Complete" },
  { id: "delivered", label: "Delivered" },
];

function paymentBadge(listing) {
  if (listing.paidInFull || listing.balancePaid) return { label: "Paid in Full", cls: "bg-emerald-500 text-white" };
  if (listing.depositPaid) return { label: "Deposit Paid", cls: "bg-blue-500 text-white" };
  return { label: "Unpaid", cls: "bg-gray-400 text-white" };
}

function deliveryBadge(listing) {
  if (listing.gallery?.delivered) return { label: "Delivered", cls: "bg-green-600 text-white" };
  return { label: "Undelivered", cls: "bg-amber-500 text-white" };
}

export default function ListingsPage() {
  const [listings, setListings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");
  const [search,   setSearch]   = useState("");
  const [view,     setView]     = useState("grid"); // "grid" | "list"

  useEffect(() => {
    auth.currentUser?.getIdToken(true).then(async (token) => {
      const res = await fetch("/api/dashboard/listings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setListings(data.listings);
      }
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
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        l.fullAddress?.toLowerCase().includes(q) ||
        l.clientName?.toLowerCase().includes(q) ||
        l.clientEmail?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [listings, filter, search]);

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
          <h1 className="font-display text-2xl text-navy">All Listings</h1>
          {!loading && (
            <p className="text-gray-400 text-sm mt-0.5">{listings.length} total</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-gray-200 rounded-sm overflow-hidden">
            <button onClick={() => setView("grid")}
              className={`px-3 py-2 text-sm ${view === "grid" ? "bg-navy text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
              ▦
            </button>
            <button onClick={() => setView("list")}
              className={`px-3 py-2 text-sm border-l border-gray-200 ${view === "list" ? "bg-navy text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by address, agent name, or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field flex-1"
        />
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                filter === f.id
                  ? "bg-navy text-white border-navy"
                  : "text-gray-500 border-gray-200 hover:border-navy hover:text-navy"
              }`}>
              {f.label}
              {counts[f.id] > 0 && (
                <span className="ml-1.5 opacity-70">{counts[f.id]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-6 h-6 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-sm border border-gray-200 p-16 text-center text-gray-400">
          <p className="text-3xl mb-3">📭</p>
          <p className="font-medium text-gray-500">No listings found</p>
          <p className="text-sm mt-1">Bookings from your booking page will appear here.</p>
        </div>
      ) : view === "grid" ? (
        // ── GRID VIEW ──────────────────────────────────────────────────────────
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((listing) => {
            const pmtBadge = paymentBadge(listing);
            const dlvBadge = deliveryBadge(listing);
            const coverUrl = listing.gallery?.coverUrl;
            const shootDateStr = formatDate(listing.shootDate || listing.preferredDate);

            return (
              <Link key={listing.id} href={`/dashboard/listings/${listing.id}`}
                className="group bg-white rounded-sm border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
                {/* Cover photo */}
                <div className="relative h-44 bg-gray-100 flex-shrink-0">
                  {coverUrl ? (
                    <img src={coverUrl} alt={listing.fullAddress}
                      className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-navy/5 to-navy/10">
                      <span className="text-4xl opacity-20">🏠</span>
                    </div>
                  )}
                  {/* Auto-derived status badges */}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${pmtBadge.cls}`}>
                      {pmtBadge.label}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${dlvBadge.cls}`}>
                      {dlvBadge.label}
                    </span>
                  </div>
                  {/* Media count */}
                  {listing.gallery?.mediaCount > 0 && (
                    <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-sm">
                      {listing.gallery.mediaCount} photos
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-4 flex flex-col flex-1">
                  <p className="font-semibold text-navy text-sm leading-tight mb-0.5">
                    {listing.address || listing.fullAddress}
                  </p>
                  {listing.city && (
                    <p className="text-xs text-gray-400 mb-3">
                      {listing.city}{listing.state ? `, ${listing.state}` : ""}
                    </p>
                  )}

                  {/* Agent */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-navy/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-navy text-xs font-bold">
                        {listing.clientName?.[0]?.toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-charcoal truncate">{listing.clientName}</p>
                      <p className="text-xs text-gray-400 truncate">{listing.clientEmail}</p>
                    </div>
                  </div>

                  <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-navy">${listing.totalPrice?.toLocaleString()}</p>
                      {shootDateStr && (
                        <p className="text-xs text-gray-400">{shootDateStr}</p>
                      )}
                    </div>
                    <span className="text-xs text-navy font-medium">View →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        // ── LIST VIEW ──────────────────────────────────────────────────────────
        <div className="bg-white rounded-sm border border-gray-200 divide-y divide-gray-50">
          {filtered.map((listing) => {
            const pmtBadge = paymentBadge(listing);
            const dlvBadge = deliveryBadge(listing);
            const coverUrl = listing.gallery?.coverUrl;
            const shootDateStr = formatDate(listing.shootDate || listing.preferredDate);

            return (
              <Link key={listing.id} href={`/dashboard/listings/${listing.id}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
                {/* Thumbnail */}
                <div className="w-16 h-12 flex-shrink-0 rounded-sm overflow-hidden bg-gray-100">
                  {coverUrl ? (
                    <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-navy/5 flex items-center justify-center text-lg">🏠</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{listing.address || listing.fullAddress}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {listing.clientName} · {listing.clientEmail}
                  </p>
                </div>

                <div className="hidden md:block text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-navy">${listing.totalPrice?.toLocaleString()}</p>
                  {shootDateStr && <p className="text-xs text-gray-400">{shootDateStr}</p>}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pmtBadge.cls}`}>{pmtBadge.label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dlvBadge.cls}`}>{dlvBadge.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
