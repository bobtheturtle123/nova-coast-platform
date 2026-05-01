"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { formatPrice } from "@/lib/pricing";
import Link from "next/link";

const STATUS_COLORS = {
  requested:       "bg-amber-100 text-amber-700",
  confirmed:       "bg-blue-100 text-blue-700",
  completed:       "bg-green-100 text-green-700",
  cancelled:       "bg-red-100 text-red-700",
  pending_payment: "bg-gray-100 text-gray-500",
  payment_failed:  "bg-red-100 text-red-700",
};

const STATUSES = ["all", "requested", "confirmed", "completed", "cancelled"];

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    getDocs(collection(db, "bookings"))
      .then((snap) => {
        const data = snap.docs
          .map((d) => d.data())
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
        setBookings(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = bookings.filter((b) => {
    const matchStatus = filter === "all" || b.status === filter;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      b.clientName?.toLowerCase().includes(q) ||
      b.clientEmail?.toLowerCase().includes(q) ||
      b.address?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl text-[#3486cf] mb-6">Bookings</h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search client or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field max-w-xs"
        />
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-xs font-body rounded-sm border transition-colors capitalize
                ${filter === s
                  ? "bg-[#3486cf] text-white border-[#3486cf]"
                  : "border-gray-200 text-gray-500 hover:border-[#3486cf]/30"
                }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 font-body">
          <div className="w-4 h-4 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
          Loading bookings...
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm font-body">
            <thead className="border-b border-gray-100 bg-cream">
              <tr>
                {["Client", "Property", "Pref. Date", "Total", "Deposit", "Balance", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-gray-400 font-medium uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    No bookings found.
                  </td>
                </tr>
              ) : filtered.map((b) => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-cream/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{b.clientName}</p>
                    <p className="text-gray-400 text-xs">{b.clientEmail}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[180px]">
                    <p className="truncate">{b.address}</p>
                    <p className="text-xs text-gray-400">{b.city}, {b.state}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {b.preferredDate
                      ? new Date(b.preferredDate).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", year: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">{formatPrice(b.totalPrice || 0)}</td>
                  <td className="px-4 py-3">
                    <span className={b.depositPaid ? "text-green-600 font-medium" : "text-gray-400"}>
                      {b.depositPaid ? `✓ ${formatPrice(b.depositAmount)}` : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={b.balancePaid ? "text-green-600 font-medium" : "text-amber-600"}>
                      {b.balancePaid ? "✓ Paid" : formatPrice(b.remainingBalance || 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[b.status] || "bg-gray-100"}`}>
                      {b.status?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className="text-[#3486cf] text-xs font-medium underline underline-offset-2"
                    >
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
