"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_LISTINGS = [
  { id: "m1", address: "4821 Ocean View Dr, La Jolla, CA",       clientName: "Sarah Mitchell", status: "confirmed",       totalPrice: 1199, depositAmount: 599,  depositPaid: true,  paidInFull: false, balancePaid: false, shootDate: "2026-05-02", gallery: {} },
  { id: "m2", address: "1205 Hillcrest Ave, Del Mar, CA",        clientName: "James Holbrook", status: "completed",       totalPrice: 549,  depositAmount: 274,  depositPaid: true,  paidInFull: true,  balancePaid: true,  shootDate: "2026-04-28", gallery: { delivered: true } },
  { id: "m3", address: "780 Sunset Blvd, Coronado, CA",          clientName: "Priya Anand",    status: "requested",       totalPrice: 1999, depositAmount: 999,  depositPaid: false, paidInFull: false, balancePaid: false, shootDate: "2026-05-06", gallery: {} },
  { id: "m4", address: "330 Harbor Dr, Point Loma, CA",          clientName: "Tom Reyes",      status: "confirmed",       totalPrice: 875,  depositAmount: 437,  depositPaid: true,  paidInFull: false, balancePaid: false, shootDate: "2026-05-04", gallery: {} },
  { id: "m5", address: "2190 Rancho Santa Fe Rd, Encinitas, CA", clientName: "Amanda Flores",  status: "completed",       totalPrice: 1549, depositAmount: 774,  depositPaid: true,  paidInFull: true,  balancePaid: true,  shootDate: "2026-04-22", gallery: { delivered: true } },
  { id: "m6", address: "555 Coast Blvd, La Jolla, CA",           clientName: "Derek Wang",     status: "pending_payment", totalPrice: 299,  depositAmount: 149,  depositPaid: false, paidInFull: false, balancePaid: false, shootDate: "2026-05-09", gallery: {} },
  { id: "m7", address: "892 Torrey Pines Rd, San Diego, CA",     clientName: "Natalie Cruz",   status: "confirmed",       totalPrice: 2399, depositAmount: 1199, depositPaid: true,  paidInFull: false, balancePaid: false, shootDate: "2026-05-01", gallery: {} },
  { id: "m8", address: "110 Prospect St, La Jolla, CA",          clientName: "Alex Yuen",      status: "completed",       totalPrice: 749,  depositAmount: 374,  depositPaid: true,  paidInFull: true,  balancePaid: true,  shootDate: "2026-04-19", gallery: { delivered: true } },
];

const MOCK_DATA = {
  "30d": [
    { label: "Apr 1",  revenue: 980,  bookings: 2 },
    { label: "Apr 8",  revenue: 1420, bookings: 3 },
    { label: "Apr 15", revenue: 890,  bookings: 2 },
    { label: "Apr 22", revenue: 1650, bookings: 4 },
    { label: "Apr 28", revenue: 1020, bookings: 2 },
  ],
  "6m": [
    { label: "Nov", revenue: 3850, bookings: 6 },
    { label: "Dec", revenue: 5120, bookings: 9 },
    { label: "Jan", revenue: 4290, bookings: 7 },
    { label: "Feb", revenue: 6740, bookings: 11 },
    { label: "Mar", revenue: 7880, bookings: 13 },
    { label: "Apr", revenue: 5960, bookings: 9 },
  ],
  "12m": [
    { label: "May", revenue: 2100, bookings: 4 },
    { label: "Jun", revenue: 3400, bookings: 6 },
    { label: "Jul", revenue: 4800, bookings: 8 },
    { label: "Aug", revenue: 5600, bookings: 9 },
    { label: "Sep", revenue: 3900, bookings: 6 },
    { label: "Oct", revenue: 4200, bookings: 7 },
    { label: "Nov", revenue: 3850, bookings: 6 },
    { label: "Dec", revenue: 5120, bookings: 9 },
    { label: "Jan", revenue: 4290, bookings: 7 },
    { label: "Feb", revenue: 6740, bookings: 11 },
    { label: "Mar", revenue: 7880, bookings: 13 },
    { label: "Apr", revenue: 5960, bookings: 9 },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarColor(str) {
  const p = ["#0B2A55","#1e6091","#2e7d32","#6a1b9a","#d84315","#00695c","#b5872d","#c0392b"];
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

function initials(name) {
  return (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function payLabel(l) {
  if (l.paidInFull || l.balancePaid) return { label: "Paid in full", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (l.depositPaid)                 return { label: "Deposit paid",  cls: "bg-blue-50 text-blue-700 border-blue-200" };
  return { label: "Unpaid", cls: "bg-gray-50 text-gray-500 border-gray-200" };
}

function buildChartData(listings, period, metric) {
  const now = new Date();
  const buckets = {};

  if (period === "30d") {
    for (let w = 4; w >= 0; w--) {
      const anchor = new Date(now);
      anchor.setDate(anchor.getDate() - w * 7);
      const key = `W${4 - w}`;
      buckets[key] = { label: anchor.toLocaleDateString("en-US", { month: "short", day: "numeric" }), revenue: 0, bookings: 0, sort: 4 - w };
    }
    listings.forEach((l) => {
      if (!l.shootDate) return;
      const d = new Date(l.shootDate + "T12:00:00");
      const daysAgo = Math.floor((now - d) / 86400000);
      if (daysAgo < 0 || daysAgo > 30) return;
      const key = `W${4 - Math.min(4, Math.floor(daysAgo / 7))}`;
      if (!buckets[key]) return;
      buckets[key].bookings += 1;
      buckets[key].revenue += (l.paidInFull || l.balancePaid) ? (l.totalPrice || 0) : l.depositPaid ? (l.depositAmount || 0) : 0;
    });
  } else {
    const months = period === "12m" ? 12 : 6;
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      buckets[key] = { label: d.toLocaleDateString("en-US", { month: "short" }), revenue: 0, bookings: 0, sort: months - 1 - i };
    }
    listings.forEach((l) => {
      if (!l.shootDate) return;
      const d = new Date(l.shootDate + "T12:00:00");
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      if (!buckets[key]) return;
      buckets[key].bookings += 1;
      buckets[key].revenue += (l.paidInFull || l.balancePaid) ? (l.totalPrice || 0) : l.depositPaid ? (l.depositAmount || 0) : 0;
    });
  }

  return Object.values(buckets)
    .sort((a, b) => a.sort - b.sort)
    .map((b) => ({ label: b.label, value: metric === "revenue" ? b.revenue : b.bookings }));
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────
function KpiStrip({ stats }) {
  const items = [
    { label: "Total Listings",    value: stats.total,                            },
    { label: "Active Shoots",     value: stats.confirmed,                        },
    { label: "Pending Review",    value: stats.pending, warn: stats.pending > 0  },
    { label: "Revenue Collected", value: `$${stats.revenue.toLocaleString()}`, gold: true },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 overflow-hidden rounded-2xl"
      style={{ background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      {items.map((item, i) => (
        <div key={i}
          className={`px-8 py-6 ${i >= 1 ? "border-l border-[var(--border-subtle)]" : ""} ${i >= 2 ? "max-lg:border-t max-lg:border-l-0 max-lg:border-[var(--border-subtle)]" : ""}`}>
          <p className={`text-[30px] font-bold leading-none tracking-tight mb-2.5 ${
            item.gold ? "text-[#B5872D]" : item.warn ? "text-amber-600" : "text-[#0F172A]"
          }`}>{item.value}</p>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-gray-400">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Area chart ────────────────────────────────────────────────────────────────
function AreaChart({ data, formatY, isBookings }) {
  const W = 840, H = 248;
  const padL = 54, padR = 20, padT = 28, padB = 44;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const max = Math.max(...data.map((d) => d.value), 1);

  const pts = data.map((d, i) => ({
    x: padL + (data.length > 1 ? (i / (data.length - 1)) * cW : cW * 0.5),
    y: padT + cH - (d.value / max) * cH,
    v: d.value,
    label: d.label,
  }));

  function smoothPath(points) {
    if (points.length < 2) return `M${points[0]?.x || 0},${points[0]?.y || 0}`;
    let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
  }

  const linePath  = smoothPath(pts);
  const lastP     = pts[pts.length - 1];
  const firstP    = pts[0];
  const bottom    = padT + cH;
  const areaPath  = `${linePath} L ${lastP.x.toFixed(1)},${bottom} L ${firstP.x.toFixed(1)},${bottom} Z`;
  const peakIdx   = data.reduce((bi, d, i) => d.value > data[bi].value ? i : bi, 0);

  const accent = isBookings ? "#0891B2" : "#0B2A55";
  const goldC  = "#C9A96E";

  const yTicks = [0.25, 0.5, 0.75, 1].map((t) => ({
    y:     padT + cH - t * cH,
    label: formatY(Math.round(max * t)),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={accent} stopOpacity="0.13" />
          <stop offset="65%"  stopColor={accent} stopOpacity="0.04" />
          <stop offset="100%" stopColor={accent} stopOpacity="0"    />
        </linearGradient>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={goldC} stopOpacity="0.16" />
          <stop offset="100%" stopColor={goldC} stopOpacity="0"    />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((t, i) => (
        <line key={i} x1={padL} y1={t.y} x2={W - padR} y2={t.y}
          stroke="#EEF0F6" strokeWidth="1" strokeDasharray="5 4" />
      ))}

      {/* Y labels */}
      {yTicks.map((t, i) => (
        <text key={i} x={padL - 10} y={t.y + 4} textAnchor="end" fontSize="10"
          fill="#C4CBD8" fontFamily="system-ui,-apple-system,sans-serif">
          {t.label}
        </text>
      ))}

      {/* Gold accent on last segment */}
      {pts.length >= 2 && (() => {
        const a = pts[pts.length - 2];
        const b = pts[pts.length - 1];
        const mx = (b.x - a.x) / 3;
        return (
          <path
            d={`M ${a.x.toFixed(1)},${bottom} L ${a.x.toFixed(1)},${a.y.toFixed(1)} C ${(a.x+mx).toFixed(1)},${a.y.toFixed(1)} ${(b.x-mx).toFixed(1)},${b.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} L ${b.x.toFixed(1)},${bottom} Z`}
            fill="url(#goldGrad)" opacity="0.55"
          />
        );
      })()}

      {/* Area fill */}
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke={accent} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Points */}
      {pts.map((p, i) => (
        <g key={i}>
          {i === pts.length - 1 ? (
            <>
              <circle cx={p.x} cy={p.y} r="9"   fill={goldC}  fillOpacity="0.15" />
              <circle cx={p.x} cy={p.y} r="5"   fill={accent} />
              <circle cx={p.x} cy={p.y} r="2.5" fill="white"  />
            </>
          ) : (
            <circle cx={p.x} cy={p.y} r="3.5" fill="white" stroke={accent} strokeWidth="2" />
          )}
        </g>
      ))}

      {/* Peak callout */}
      {pts[peakIdx] && peakIdx !== pts.length - 1 && (
        <g>
          <line x1={pts[peakIdx].x} y1={pts[peakIdx].y - 8}  x2={pts[peakIdx].x} y2={pts[peakIdx].y - 24}
            stroke={accent} strokeWidth="1" strokeDasharray="2,2" opacity="0.35" />
          <rect x={pts[peakIdx].x - 30} y={pts[peakIdx].y - 42} width={60} height={20} rx={6} fill={accent} />
          <text x={pts[peakIdx].x} y={pts[peakIdx].y - 27} textAnchor="middle" fontSize="10.5"
            fill="white" fontFamily="system-ui,-apple-system" fontWeight="700">
            {formatY(data[peakIdx].value)}
          </text>
        </g>
      )}

      {/* Current callout */}
      {lastP && (
        <g>
          <line x1={lastP.x} y1={lastP.y - 12} x2={lastP.x} y2={lastP.y - 30}
            stroke={goldC} strokeWidth="1.5" strokeDasharray="2,2" opacity="0.65" />
          <rect x={lastP.x - 32} y={lastP.y - 50} width={64} height={22} rx={6} fill={goldC} />
          <text x={lastP.x} y={lastP.y - 33} textAnchor="middle" fontSize="11"
            fill="white" fontFamily="system-ui,-apple-system" fontWeight="700">
            {formatY(data[data.length - 1].value)}
          </text>
        </g>
      )}

      {/* X labels */}
      {pts.map((p, i) => (
        <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="11"
          fill={i === pts.length - 1 ? goldC : "#A0AEC0"}
          fontWeight={i === pts.length - 1 ? "700" : "400"}
          fontFamily="system-ui,-apple-system,sans-serif">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

// ── Revenue hero ──────────────────────────────────────────────────────────────
function RevenueHero({ listings, isMock }) {
  const [period, setPeriod] = useState("6m");
  const [metric, setMetric] = useState("revenue");

  const chartData = useMemo(() => {
    if (isMock) {
      return MOCK_DATA[period].map((d) => ({ label: d.label, value: metric === "revenue" ? d.revenue : d.bookings }));
    }
    const built = buildChartData(listings, period, metric);
    const hasData = built.some((d) => d.value > 0);
    if (!hasData) {
      return MOCK_DATA[period].map((d) => ({ label: d.label, value: metric === "revenue" ? d.revenue : d.bookings }));
    }
    return built;
  }, [period, metric, listings, isMock]);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  const change = useMemo(() => {
    if (chartData.length < 2) return null;
    const prev = chartData[chartData.length - 2]?.value || 0;
    const curr = chartData[chartData.length - 1]?.value || 0;
    if (prev === 0) return null;
    const pct = Math.round(((curr - prev) / prev) * 100);
    return { pct, up: pct >= 0 };
  }, [chartData]);

  const periodLabel = { "30d": "Last 30 Days", "6m": "6 Months", "12m": "12 Months" }[period];
  const metricLabel = metric === "revenue" ? "Revenue" : "Bookings";
  const formatY = metric === "revenue"
    ? (v) => v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v}`
    : (v) => `${v}`;
  const displayTotal = metric === "revenue"
    ? `$${total.toLocaleString()}`
    : total.toLocaleString();

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>

      <div className="px-8 pt-8 pb-5 flex items-start justify-between gap-8"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}>

        {/* Left: metric + total */}
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-gray-400 mb-2">
            {periodLabel} · {metricLabel}
            {isMock && <span className="ml-2 text-gray-300 font-normal normal-case tracking-normal italic">sample</span>}
          </p>
          <p className="text-[38px] font-bold text-[#0F172A] leading-none tracking-tight mb-2">
            {displayTotal}
          </p>
          <div className="flex items-center gap-3">
            {change && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                change.up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
              }`}>
                {change.up ? "↑" : "↓"} {Math.abs(change.pct)}% vs prev period
              </span>
            )}
            <Link href="/dashboard/reports" className="text-xs text-gray-400 hover:text-[#0B2A55] transition-colors">
              Full report →
            </Link>
          </div>
        </div>

        {/* Right: toggles */}
        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          {/* Period */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)" }}>
            {[{ id: "30d", label: "30D" }, { id: "6m", label: "6M" }, { id: "12m", label: "12M" }].map((p) => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150"
                style={period === p.id
                  ? { background: "#fff", color: "#0F172A", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }
                  : { color: "#94A3B8" }}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Metric */}
          <div className="flex items-center gap-0.5 p-1 rounded-xl"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)" }}>
            {[{ id: "revenue", label: "Revenue" }, { id: "bookings", label: "Bookings" }].map((m) => (
              <button key={m.id} onClick={() => setMetric(m.id)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150"
                style={metric === m.id
                  ? { background: "#fff", color: "#0F172A", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }
                  : { color: "#94A3B8" }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 pt-6 pb-5">
        <AreaChart data={chartData} formatY={formatY} isBookings={metric === "bookings"} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardHome() {
  const [listings,    setListings]    = useState([]);
  const [tenant,      setTenant]      = useState(null);
  const [hasProducts, setHasProducts] = useState(false);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    auth.currentUser?.getIdToken(true).then(async (token) => {
      const h = { Authorization: `Bearer ${token}` };
      const [listRes, tenantRes, svcRes, pkgRes] = await Promise.all([
        fetch("/api/dashboard/listings",               { headers: h }),
        fetch("/api/dashboard/tenant",                 { headers: h }),
        fetch("/api/dashboard/products?type=services", { headers: h }),
        fetch("/api/dashboard/products?type=packages", { headers: h }),
      ]);
      if (listRes.ok)   { const d = await listRes.json();   setListings(d.listings || []); }
      if (tenantRes.ok) { const d = await tenantRes.json(); setTenant(d.tenant); }
      const svcData = svcRes.ok ? await svcRes.json() : {};
      const pkgData = pkgRes.ok ? await pkgRes.json() : {};
      setHasProducts((svcData.items?.length || 0) > 0 || (pkgData.items?.length || 0) > 0);
      setLoading(false);
    });
  }, []);

  const isMock  = listings.length === 0;
  const display = isMock ? MOCK_LISTINGS : listings;

  const stats = useMemo(() => ({
    total:     display.length,
    pending:   display.filter((l) => l.status === "requested").length,
    confirmed: display.filter((l) => l.status === "confirmed").length,
    completed: display.filter((l) => l.status === "completed").length,
    revenue:   display.reduce((s, l) => {
      if (l.paidInFull || l.balancePaid) return s + (l.totalPrice || 0);
      if (l.depositPaid)                 return s + (l.depositAmount || 0);
      return s;
    }, 0),
  }), [display]);

  const actionItems = display.filter((l) => l.status === "requested" || l.status === "pending_payment").slice(0, 5);
  const upcoming    = display.filter((l) => l.status === "confirmed").sort((a, b) => (a.shootDate || "").localeCompare(b.shootDate || "")).slice(0, 6);

  const setupSteps = tenant ? [
    { done: !!tenant.phone,                                                                label: "Complete your profile",   href: "/onboarding" },
    { done: !!(tenant.branding?.primaryColor && tenant.branding?.businessName),            label: "Configure branding",      href: "/dashboard/settings#settings-branding" },
    { done: !!(tenant.bookingConfig || tenant.pricingConfig || tenant.availabilityConfig), label: "Review booking settings", href: "/dashboard/settings" },
    { done: !!tenant.stripeConnectOnboarded,                                               label: "Connect Stripe",          href: "/dashboard/billing" },
    { done: hasProducts,                                                                   label: "Add services",            href: "/dashboard/products" },
    { done: listings.length > 0,                                                           label: "First booking received",  href: null },
  ] : [];
  const doneCount     = setupSteps.filter((s) => s.done).length;
  const setupComplete = doneCount === setupSteps.length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-[#0B2A55] rounded-full animate-spin" />
    </div>
  );

  const today     = new Date();
  const hour      = today.getHours();
  const greeting  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const bizName   = tenant?.businessName || "";
  const firstName = bizName.split(" ")[0] || "there";
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const bookingUrl = tenant
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${tenant.slug}/book`
    : "";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-[1260px] mx-auto px-8 py-10 space-y-8">

        {/* ── Setup hero ──────────────────────────────────────────────────── */}
        {tenant && !setupComplete && (
          <div className="relative overflow-hidden rounded-2xl px-8 py-7"
            style={{ background: "linear-gradient(135deg, #0B2A55 0%, #0d3575 100%)", boxShadow: "0 8px 32px rgba(11,42,85,0.25)" }}>
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-6 mb-4">
                <div>
                  <p className="text-white/45 text-[10.5px] font-semibold uppercase tracking-widest mb-1">Getting started</p>
                  <h2 className="text-white text-lg font-semibold">{doneCount} of {setupSteps.length} steps complete</h2>
                </div>
                <Link href="/onboarding"
                  className="flex-shrink-0 text-xs font-semibold bg-white text-[#0B2A55] px-5 py-2.5 rounded-xl hover:bg-white/90 transition-colors whitespace-nowrap">
                  Continue Setup →
                </Link>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1">
                <div className="bg-[#C9A96E] h-1 rounded-full transition-all duration-700"
                  style={{ width: `${(doneCount / setupSteps.length) * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* ── Stripe banner ───────────────────────────────────────────────── */}
        {tenant && !tenant.stripeConnectOnboarded && setupComplete && (
          <div className="rounded-2xl px-6 py-4 flex items-center justify-between gap-4"
            style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
            <p className="text-amber-900 font-semibold text-sm">
              Connect Stripe to collect payments.
              <span className="text-amber-700/60 font-normal ml-1.5">Deposits won't be charged until Stripe Connect is active.</span>
            </p>
            <Link href="/dashboard/billing"
              className="flex-shrink-0 text-xs font-semibold text-amber-900 border border-amber-300 bg-white px-4 py-2.5 rounded-xl hover:bg-amber-50 transition-colors whitespace-nowrap">
              Connect Stripe →
            </Link>
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-1">{dateLabel}</p>
            <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight tracking-tight">
              {greeting}{firstName !== "there" ? `, ${firstName}` : ""}
              {isMock && (
                <span className="ml-3 align-middle text-xs font-normal text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">
                  sample data
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {bookingUrl && (
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs font-medium text-gray-500 hover:text-[#0B2A55] transition-colors">
                Booking page ↗
              </a>
            )}
            <Link href="/dashboard/listings/new"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white px-4 py-2.5 rounded-xl"
              style={{ background: "linear-gradient(135deg, #0B2A55 0%, #0d3575 100%)", boxShadow: "0 2px 8px rgba(11,42,85,0.28)" }}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Listing
            </Link>
          </div>
        </div>

        {/* ── KPI strip ───────────────────────────────────────────────────── */}
        <KpiStrip stats={stats} />

        {/* ── Revenue hero ────────────────────────────────────────────────── */}
        <RevenueHero listings={display} isMock={isMock} />

        {/* ── Action Required (conditional) ───────────────────────────────── */}
        {actionItems.length > 0 && (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div className="px-7 py-5 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <h2 className="font-semibold text-[#0F172A] text-sm">Action Required</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                  {actionItems.length}
                </span>
              </div>
              <Link href="/dashboard/listings" className="text-xs text-gray-400 hover:text-[#0B2A55] transition-colors">
                View all →
              </Link>
            </div>
            <div>
              {actionItems.map((l, idx) => {
                const isRequested = l.status === "requested";
                return (
                  <Link key={l.id}
                    href={isMock ? "/dashboard/listings" : `/dashboard/listings/${l.id}`}
                    className="group flex items-center gap-5 px-7 py-4 relative transition-colors"
                    style={{ borderBottom: idx < actionItems.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgb(15 23 42 / 0.018)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full"
                      style={{ background: isRequested ? "#F59E0B" : "#EA580C" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-semibold text-[#0F172A] truncate">{l.address?.split(",")[0]}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {l.clientName}
                        <span className="mx-1.5 text-gray-200">·</span>
                        {isRequested ? "Needs review" : "Awaiting payment"}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-[#0F172A] flex-shrink-0">${l.totalPrice?.toLocaleString()}</p>
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#CBD5E1" strokeWidth="2"
                      className="flex-shrink-0 group-hover:stroke-[#0B2A55] transition-colors">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Upcoming Shoots ──────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div className="px-7 py-5 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-[#0F172A] text-sm">Upcoming Shoots</h2>
              {upcoming.length > 0 && (
                <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{upcoming.length} confirmed</span>
              )}
            </div>
            <Link href="/dashboard/listings" className="text-xs text-gray-400 hover:text-[#0B2A55] transition-colors">
              View all →
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="px-7 py-14 text-center">
              <p className="text-sm font-semibold text-[#0F172A] mb-1">No confirmed shoots</p>
              <p className="text-xs text-gray-400">Confirmed bookings will appear here.</p>
            </div>
          ) : (
            <div>
              {upcoming.map((l, idx) => {
                const date   = l.shootDate ? new Date(l.shootDate + "T12:00:00") : null;
                const mo     = date ? date.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "--";
                const dd     = date ? date.getDate() : "--";
                const dow    = date ? date.toLocaleDateString("en-US", { weekday: "short" }) : "";
                const aColor = avatarColor(l.clientName || "");
                const pay    = payLabel(l);
                const isToday = date && date.toDateString() === new Date().toDateString();
                const isTomorrow = date && (() => { const t = new Date(); t.setDate(t.getDate() + 1); return date.toDateString() === t.toDateString(); })();

                return (
                  <Link key={l.id}
                    href={isMock ? "/dashboard/listings" : `/dashboard/listings/${l.id}`}
                    className="group flex items-center gap-6 px-7 py-5 transition-colors"
                    style={{ borderBottom: idx < upcoming.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgb(15 23 42 / 0.018)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>

                    {/* Date chip */}
                    <div className="w-[52px] flex-shrink-0 text-center py-2 rounded-xl"
                      style={isToday
                        ? { background: "#0B2A55" }
                        : { background: "#F8F9FC", border: "1px solid var(--border-subtle)" }}>
                      <div className={`text-[9.5px] font-bold uppercase tracking-wider ${isToday ? "text-white/55" : "text-[#0B2A55]/35"}`}>{mo}</div>
                      <div className={`text-[22px] font-bold leading-tight my-0.5 ${isToday ? "text-white" : "text-[#0F172A]"}`}>{dd}</div>
                      <div className={`text-[9px] font-semibold uppercase ${isToday ? "text-white/45" : "text-gray-400"}`}>{dow}</div>
                    </div>

                    {/* Avatar + info */}
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: aColor }}>
                        {initials(l.clientName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13.5px] font-semibold text-[#0F172A] truncate">{l.clientName}</p>
                          {isToday && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0B2A55] text-white flex-shrink-0">Today</span>}
                          {isTomorrow && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">Tomorrow</span>}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{l.address?.split(",")[0]}</p>
                      </div>
                    </div>

                    {/* Price + payment */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[13.5px] font-bold text-[#0F172A]">${l.totalPrice?.toLocaleString()}</p>
                      <span className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${pay.cls}`}>
                        {pay.label}
                      </span>
                    </div>

                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#CBD5E1" strokeWidth="2"
                      className="flex-shrink-0 group-hover:stroke-[#0B2A55] transition-colors">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Recent Activity ──────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div className="px-7 py-5 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 className="font-semibold text-[#0F172A] text-sm">
              Recent Listings
              {isMock && <span className="ml-2 text-xs font-normal text-gray-400">(sample)</span>}
            </h2>
            <Link href="/dashboard/listings" className="text-xs text-gray-400 hover:text-[#0B2A55] transition-colors">
              View all {display.length} →
            </Link>
          </div>

          <div>
            {display.slice(0, 5).map((l, idx) => {
              const pay    = payLabel(l);
              const aColor = avatarColor(l.clientName || "");
              const date   = l.shootDate ? new Date(l.shootDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;
              const statusColors = {
                requested:       "text-amber-600",
                pending_payment: "text-orange-600",
                confirmed:       "text-blue-600",
                completed:       "text-emerald-600",
                cancelled:       "text-gray-400",
              };

              return (
                <Link key={l.id}
                  href={isMock ? "/dashboard/listings" : `/dashboard/listings/${l.id}`}
                  className="group flex items-center gap-5 px-7 py-4 transition-colors"
                  style={{ borderBottom: idx < Math.min(display.length, 5) - 1 ? "1px solid var(--border-subtle)" : "none" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgb(15 23 42 / 0.018)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>

                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                    style={{ background: aColor }}>
                    {initials(l.clientName)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F172A] truncate group-hover:text-[#0B2A55] transition-colors">
                      {l.address?.split(",")[0]}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {l.clientName}{date && <span> · {date}</span>}
                    </p>
                  </div>

                  <span className={`text-[11px] font-semibold flex-shrink-0 ${statusColors[l.status] || "text-gray-500"}`}>
                    {l.status === "requested" ? "Pending review" : l.status === "pending_payment" ? "Awaiting payment" : l.status === "confirmed" ? "Confirmed" : l.status === "completed" ? "Completed" : l.status}
                  </span>

                  <p className="text-[13px] font-bold text-[#0F172A] flex-shrink-0 w-20 text-right">
                    ${l.totalPrice?.toLocaleString()}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
