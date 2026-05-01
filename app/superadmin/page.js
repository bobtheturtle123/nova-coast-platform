"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function SuperadminDashboard() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch("/api/superadmin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStats(await res.json());
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl text-[#3486cf] mb-2">Platform Overview</h1>
      <p className="text-gray-500 text-sm mb-8">KyoriaOS platform metrics.</p>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Accounts",  value: stats?.totalTenants ?? 0 },
            { label: "Active (Trialing or Paid)", value: stats?.activeTenants ?? 0 },
            { label: "Total Bookings",  value: stats?.totalBookings ?? 0 },
            { label: "MRR",             value: `$${(stats?.mrr ?? 0).toLocaleString()}` },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-sm border border-gray-200 p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
              <p className="text-2xl font-bold font-display text-[#3486cf]">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link href="/superadmin/tenants" className="btn-primary px-6 py-2 text-sm inline-block">
          View All Accounts →
        </Link>
      </div>
    </div>
  );
}
