"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";

const STATUS_COLORS = {
  pending_payment: "bg-gray-100 text-gray-600",
  requested:       "bg-amber-50 text-amber-700",
  confirmed:       "bg-blue-50 text-blue-700",
  completed:       "bg-purple-50 text-purple-700",
  cancelled:       "bg-red-50 text-red-700",
};

const STATUS_LABELS = {
  pending_payment: "Awaiting Payment",
  requested:       "Pending Review",
  confirmed:       "Confirmed",
  completed:       "Shoot Complete",
  cancelled:       "Cancelled",
};

export default function DashboardHome() {
  const [listings, setListings] = useState([]);
  const [tenant,   setTenant]   = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    auth.currentUser?.getIdToken(true).then(async (token) => {
      const [listRes, tenantRes] = await Promise.all([
        fetch("/api/dashboard/listings", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/tenant",   { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (listRes.ok)   { const d = await listRes.json();   setListings(d.listings || []); }
      if (tenantRes.ok) { const d = await tenantRes.json(); setTenant(d.tenant); }
      setLoading(false);
    });
  }, []);

  const stats = {
    total:     listings.length,
    pending:   listings.filter((l) => l.status === "requested").length,
    confirmed: listings.filter((l) => l.status === "confirmed").length,
    revenue:   listings.filter((l) => l.depositPaid).reduce((s, l) => s + (l.depositAmount || 0), 0)
               + listings.filter((l) => l.balancePaid).reduce((s, l) => s + (l.remainingBalance || 0), 0),
  };

  const recent = listings.slice(0, 8);
  const bookingUrl = tenant
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${tenant.slug}/book`
    : "";

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-navy">
            {tenant ? `Welcome, ${tenant.businessName}` : "Dashboard"}
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Here's what's happening.</p>
        </div>
        {bookingUrl && (
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
            className="btn-outline text-sm px-4 py-2 flex items-center gap-2">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Booking Page
          </a>
        )}
      </div>

      {/* Connect Stripe banner */}
      {tenant && !tenant.stripeConnectOnboarded && (
        <div className="bg-amber-50 border border-amber-200 rounded-sm p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-navy font-medium text-sm">Connect Stripe to accept payments</p>
            <p className="text-gray-500 text-xs mt-0.5">You won't collect deposits until Stripe Connect is active.</p>
          </div>
          <Link href="/dashboard/billing" className="text-xs font-semibold text-navy underline">Connect →</Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Listings",    value: stats.total,     sub: "all time" },
          { label: "Pending Review",    value: stats.pending,   sub: "need action", highlight: stats.pending > 0 },
          { label: "Active Shoots",     value: stats.confirmed, sub: "confirmed" },
          { label: "Revenue",           value: `$${stats.revenue.toLocaleString()}`, sub: "collected" },
        ].map((s) => (
          <div key={s.label} className={`rounded-sm border p-5 ${s.highlight ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}`}>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-2xl font-bold font-display ${s.highlight ? "text-amber-700" : "text-navy"}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent listings grid */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-navy text-base">Recent Listings</h2>
        <Link href="/dashboard/listings" className="text-xs text-navy hover:underline">View all →</Link>
      </div>

      {listings.length === 0 ? (
        <div className="bg-white rounded-sm border border-gray-200 p-12 text-center text-gray-400 text-sm">
          <p className="text-3xl mb-2">📭</p>
          <p>No listings yet. Share your booking page to get started.</p>
          {bookingUrl && (
            <div className="mt-4 bg-gray-50 rounded-sm px-4 py-2 inline-block">
              <code className="text-xs text-gray-600">{bookingUrl}</code>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {recent.map((listing) => {
            const coverUrl = listing.gallery?.coverUrl;
            return (
              <Link key={listing.id} href={`/dashboard/listings/${listing.id}`}
                className="bg-white rounded-sm border border-gray-200 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="relative h-32 bg-gray-100">
                  {coverUrl ? (
                    <img src={coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-navy/5 flex items-center justify-center text-3xl opacity-20">🏠</div>
                  )}
                  {listing.gallery?.delivered && (
                    <div className="absolute top-2 left-2">
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded-sm bg-green-600 text-white">Delivered</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-navy truncate leading-tight">{listing.address}</p>
                  <p className="text-xs text-gray-400 truncate">{listing.clientName}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded-sm font-medium ${STATUS_COLORS[listing.status] || "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[listing.status] || listing.status}
                    </span>
                    <span className="text-xs font-semibold text-navy">${listing.totalPrice?.toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
