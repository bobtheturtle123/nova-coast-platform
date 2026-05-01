"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { formatPrice } from "@/lib/pricing";
import Link from "next/link";

const STATUS_COLORS = {
  requested:      "bg-amber-100 text-amber-700",
  confirmed:      "bg-blue-100 text-blue-700",
  completed:      "bg-green-100 text-green-700",
  cancelled:      "bg-red-100 text-red-700",
  payment_failed: "bg-red-100 text-red-700",
  pending_payment:"bg-gray-100 text-gray-500",
};

export default function AdminDashboard() {
  const [stats,    setStats]    = useState(null);
  const [recent,   setRecent]   = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(collection(db, "bookings"));
        const bookings = snap.docs.map((d) => d.data());

        const requested  = bookings.filter((b) => b.status === "requested").length;
        const confirmed  = bookings.filter((b) => b.status === "confirmed").length;
        const completed  = bookings.filter((b) => b.status === "completed").length;
        const revenue    = bookings
          .filter((b) => b.depositPaid)
          .reduce((sum, b) => sum + (b.depositAmount || 0), 0);
        const outstanding = bookings
          .filter((b) => !b.balancePaid && b.depositPaid)
          .reduce((sum, b) => sum + (b.remainingBalance || 0), 0);

        setStats({ requested, confirmed, completed, revenue, outstanding, total: bookings.length });

        // Recent 5 bookings
        const sorted = [...bookings]
          .filter((b) => b.createdAt)
          .sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds)
          .slice(0, 5);
        setRecent(sorted);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center gap-2 text-gray-400">
        <div className="w-4 h-4 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="font-display text-3xl text-[#3486cf] mb-8">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
        {[
          { label: "Total Bookings",    value: stats?.total       },
          { label: "Pending Review",    value: stats?.requested,  highlight: true },
          { label: "Confirmed",         value: stats?.confirmed   },
          { label: "Revenue Collected", value: formatPrice(stats?.revenue ?? 0)     },
          { label: "Outstanding",       value: formatPrice(stats?.outstanding ?? 0) },
        ].map((s) => (
          <div key={s.label} className={`card ${s.highlight ? "border-amber-200 bg-amber-50" : ""}`}>
            <p className="text-2xl font-display text-[#3486cf] mb-1">{s.value}</p>
            <p className="text-xs font-body text-gray-400 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent bookings */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-[#3486cf]">Recent Bookings</h2>
          <Link href="/admin/bookings" className="text-sm text-[#3486cf] font-body underline underline-offset-4">
            View all →
          </Link>
        </div>

        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm font-body">
            <thead className="border-b border-gray-100">
              <tr className="text-left">
                {["Client", "Property", "Date", "Total", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs text-gray-400 font-medium uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((b) => (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-cream/50">
                  <td className="px-4 py-3 font-medium">{b.clientName}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate">{b.address}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {b.preferredDate
                      ? new Date(b.preferredDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{formatPrice(b.totalPrice || 0)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[b.status] || "bg-gray-100"}`}>
                      {b.status?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/bookings/${b.id}`} className="text-[#3486cf] text-xs underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
