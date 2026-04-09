"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function DashboardHome() {
  const [stats,    setStats]    = useState(null);
  const [recent,   setRecent]   = useState([]);
  const [tenant,   setTenant]   = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch("/api/dashboard/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setRecent(data.recentBookings);
        setTenant(data.tenant);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
      </div>
    );
  }

  const bookingUrl = tenant ? `${typeof window !== "undefined" ? window.location.origin : ""}/${tenant.slug}/book` : "";

  return (
    <div className="p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-2xl text-navy">
            {tenant ? `Welcome back, ${tenant.businessName}` : "Dashboard"}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Here's what's happening with your shoots.</p>
        </div>
        {tenant && (
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
            className="btn-outline text-sm px-4 py-2 flex items-center gap-2">
            <span>🔗</span> View Booking Page
          </a>
        )}
      </div>

      {/* Share banner for new accounts */}
      {tenant && !tenant.stripeConnectOnboarded && (
        <div className="bg-gold/10 border border-gold/30 rounded-sm p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-navy font-medium text-sm">Connect Stripe to accept payments</p>
            <p className="text-gray-500 text-xs mt-0.5">You won't be able to collect deposits until Stripe is connected.</p>
          </div>
          <Link href="/dashboard/billing" className="btn-gold text-sm px-4 py-2">Connect Now</Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Bookings",     value: stats?.total ?? 0,      color: "text-navy" },
          { label: "Pending Review",     value: stats?.pending ?? 0,    color: "text-amber-600" },
          { label: "Confirmed Shoots",   value: stats?.confirmed ?? 0,  color: "text-green-600" },
          { label: "Revenue Collected",  value: `$${(stats?.revenue ?? 0).toLocaleString()}`, color: "text-navy" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-sm border border-gray-200 p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent bookings */}
      <div className="bg-white rounded-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-display text-navy text-base">Recent Bookings</h2>
          <Link href="/dashboard/bookings" className="text-xs text-navy hover:underline">View all</Link>
        </div>

        {recent.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <p className="text-2xl mb-2">📭</p>
            <p>No bookings yet. Share your booking page to get started.</p>
            {tenant && (
              <div className="mt-4 bg-gray-50 rounded-sm px-4 py-2 inline-block">
                <code className="text-xs text-gray-600">{bookingUrl}</code>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map((b) => (
              <div key={b.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-navy">{b.clientName}</p>
                  <p className="text-xs text-gray-400">{b.fullAddress || b.address}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                    ${b.status === "confirmed"    ? "bg-green-50 text-green-700" :
                      b.status === "requested"    ? "bg-amber-50 text-amber-700" :
                      b.status === "completed"    ? "bg-blue-50 text-blue-700"  :
                      b.status === "pending_payment" ? "bg-gray-50 text-gray-600" :
                      "bg-red-50 text-red-700"}`}>
                    {b.status}
                  </span>
                  <Link href={`/dashboard/bookings/${b.id}`}
                    className="text-xs text-navy hover:underline">Details →</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
