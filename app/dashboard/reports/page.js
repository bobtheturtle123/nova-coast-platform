"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_COLORS = {
  pending_payment: "bg-gray-200 text-gray-600",
  requested:       "bg-amber-100 text-amber-700",
  confirmed:       "bg-blue-100 text-blue-700",
  completed:       "bg-purple-100 text-purple-700",
  cancelled:       "bg-red-100 text-red-600",
};
const STATUS_LABELS = {
  pending_payment: "Awaiting Payment",
  requested:       "Pending",
  confirmed:       "Confirmed",
  completed:       "Completed",
  cancelled:       "Cancelled",
};

// Simple SVG donut chart
function DonutChart({ data, colorMap }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const COLORS = ["#0b2a55","#c9a96e","#3b82f6","#10b981","#ef4444","#8b5cf6","#f59e0b"];
  let angle = 0;
  function polarToXY(deg, r) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
  }
  function slicePath(start, sweep, r, inner) {
    const end = start + sweep - 0.5;
    const p1 = polarToXY(start, r), p2 = polarToXY(end, r);
    const q1 = polarToXY(end, inner), q2 = polarToXY(start, inner);
    const lg = sweep > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${lg} 1 ${p2.x} ${p2.y} L ${q1.x} ${q1.y} A ${inner} ${inner} 0 ${lg} 0 ${q2.x} ${q2.y} Z`;
  }
  return (
    <svg viewBox="0 0 100 100" className="w-32 h-32 flex-shrink-0">
      {data.map((d, i) => {
        const sweep = (d.count / total) * 360;
        const path  = slicePath(angle, sweep, 45, 28);
        angle += sweep;
        return <path key={i} d={path} fill={COLORS[i % COLORS.length]} className="hover:opacity-80 transition-opacity" />;
      })}
      <text x="50" y="46" textAnchor="middle" className="text-xs" style={{ fontSize: 10, fill: "#0b2a55", fontWeight: "bold" }}>{total}</text>
      <text x="50" y="57" textAnchor="middle" style={{ fontSize: 7, fill: "#9ca3af" }}>bookings</text>
    </svg>
  );
}

// Simple bar chart rendered with divs
function BarChart({ data, valueKey, labelKey, color = "bg-navy", prefix = "$", formatVal }) {
  const max = Math.max(...data.map((d) => d[valueKey] || 0), 1);
  return (
    <div className="flex items-end gap-1 h-32 w-full">
      {data.map((d, i) => {
        const pct = ((d[valueKey] || 0) / max) * 100;
        const val = d[valueKey] || 0;
        const label = formatVal ? formatVal(val) : `${prefix}${val.toLocaleString()}`;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-charcoal text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {d[labelKey]}: {label}
            </div>
            <div
              className={`w-full rounded-t-sm ${color} transition-all duration-300 min-h-0.5`}
              style={{ height: `${pct}%` }}
            />
            <span className="text-xs text-gray-400 truncate w-full text-center">{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const [bookings, setBookings] = useState([]);
  const [catalog,  setCatalog]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [period,   setPeriod]   = useState("12"); // months

  useEffect(() => {
    auth.currentUser?.getIdToken(true).then(async (token) => {
      const [bookRes, tenantRes] = await Promise.all([
        fetch("/api/dashboard/bookings", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/dashboard/tenant",   { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (bookRes.ok) {
        const d = await bookRes.json();
        setBookings(d.bookings || []);
      }
      if (tenantRes.ok) {
        const td = await tenantRes.json();
        const slug = td.tenant?.slug;
        if (slug) {
          const catRes = await fetch(`/api/tenant-public/${slug}/catalog`);
          if (catRes.ok) setCatalog(await catRes.json());
        }
      }
      setLoading(false);
    });
  }, []);

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - Number(period));
    return d;
  }, [period]);

  const filtered = useMemo(
    () => bookings.filter((b) => b.status !== "cancelled" && new Date(b.createdAt) >= cutoff),
    [bookings, cutoff]
  );

  // ─── Stats ────────────────────────────────────────────────────────────────
  const totalRevenue   = filtered.filter((b) => b.depositPaid).reduce((s, b) => s + (b.depositAmount || 0), 0)
                       + filtered.filter((b) => b.balancePaid).reduce((s, b) => s + (b.remainingBalance || 0), 0);
  const totalBookings  = filtered.length;
  const paidDeposit    = filtered.filter((b) => b.depositPaid).length;
  const avgOrder       = totalBookings > 0 ? Math.round(filtered.reduce((s, b) => s + (b.totalPrice || 0), 0) / totalBookings) : 0;
  const delivered      = filtered.filter((b) => b.gallery?.delivered).length;

  // ─── Revenue per month ────────────────────────────────────────────────────
  const revenueByMonth = useMemo(() => {
    const map = {};
    filtered.forEach((b) => {
      if (!b.createdAt) return;
      const d = new Date(b.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
      if (!map[key]) map[key] = { label: `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, revenue: 0, orders: 0 };
      if (b.depositPaid)  map[key].revenue += b.depositAmount || 0;
      if (b.balancePaid)  map[key].revenue += b.remainingBalance || 0;
      map[key].orders++;
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  }, [filtered]);

  // ─── Orders per month ─────────────────────────────────────────────────────
  const ordersByMonth = useMemo(() => {
    const map = {};
    filtered.forEach((b) => {
      if (!b.createdAt) return;
      const d = new Date(b.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
      if (!map[key]) map[key] = { label: `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, count: 0 };
      map[key].count++;
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  }, [filtered]);

  // ─── Revenue by service / package ────────────────────────────────────────
  const byService = useMemo(() => {
    // Build a lookup: id → name from catalog
    const nameMap = {};
    catalog?.packages?.forEach((p) => { nameMap[p.id] = p.name; });
    catalog?.services?.forEach((s) => { nameMap[s.id] = s.name; });
    catalog?.addons?.forEach((a)   => { nameMap[a.id] = a.name; });

    const map = {};
    filtered.forEach((b) => {
      const rawKey = b.packageId || (b.serviceIds?.[0]) || "custom";
      const label  = nameMap[rawKey] || (rawKey === "custom" ? "Custom / A la carte" : rawKey);
      if (!map[rawKey]) map[rawKey] = { label, revenue: 0, count: 0 };
      map[rawKey].revenue += b.totalPrice || 0;
      map[rawKey].count++;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [filtered, catalog]);

  // ─── Status breakdown ─────────────────────────────────────────────────────
  const statusBreakdown = useMemo(() => {
    const map = {};
    filtered.forEach((b) => {
      map[b.status] = (map[b.status] || 0) + 1;
    });
    return Object.entries(map).map(([status, count]) => ({ status, count })).sort((a,b) => b.count - a.count);
  }, [filtered]);

  // ─── Top agents ───────────────────────────────────────────────────────────
  const topAgents = useMemo(() => {
    const map = {};
    filtered.forEach((b) => {
      if (!b.clientEmail) return;
      const key = b.clientEmail.toLowerCase();
      if (!map[key]) map[key] = { name: b.clientName, email: key, revenue: 0, orders: 0 };
      map[key].revenue += b.totalPrice || 0;
      map[key].orders++;
    });
    return Object.values(map).sort((a,b) => b.revenue - a.revenue).slice(0,5);
  }, [filtered]);

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-navy">Reports</h1>
          <p className="text-gray-400 text-sm mt-0.5">Financial and booking performance overview</p>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input-field text-sm py-2 w-44"
        >
          <option value="3">Last 3 months</option>
          <option value="6">Last 6 months</option>
          <option value="12">Last 12 months</option>
          <option value="24">Last 24 months</option>
          <option value="120">All time</option>
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Revenue Collected", value: `$${totalRevenue.toLocaleString()}`, sub: `from ${paidDeposit} paid bookings` },
          { label: "Total Orders",      value: totalBookings,                         sub: "in period" },
          { label: "Avg Order Value",   value: `$${avgOrder.toLocaleString()}`,        sub: "all services" },
          { label: "Galleries Delivered", value: delivered,                           sub: `of ${totalBookings} bookings` },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-sm p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-2xl font-bold font-display text-navy">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue + Orders charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <p className="font-semibold text-charcoal text-sm mb-4">Revenue Per Month</p>
          {revenueByMonth.length > 0
            ? <BarChart data={revenueByMonth} valueKey="revenue" labelKey="label" color="bg-navy" prefix="$" />
            : <p className="text-gray-400 text-sm py-8 text-center">No data for this period</p>
          }
        </div>
        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <p className="font-semibold text-charcoal text-sm mb-4">Bookings Per Month</p>
          {ordersByMonth.length > 0
            ? <BarChart data={ordersByMonth} valueKey="count" labelKey="label" color="bg-gold" prefix="" formatVal={(v) => `${v} orders`} />
            : <p className="text-gray-400 text-sm py-8 text-center">No data for this period</p>
          }
        </div>
      </div>

      {/* Service breakdown + Status + Top agents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Revenue by service */}
        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <p className="font-semibold text-charcoal text-sm mb-4">Revenue by Service</p>
          {byService.length === 0
            ? <p className="text-gray-400 text-sm">No data</p>
            : (
              <div className="space-y-2">
                {byService.map((s, i) => {
                  const pct = Math.round((s.revenue / (byService[0]?.revenue || 1)) * 100);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="text-charcoal truncate capitalize">{s.label}</span>
                        <span className="text-navy font-semibold flex-shrink-0 ml-2">${s.revenue.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-full bg-navy rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>

        {/* Booking status */}
        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <p className="font-semibold text-charcoal text-sm mb-4">Booking Status</p>
          {statusBreakdown.length === 0
            ? <p className="text-gray-400 text-sm">No data</p>
            : (
              <div className="flex items-center gap-5">
                <DonutChart data={statusBreakdown} />
                <div className="space-y-1.5 flex-1 min-w-0">
                  {statusBreakdown.map(({ status, count }) => {
                    const pct = Math.round((count / totalBookings) * 100);
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className={`px-1.5 py-0.5 rounded-sm font-medium ${STATUS_COLORS[status] || "bg-gray-100 text-gray-500"}`}>
                            {STATUS_LABELS[status] || status}
                          </span>
                          <span className="text-gray-500 font-medium">{count} <span className="text-gray-300">({pct}%)</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          }
        </div>

        {/* Top agents */}
        <div className="bg-white border border-gray-200 rounded-sm p-5">
          <p className="font-semibold text-charcoal text-sm mb-4">Top Agents</p>
          {topAgents.length === 0
            ? <p className="text-gray-400 text-sm">No data</p>
            : (
              <div className="space-y-3">
                {topAgents.map((a, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-navy/10 text-navy font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {a.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-charcoal truncate">{a.name || a.email}</p>
                      <p className="text-xs text-gray-400">{a.orders} order{a.orders !== 1 ? "s" : ""}</p>
                    </div>
                    <span className="text-sm font-semibold text-navy flex-shrink-0">${a.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}
