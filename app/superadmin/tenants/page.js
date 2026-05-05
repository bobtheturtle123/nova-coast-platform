"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { getAppUrl } from "@/lib/appUrl";

export default function SuperadminTenantsPage() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const res = await fetch("/api/superadmin/tenants", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTenants(data.tenants);
      }
      setLoading(false);
    });
  }, []);

  const APP_URL = getAppUrl();

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl text-[#3486cf] mb-6">All Accounts</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-sm border border-gray-200 divide-y divide-gray-50">
          {tenants.map((t) => (
            <div key={t.id} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#3486cf] text-sm">{t.businessName}</p>
                <p className="text-xs text-gray-400">{t.email}</p>
                <p className="text-xs text-gray-400">/{t.slug}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${t.subscriptionStatus === "active"   ? "bg-green-50 text-green-700" :
                    t.subscriptionStatus === "trialing" ? "bg-blue-50 text-blue-700"   :
                    t.subscriptionStatus === "past_due" ? "bg-red-50 text-red-700"     :
                    "bg-gray-50 text-gray-600"}`}>
                  {t.subscriptionStatus || "trialing"}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium bg-gray-50 text-gray-600`}>
                  {t.stripeConnectOnboarded ? "Stripe ✓" : "No Stripe"}
                </span>
                <a href={`${APP_URL}/${t.slug}/book`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-[#3486cf] hover:underline">
                  View →
                </a>
              </div>
            </div>
          ))}
          {tenants.length === 0 && (
            <div className="p-12 text-center text-gray-400 text-sm">No accounts yet.</div>
          )}
        </div>
      )}
    </div>
  );
}
