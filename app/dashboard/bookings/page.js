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

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch("/api/dashboard/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data.bookings);
      }
      setLoading(false);
    });
  }, []);

  const filtered = filter === "all"
    ? bookings
    : bookings.filter((b) => b.status === filter);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl text-navy">Bookings</h1>
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
                  <p className="text-sm font-medium text-navy truncate">{b.clientName}</p>
                  <p className="text-xs text-gray-400 truncate">{b.fullAddress || b.address}</p>
                  <p className="text-xs text-gray-400">
                    {b.preferredDate ? new Date(b.preferredDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date set"}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-navy">${b.totalPrice?.toLocaleString()}</p>
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
    </div>
  );
}
