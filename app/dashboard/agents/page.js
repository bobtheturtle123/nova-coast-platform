"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function AgentsPage() {
  const [agents,  setAgents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    auth.currentUser?.getIdToken(true).then(async (token) => {
      const res = await fetch("/api/dashboard/agents", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents);
      }
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter((a) =>
      a.name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q)
    );
  }, [agents, search]);

  const totalRevenue = agents.reduce((s, a) => s + (a.totalSpent || 0), 0);
  const topAgent = agents[0];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-navy">Customers</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {agents.length} customer{agents.length !== 1 ? "s" : ""} · ${totalRevenue.toLocaleString()} total revenue
          </p>
        </div>
      </div>

      {/* Stats */}
      {agents.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Customers</p>
            <p className="text-2xl font-bold font-display text-navy">{agents.length}</p>
          </div>
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Revenue</p>
            <p className="text-2xl font-bold font-display text-navy">${totalRevenue.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-sm border border-gray-200 p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Top Customer</p>
            <p className="text-base font-bold text-navy truncate">{topAgent?.name || "—"}</p>
            {topAgent && <p className="text-xs text-gray-400">{topAgent.totalOrders} orders</p>}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search customers by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field w-full max-w-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
        </div>
      ) : agents.length === 0 ? (
        <div className="bg-white rounded-sm border border-gray-200 p-16 text-center text-gray-400">
          <p className="text-3xl mb-3">👤</p>
          <p className="font-medium text-gray-500">No customers yet</p>
          <p className="text-sm mt-1">Customers are automatically added when a client books through your booking page.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-sm border border-gray-200 p-8 text-center text-gray-400 text-sm">
          No customers match your search.
        </div>
      ) : (
        <div className="bg-white rounded-sm border border-gray-200 divide-y divide-gray-50">
          {/* Header */}
          <div className="grid grid-cols-12 px-4 py-2 text-xs text-gray-400 uppercase tracking-wide font-medium">
            <div className="col-span-4">Customer</div>
            <div className="col-span-3">Contact</div>
            <div className="col-span-2 text-right">Orders</div>
            <div className="col-span-2 text-right">Total Spent</div>
            <div className="col-span-1" />
          </div>

          {filtered.map((agent) => (
            <div key={agent.id} className="grid grid-cols-12 px-4 py-3.5 items-center hover:bg-gray-50 transition-colors">
              {/* Name + avatar */}
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-navy/10 flex items-center justify-center text-navy font-bold text-sm flex-shrink-0">
                  {agent.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-charcoal truncate">{agent.name}</p>
                  <p className="text-xs text-gray-400">
                    Last order: {agent.lastOrderAt ? new Date(agent.lastOrderAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </p>
                </div>
              </div>

              {/* Contact */}
              <div className="col-span-3 min-w-0">
                <p className="text-xs text-gray-600 truncate">{agent.email}</p>
                {agent.phone && <p className="text-xs text-gray-400">{agent.phone}</p>}
              </div>

              {/* Orders */}
              <div className="col-span-2 text-right">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-navy/8 text-navy text-xs font-bold">
                  {agent.totalOrders}
                </span>
              </div>

              {/* Spent */}
              <div className="col-span-2 text-right">
                <p className="text-sm font-semibold text-navy">${(agent.totalSpent || 0).toLocaleString()}</p>
              </div>

              {/* Actions */}
              <div className="col-span-1 text-right">
                <Link
                  href={`/dashboard/listings?search=${encodeURIComponent(agent.email)}`}
                  className="text-xs text-navy hover:underline whitespace-nowrap"
                >
                  Listings →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
