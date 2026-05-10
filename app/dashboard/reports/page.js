"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STATUS_COLORS = {
  pending_payment: "bg-gray-200 text-gray-600",
  requested:       "bg-amber-100 text-amber-700",
  confirmed:       "bg-[#EEF5FC] text-[#1E5A8A]",
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

function DonutChart({ data }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const COLORS = ["#3486cf","#c9a96e","#3b82f6","#10b981","#ef4444","#8b5cf6","#f59e0b"];
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
      <text x="50" y="46" textAnchor="middle" style={{ fontSize: 10, fill: "#3486cf", fontWeight: "bold" }}>{total}</text>
      <text x="50" y="57" textAnchor="middle" style={{ fontSize: 7, fill: "#9ca3af" }}>bookings</text>
    </svg>
  );
}

function BarChart({ data, valueKey, labelKey, color = "bg-[#3486cf]", prefix = "$", formatVal, secondaryKey, secondaryColor = "bg-gold/60" }) {
  const max = Math.max(...data.map((d) => Math.max(d[valueKey] || 0, d[secondaryKey] || 0)), 1);
  return (
    <div className="flex items-end gap-1 h-32 w-full">
      {data.map((d, i) => {
        const pct  = ((d[valueKey] || 0) / max) * 100;
        const pct2 = secondaryKey ? ((d[secondaryKey] || 0) / max) * 100 : null;
        const val  = d[valueKey] || 0;
        const label = formatVal ? formatVal(val) : `${prefix}${val.toLocaleString()}`;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {d[labelKey]}: {label}
              {secondaryKey && d[secondaryKey] != null && ` · cost $${d[secondaryKey].toLocaleString()}`}
            </div>
            <div className="w-full flex items-end gap-0.5" style={{ height: "100%" }}>
              <div className={`flex-1 rounded-t-sm ${color} transition-all duration-300 min-h-0.5`} style={{ height: `${pct}%` }} />
              {pct2 !== null && (
                <div className={`flex-1 rounded-t-sm ${secondaryColor} transition-all duration-300 min-h-0.5`} style={{ height: `${pct2}%` }} />
              )}
            </div>
            <span className="text-xs text-gray-400 truncate w-full text-center">{d[labelKey]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(bookings, period) {
  const rows = [
    ["Booking ID","Client","Address","Status","Total Price","Deposit Paid","Balance Paid","Revenue Collected","Total Cost","Net Profit","Margin %","Created At","Shoot Date"],
    ...bookings.map((b) => {
      const revenue   = (b.depositPaid ? (b.depositAmount || 0) : 0) + (b.balancePaid ? (b.remainingBalance || 0) : 0);
      const totalCost = b.costs?.totalCost || 0;
      const profit    = (b.totalPrice || 0) - totalCost;
      const margin    = b.totalPrice > 0 ? Math.round((profit / b.totalPrice) * 100) : "";
      return [
        b.id || "",
        b.clientName || "",
        b.fullAddress || "",
        b.status || "",
        b.totalPrice || 0,
        b.depositPaid ? "Yes" : "No",
        b.balancePaid ? "Yes" : "No",
        revenue,
        totalCost,
        profit,
        margin !== "" ? `${margin}%` : "",
        b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "",
        b.shootDate  ? new Date(b.shootDate).toLocaleDateString()  : "",
      ];
    }),
  ];
  const csv  = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `reports-${period}mo-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [bookings,  setBookings]  = useState([]);
  const [catalog,   setCatalog]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState("12");
  const [isOwner,   setIsOwner]   = useState(true);

  useEffect(() => {
    auth.currentUser?.getIdToken(true).then(async (token) => {
      const result = await auth.currentUser?.getIdTokenResult();
      if (result?.claims?.role === "manager") { setIsOwner(false); setLoading(false); return; }

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

  // ── Revenue stats ─────────────────────────────────────────────────────────
  const totalRevenue  = filtered.filter((b) => b.depositPaid).reduce((s, b) => s + (b.depositAmount || 0), 0)
                      + filtered.filter((b) => b.balancePaid).reduce((s, b) => s + (b.remainingBalance || 0), 0);
  const totalBookings = filtered.length;
  const paidDeposit   = filtered.filter((b) => b.depositPaid).length;
  const avgOrder      = totalBookings > 0 ? Math.round(filtered.reduce((s, b) => s + (b.totalPrice || 0), 0) / totalBookings) : 0;
  const delivered     = filtered.filter((b) => b.gallery?.delivered).length;

  // ── Profit stats ──────────────────────────────────────────────────────────
  const totalCostAll  = filtered.reduce((s, b) => s + (b.costs?.totalCost || 0), 0);
  const totalPriceAll = filtered.reduce((s, b) => s + (b.totalPrice || 0), 0);
  const netProfit     = totalPriceAll - totalCostAll;
  const marginPct     = totalPriceAll > 0 ? Math.round((netProfit / totalPriceAll) * 100) : 0;
  const withCosts     = filtered.filter((b) => b.costs?.totalCost > 0).length;

  // ── Revenue + cost per month ──────────────────────────────────────────────
  const revenueByMonth = useMemo(() => {
    const map = {};
    filtered.forEach((b) => {
      if (!b.createdAt) return;
      const d   = new Date(b.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
      if (!map[key]) map[key] = { label: `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, revenue: 0, cost: 0, orders: 0 };
      if (b.depositPaid)  map[key].revenue += b.depositAmount    || 0;
      if (b.balancePaid)  map[key].revenue += b.remainingBalance || 0;
      map[key].cost += b.costs?.totalCost || 0;
      map[key].orders++;
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  }, [filtered]);

  const ordersByMonth = useMemo(() => {
    const map = {};
    filtered.forEach((b) => {
      if (!b.createdAt) return;
      const d   = new Date(b.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
      if (!map[key]) map[key] = { label: `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, count: 0 };
      map[key].count++;
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  }, [filtered]);

  // Profit per month
  const profitByMonth = useMemo(() => {
    const map = {};
    filtered.forEach((b) => {
      if (!b.createdAt) return;
      const d   = new Date(b.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,"0")}`;
      if (!map[key]) map[key] = { label: `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, profit: 0 };
      map[key].profit += (b.totalPrice || 0) - (b.costs?.totalCost || 0);
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);
  }, [filtered]);

  // ── Revenue by service ────────────────────────────────────────────────────
  const byService = useMemo(() => {
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

  // ── Status breakdown ──────────────────────────────────────────────────────
  const statusBreakdown = useMemo(() => {
    const map = {};
    filtered.forEach((b) => { map[b.status] = (map[b.status] || 0) + 1; });
    return Object.entries(map).map(([status, count]) => ({ status, count })).sort((a,b) => b.count - a.count);
  }, [filtered]);

  // ── Top agents ────────────────────────────────────────────────────────────
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

  // ── Upsell intelligence ───────────────────────────────────────────────────
  // For each service that was booked, find other services frequently booked alongside
  const upsellData = useMemo(() => {
    const nameMap = {};
    catalog?.packages?.forEach((p) => { nameMap[p.id] = p.name; });
    catalog?.services?.forEach((s) => { nameMap[s.id] = s.name; });
    catalog?.addons?.forEach((a)   => { nameMap[a.id] = a.name; });

    // Build co-occurrence map: how often is service B booked when A is also booked?
    const coMap = {}; // coMap[A][B] = count

    filtered.forEach((b) => {
      const services = [
        b.packageId,
        ...(b.serviceIds  || []),
        ...(b.selectedAddons || []).map((a) => a.id || a),
      ].filter(Boolean);

      // Only useful if client booked multiple services
      if (services.length < 2) return;

      services.forEach((a) => {
        services.forEach((bSvc) => {
          if (a === bSvc) return;
          if (!coMap[a]) coMap[a] = {};
          coMap[a][bSvc] = (coMap[a][bSvc] || 0) + 1;
        });
      });
    });

    // Build top 5 pairs
    const pairs = [];
    Object.entries(coMap).forEach(([a, bMap]) => {
      Object.entries(bMap).forEach(([b, count]) => {
        if (a < b) { // dedupe A+B vs B+A
          const nameA = nameMap[a] || a;
          const nameB = nameMap[b] || b;
          pairs.push({ a: nameA, b: nameB, count });
        }
      });
    });

    return pairs.sort((x, y) => y.count - x.count).slice(0, 5);
  }, [filtered, catalog]);

  // ── Repeat client rate ────────────────────────────────────────────────────
  const repeatClients = useMemo(() => {
    const emailCounts = {};
    filtered.forEach((b) => {
      if (!b.clientEmail) return;
      const k = b.clientEmail.toLowerCase();
      emailCounts[k] = (emailCounts[k] || 0) + 1;
    });
    const total  = Object.keys(emailCounts).length;
    const repeat = Object.values(emailCounts).filter((c) => c > 1).length;
    return { total, repeat, rate: total > 0 ? Math.round((repeat / total) * 100) : 0 };
  }, [filtered]);

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-[#3486cf]/30 border-t-[#3486cf] rounded-full animate-spin" />
    </div>
  );

  if (!isOwner) return (
    <div className="p-8 flex flex-col items-center justify-center h-64 text-center gap-3">
      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      </div>
      <p className="font-semibold text-gray-700">Revenue reports are restricted to account owners</p>
      <p className="text-sm text-gray-400">Contact the account owner for financial data.</p>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl" id="reports-print-area">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:mb-4">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Financial and booking performance overview</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
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
          <button
            onClick={() => exportCSV(filtered, period)}
            className="btn-outline text-sm px-4 py-2">
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="btn-outline text-sm px-4 py-2">
            Print / PDF
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Revenue Collected",   value: `$${totalRevenue.toLocaleString()}`, sub: `from ${paidDeposit} paid bookings`, variant: "stat-card-gold" },
          { label: "Total Orders",        value: totalBookings,                        sub: "in period",                         variant: "stat-card-navy" },
          { label: "Avg Order Value",     value: `$${avgOrder.toLocaleString()}`,      sub: "all services",                      variant: "stat-card-green" },
          { label: "Galleries Delivered", value: delivered,                            sub: `of ${totalBookings} bookings`,       variant: "stat-card" },
        ].map((s) => (
          <div key={s.label} className={s.variant}>
            <p className="text-[11px] text-gray-400 uppercase tracking-[0.06em] font-semibold mb-2">{s.label}</p>
            <p className="text-2xl font-bold text-[#0F172A]">{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Profit & Loss summary */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-[#0F172A] text-sm">Profit &amp; Loss</p>
          {withCosts === 0 && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
              No costs logged yet — add costs on individual booking pages
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-400 mb-1">Total Revenue</p>
            <p className="text-xl font-bold text-[#3486cf]">${totalPriceAll.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-400 mb-1">Total Costs</p>
            <p className="text-xl font-bold text-[#0F172A]">${totalCostAll.toLocaleString()}</p>
            <p className="text-xs text-gray-400">{withCosts} of {totalBookings} with costs</p>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-400 mb-1">Net Profit</p>
            <p className={`text-xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
              ${netProfit.toLocaleString()}
            </p>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <p className="text-xs text-gray-400 mb-1">Margin</p>
            <p className={`text-xl font-bold ${marginPct >= 60 ? "text-green-600" : marginPct >= 30 ? "text-amber-600" : "text-red-600"}`}>
              {marginPct}%
            </p>
          </div>
        </div>
        {/* Profit bar chart */}
        {profitByMonth.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Net Profit Per Month</p>
            <div className="flex items-end gap-1 h-24 w-full">
              {profitByMonth.map((d, i) => {
                const allVals = profitByMonth.map((x) => Math.abs(x.profit));
                const maxAbs  = Math.max(...allVals, 1);
                const pct     = (Math.abs(d.profit) / maxAbs) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1 group relative h-full">
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[#0F172A] text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {d.label}: ${d.profit.toLocaleString()}
                    </div>
                    <div
                      className={`w-full rounded-t-sm transition-all duration-300 min-h-0.5 ${d.profit >= 0 ? "bg-green-500" : "bg-red-400"}`}
                      style={{ height: `${pct}%` }}
                    />
                    <span className="text-xs text-gray-400 truncate w-full text-center">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Revenue + Orders charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold text-[#0F172A] text-sm">Revenue Per Month</p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-3 h-2 bg-[#3486cf] rounded-lg inline-block" /> Revenue</span>
              <span className="flex items-center gap-1"><span className="w-3 h-2 bg-gold/60 rounded-lg inline-block" /> Cost</span>
            </div>
          </div>
          {revenueByMonth.length > 0
            ? <BarChart data={revenueByMonth} valueKey="revenue" labelKey="label" color="bg-[#3486cf]" prefix="$" secondaryKey="cost" />
            : <p className="text-gray-400 text-sm py-8 text-center">No data for this period</p>
          }
        </div>
        <div className="card">
          <p className="font-semibold text-[#0F172A] text-sm mb-4">Bookings Per Month</p>
          {ordersByMonth.length > 0
            ? <BarChart data={ordersByMonth} valueKey="count" labelKey="label" color="bg-gold" prefix="" formatVal={(v) => `${v} orders`} />
            : <p className="text-gray-400 text-sm py-8 text-center">No data for this period</p>
          }
        </div>
      </div>

      {/* Service breakdown + Status + Top agents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <p className="font-semibold text-[#0F172A] text-sm mb-4">Revenue by Service</p>
          {byService.length === 0
            ? <p className="text-gray-400 text-sm">No data</p>
            : (
              <div className="space-y-2">
                {byService.map((s, i) => {
                  const pct = Math.round((s.revenue / (byService[0]?.revenue || 1)) * 100);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-0.5">
                        <span className="text-[#0F172A] truncate capitalize">{s.label}</span>
                        <span className="text-[#3486cf] font-semibold flex-shrink-0 ml-2">${s.revenue.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className="h-full bg-[#3486cf] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>

        <div className="card">
          <p className="font-semibold text-[#0F172A] text-sm mb-4">Booking Status</p>
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
                          <span className={`px-1.5 py-0.5 rounded-lg font-medium ${STATUS_COLORS[status] || "bg-gray-100 text-gray-500"}`}>
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

        <div className="card">
          <p className="font-semibold text-[#0F172A] text-sm mb-4">Top Agents</p>
          {topAgents.length === 0
            ? <p className="text-gray-400 text-sm">No data</p>
            : (
              <div className="space-y-3">
                {topAgents.map((a, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#3486cf]/10 text-[#3486cf] font-bold text-xs flex items-center justify-center flex-shrink-0">
                      {a.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] truncate">{a.name || a.email}</p>
                      <p className="text-xs text-gray-400">{a.orders} order{a.orders !== 1 ? "s" : ""}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#3486cf] flex-shrink-0">${a.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

      {/* Client intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upsell intelligence */}
        <div className="card">
          <p className="font-semibold text-[#0F172A] text-sm mb-1">Upsell Intelligence</p>
          <p className="text-xs text-gray-400 mb-4">Services most frequently booked together</p>
          {upsellData.length === 0 ? (
            <p className="text-gray-400 text-sm">Not enough data — needs bookings with multiple services.</p>
          ) : (
            <div className="space-y-3">
              {upsellData.map((pair, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-300 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-1.5 mb-0.5">
                      <span className="text-xs bg-[#3486cf]/10 text-[#3486cf] px-2 py-0.5 rounded-full font-medium">{pair.a}</span>
                      <span className="text-xs text-gray-300">+</span>
                      <span className="text-xs bg-gold/20 text-amber-800 px-2 py-0.5 rounded-full font-medium">{pair.b}</span>
                    </div>
                    <p className="text-xs text-gray-400">booked together {pair.count}×</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-green-50 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {pair.count}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Client retention */}
        <div className="card">
          <p className="font-semibold text-[#0F172A] text-sm mb-1">Client Retention</p>
          <p className="text-xs text-gray-400 mb-4">Repeat vs. new clients in period</p>
          <div className="flex items-center gap-6 mb-4">
            <div className="text-center">
              <p className="text-3xl font-bold font-display text-[#3486cf]">{repeatClients.rate}%</p>
              <p className="text-xs text-gray-400">repeat rate</p>
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Repeat clients</span>
                  <span>{repeatClients.repeat}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-full bg-[#3486cf] rounded-full" style={{ width: `${repeatClients.total > 0 ? (repeatClients.repeat / repeatClients.total) * 100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>New clients</span>
                  <span>{repeatClients.total - repeatClients.repeat}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-full bg-gold rounded-full" style={{ width: `${repeatClients.total > 0 ? ((repeatClients.total - repeatClients.repeat) / repeatClients.total) * 100 : 0}%` }} />
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-400">{repeatClients.total} unique clients in this period.</p>
        </div>
      </div>
    </div>
  );
}
