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

const STATUS_META = {
  pending_payment: { label: "Awaiting Payment", bg: "bg-orange-50",  text: "text-orange-700",  dot: "bg-orange-400" },
  requested:       { label: "Pending Review",   bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400"  },
  confirmed:       { label: "Confirmed",         bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500"   },
  completed:       { label: "Completed",         bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  cancelled:       { label: "Cancelled",         bg: "bg-gray-100",   text: "text-gray-500",    dot: "bg-gray-400"   },
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
  return Object.values(buckets).sort((a, b) => a.sort - b.sort)
    .map((b) => ({ label: b.label, value: metric === "revenue" ? b.revenue : b.bookings }));
}

// ── StatusDot ─────────────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const m = STATUS_META[status] || STATUS_META.requested;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

// ── KPI Widget ────────────────────────────────────────────────────────────────
function KpiWidget({ label, value, sub, icon, accentColor, accentBg, dark, alert }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-3"
      style={dark
        ? { background: "linear-gradient(135deg, #0B2A55 0%, #0d3575 100%)", boxShadow: "0 4px 20px rgba(11,42,85,0.35)" }
        : { background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)" }
      }>
      {dark && (
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
      )}
      <div className="relative flex items-center justify-between">
        <div className="w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0"
          style={{ background: dark ? "rgba(255,255,255,0.14)" : accentBg }}>
          <svg width="17" height="17" fill="none" viewBox="0 0 24 24"
            stroke={dark ? "#fff" : accentColor} strokeWidth="2">
            {icon}
          </svg>
        </div>
        {alert && (
          <span className="text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(251,191,36,0.2)", color: "#B45309" }}>
            {alert}
          </span>
        )}
      </div>
      <div className="relative">
        <p className={`text-[32px] font-bold leading-none tracking-tight mb-1.5 ${dark ? "text-white" : "text-[#0F172A]"}`}>
          {value}
        </p>
        <p className={`text-[10.5px] font-semibold uppercase tracking-[0.09em] ${dark ? "text-white/45" : "text-gray-400"}`}>
          {label}
        </p>
        {sub && (
          <p className={`text-xs mt-0.5 ${dark ? "text-white/30" : "text-gray-400"}`}>{sub}</p>
        )}
      </div>
    </div>
  );
}

// ── Area chart ────────────────────────────────────────────────────────────────
function RevenueAreaChart({ data, formatY, isBookings }) {
  const W = 820, H = 215;
  const padL = 52, padR = 18, padT = 26, padB = 40;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const max = Math.max(...data.map(d => d.value), 1);

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

  const linePath = smoothPath(pts);
  const lastP    = pts[pts.length - 1];
  const firstP   = pts[0];
  const bottom   = padT + cH;
  const areaPath = `${linePath} L ${lastP.x.toFixed(1)},${bottom} L ${firstP.x.toFixed(1)},${bottom} Z`;
  const peakIdx  = data.reduce((bi, d, i) => d.value > data[bi].value ? i : bi, 0);
  const accent   = isBookings ? "#0891B2" : "#0B2A55";
  const goldC    = "#C9A96E";

  const yTicks = [0.25, 0.5, 0.75, 1].map(t => ({
    y:     padT + cH - t * cH,
    label: formatY(Math.round(max * t)),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={accent} stopOpacity="0.16" />
          <stop offset="60%"  stopColor={accent} stopOpacity="0.05" />
          <stop offset="100%" stopColor={accent} stopOpacity="0"    />
        </linearGradient>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={goldC} stopOpacity="0.18" />
          <stop offset="100%" stopColor={goldC} stopOpacity="0"    />
        </linearGradient>
      </defs>

      {yTicks.map((t, i) => (
        <line key={i} x1={padL} y1={t.y} x2={W - padR} y2={t.y}
          stroke="#EEF0F6" strokeWidth="1" strokeDasharray="5 4" />
      ))}
      {yTicks.map((t, i) => (
        <text key={i} x={padL - 10} y={t.y + 4} textAnchor="end" fontSize="10"
          fill="#C4CBD8" fontFamily="system-ui,-apple-system,sans-serif">
          {t.label}
        </text>
      ))}

      {pts.length >= 2 && (() => {
        const a = pts[pts.length - 2];
        const b = pts[pts.length - 1];
        const mx = (b.x - a.x) / 3;
        return (
          <path
            d={`M ${a.x.toFixed(1)},${bottom} L ${a.x.toFixed(1)},${a.y.toFixed(1)} C ${(a.x+mx).toFixed(1)},${a.y.toFixed(1)} ${(b.x-mx).toFixed(1)},${b.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)} L ${b.x.toFixed(1)},${bottom} Z`}
            fill="url(#goldGrad)" opacity="0.6"
          />
        );
      })()}

      <path d={areaPath} fill="url(#revGrad)" />
      <path d={linePath} fill="none" stroke={accent} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />

      {pts.map((p, i) => (
        <g key={i}>
          {i === pts.length - 1 ? (
            <>
              <circle cx={p.x} cy={p.y} r="10" fill={goldC}  fillOpacity="0.15" />
              <circle cx={p.x} cy={p.y} r="5.5" fill={accent} />
              <circle cx={p.x} cy={p.y} r="2.5" fill="white"  />
            </>
          ) : (
            <circle cx={p.x} cy={p.y} r="4" fill="white" stroke={accent} strokeWidth="2" />
          )}
        </g>
      ))}

      {pts[peakIdx] && peakIdx !== pts.length - 1 && (
        <g>
          <line x1={pts[peakIdx].x} y1={pts[peakIdx].y - 8}  x2={pts[peakIdx].x} y2={pts[peakIdx].y - 22}
            stroke={accent} strokeWidth="1" strokeDasharray="2,2" opacity="0.4" />
          <rect x={pts[peakIdx].x - 28} y={pts[peakIdx].y - 38} width={56} height={18} rx={5} fill={accent} />
          <text x={pts[peakIdx].x} y={pts[peakIdx].y - 25} textAnchor="middle" fontSize="10.5"
            fill="white" fontFamily="system-ui,-apple-system" fontWeight="700">
            {formatY(data[peakIdx].value)}
          </text>
        </g>
      )}

      {lastP && (
        <g>
          <line x1={lastP.x} y1={lastP.y - 12} x2={lastP.x} y2={lastP.y - 28}
            stroke={goldC} strokeWidth="1.5" strokeDasharray="2,2" opacity="0.7" />
          <rect x={lastP.x - 30} y={lastP.y - 46} width={60} height={20} rx={5} fill={goldC} />
          <text x={lastP.x} y={lastP.y - 31} textAnchor="middle" fontSize="11"
            fill="white" fontFamily="system-ui,-apple-system" fontWeight="700">
            {formatY(data[data.length - 1].value)}
          </text>
        </g>
      )}

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

// ── Revenue section (self-contained with toggles) ─────────────────────────────
function RevenueSection({ listings, isMock }) {
  const [period, setPeriod] = useState("6m");
  const [metric, setMetric] = useState("revenue");

  const chartData = useMemo(() => {
    if (isMock) {
      return MOCK_DATA[period].map(d => ({ label: d.label, value: metric === "revenue" ? d.revenue : d.bookings }));
    }
    const built = buildChartData(listings, period, metric);
    return built.some(d => d.value > 0) ? built : MOCK_DATA[period].map(d => ({ label: d.label, value: metric === "revenue" ? d.revenue : d.bookings }));
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

  const formatY = metric === "revenue"
    ? (v) => v >= 1000 ? `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `$${v}`
    : (v) => `${v}`;

  const displayTotal = metric === "revenue" ? `$${total.toLocaleString()}` : total.toLocaleString();
  const periodLabel  = { "30d": "30 Days", "6m": "6 Months", "12m": "12 Months" }[period];

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>

      <div className="px-7 pt-6 pb-4 flex items-start justify-between gap-6"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div>
          <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-[0.09em] mb-1.5">
            {periodLabel} · {metric === "revenue" ? "Revenue" : "Bookings"}
            {isMock && <span className="ml-2 text-gray-300 font-normal normal-case tracking-normal italic">sample</span>}
          </p>
          <p className="text-[34px] font-bold text-[#0F172A] leading-none tracking-tight mb-2">
            {displayTotal}
          </p>
          <div className="flex items-center gap-3">
            {change && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${change.up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {change.up ? "↑" : "↓"} {Math.abs(change.pct)}% vs prev
              </span>
            )}
            <Link href="/dashboard/reports" className="text-xs text-gray-400 hover:text-[#0B2A55] transition-colors">
              Full report →
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2.5 flex-shrink-0">
          <div className="flex items-center gap-0.5 p-1 rounded-xl"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)" }}>
            {[{ id: "30d", label: "30D" }, { id: "6m", label: "6M" }, { id: "12m", label: "12M" }].map(p => (
              <button key={p.id} onClick={() => setPeriod(p.id)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150"
                style={period === p.id
                  ? { background: "#fff", color: "#0F172A", boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }
                  : { color: "#94A3B8" }}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5 p-1 rounded-xl"
            style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-subtle)" }}>
            {[{ id: "revenue", label: "Revenue" }, { id: "bookings", label: "Bookings" }].map(m => (
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

      <div className="px-5 pt-5 pb-4">
        <RevenueAreaChart data={chartData} formatY={formatY} isBookings={metric === "bookings"} />
      </div>
    </div>
  );
}

// ── Copy link button ──────────────────────────────────────────────────────────
function CopyLinkButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { if (!text) return; navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
      className="inline-flex items-center gap-2 text-xs font-semibold border bg-white text-gray-600 px-4 py-2.5 rounded-xl transition-colors"
      style={{ borderColor: "var(--border)" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#0B2A55"; e.currentTarget.style.color = "#0B2A55"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = ""; }}>
      {copied ? (
        <>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy Booking Link
        </>
      )}
    </button>
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
    pending:   display.filter(l => l.status === "requested").length,
    confirmed: display.filter(l => l.status === "confirmed").length,
    completed: display.filter(l => l.status === "completed").length,
    revenue:   display.reduce((s, l) => {
      if (l.paidInFull || l.balancePaid) return s + (l.totalPrice || 0);
      if (l.depositPaid)                 return s + (l.depositAmount || 0);
      return s;
    }, 0),
  }), [display]);

  const upcoming = display
    .filter(l => l.status === "confirmed")
    .sort((a, b) => (a.shootDate || "").localeCompare(b.shootDate || ""))
    .slice(0, 5);

  const setupSteps = tenant ? [
    { done: !!tenant.phone,                                                                label: "Complete your profile",   href: "/onboarding" },
    { done: !!(tenant.branding?.primaryColor && tenant.branding?.businessName),            label: "Configure branding",      href: "/dashboard/settings#settings-branding" },
    { done: !!(tenant.bookingConfig || tenant.pricingConfig || tenant.availabilityConfig), label: "Review booking settings", href: "/dashboard/settings" },
    { done: !!tenant.stripeConnectOnboarded,                                               label: "Connect Stripe",          href: "/dashboard/billing" },
    { done: hasProducts,                                                                   label: "Add services",            href: "/dashboard/products" },
    { done: listings.length > 0,                                                           label: "First booking received",  href: null },
  ] : [];
  const doneCount     = setupSteps.filter(s => s.done).length;
  const setupComplete = doneCount === setupSteps.length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-[#0B2A55] rounded-full animate-spin" />
    </div>
  );

  const today    = new Date();
  const hour     = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const bizName  = tenant?.businessName || "";
  const firstName = bizName.split(" ")[0] || "there";
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const bookingUrl = tenant
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${tenant.slug}/book`
    : "";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-[1340px] mx-auto px-6 py-8 space-y-5">

        {/* ── Setup hero ──────────────────────────────────────────────────── */}
        {tenant && !setupComplete && (
          <div className="relative overflow-hidden rounded-2xl px-8 py-7"
            style={{ background: "linear-gradient(135deg, #0B2A55 0%, #0d3575 100%)", boxShadow: "0 8px 32px rgba(11,42,85,0.3)" }}>
            <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
              style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-6 mb-5">
                <div>
                  <p className="text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-1">Getting started</p>
                  <h2 className="text-white text-xl font-semibold">{doneCount} of {setupSteps.length} steps complete</h2>
                  <p className="text-white/50 text-sm mt-1">Finish setup to start accepting bookings.</p>
                </div>
                <Link href="/onboarding"
                  className="flex-shrink-0 text-xs font-semibold bg-white text-[#0B2A55] px-5 py-2.5 rounded-xl hover:bg-white/90 transition-colors whitespace-nowrap">
                  Continue Setup →
                </Link>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1 mb-4">
                <div className="bg-[#C9A96E] h-1 rounded-full transition-all duration-700"
                  style={{ width: `${(doneCount / setupSteps.length) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-2">
                {setupSteps.map((s, i) => (
                  <span key={i} className={`text-[11px] font-medium px-3 py-1 rounded-full ${s.done ? "bg-white/10 text-white/35 line-through" : "bg-white/15 text-white/80"}`}>
                    {s.done ? "✓ " : ""}{s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Stripe banner ───────────────────────────────────────────────── */}
        {tenant && !tenant.stripeConnectOnboarded && setupComplete && (
          <div className="rounded-2xl px-6 py-4 flex items-center justify-between gap-4"
            style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "#FEF3C7" }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#D97706" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-amber-900 font-semibold text-sm">Connect Stripe to accept payments</p>
                <p className="text-amber-700/70 text-xs mt-0.5">Deposits won't be collected until Stripe Connect is active.</p>
              </div>
            </div>
            <Link href="/dashboard/billing"
              className="flex-shrink-0 text-xs font-semibold text-amber-900 border border-amber-300 bg-white px-4 py-2.5 rounded-xl hover:bg-amber-50 transition-colors whitespace-nowrap">
              Connect Stripe →
            </Link>
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-0.5">{dateLabel}</p>
            <h1 className="text-[26px] font-bold text-[#0F172A] leading-tight tracking-tight">
              {greeting}, {firstName}
              {isMock && (
                <span className="ml-3 align-middle text-xs font-normal text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">
                  sample data
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {bookingUrl && <CopyLinkButton text={bookingUrl} />}
            {bookingUrl && (
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold border bg-white text-gray-600 px-4 py-2.5 rounded-xl transition-colors"
                style={{ borderColor: "var(--border)" }}>
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Booking Page
              </a>
            )}
            <Link href="/dashboard/listings/new"
              className="inline-flex items-center gap-2 text-xs font-semibold text-white px-4 py-2.5 rounded-xl transition-colors"
              style={{ background: "linear-gradient(135deg, #0B2A55 0%, #0d3575 100%)", boxShadow: "0 2px 8px rgba(11,42,85,0.3)" }}>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Listing
            </Link>
          </div>
        </div>

        {/* ── KPI row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiWidget
            dark
            label="Total Listings"
            value={stats.total}
            sub="all time"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
            accentColor="#0B2A55"
            accentBg="#EEF2F8"
          />
          <KpiWidget
            label="Pending Review"
            value={stats.pending}
            sub={stats.pending > 0 ? "need your action" : "all clear"}
            alert={stats.pending > 0 ? stats.pending : null}
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
            accentColor="#D97706"
            accentBg="#FFF8ED"
          />
          <KpiWidget
            label="Active Shoots"
            value={stats.confirmed}
            sub="confirmed"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />}
            accentColor="#0891B2"
            accentBg="#ECFEFF"
          />
          <KpiWidget
            label="Completed"
            value={stats.completed}
            sub="delivered"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
            accentColor="#059669"
            accentBg="#ECFDF5"
          />
          <KpiWidget
            label="Revenue Collected"
            value={`$${stats.revenue.toLocaleString()}`}
            sub="deposits + paid"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
            accentColor="#B5872D"
            accentBg="#FDF6EB"
          />
        </div>

        {/* ── Revenue — full-width hero ────────────────────────────────────── */}
        <RevenueSection listings={display} isMock={isMock} />

        {/* ── Upcoming Shoots ──────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "#EEF2F8" }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#0B2A55" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-semibold text-[#0F172A] text-sm">Upcoming Shoots</h2>
              {upcoming.length > 0 && (
                <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {upcoming.length} confirmed
                </span>
              )}
            </div>
            <Link href="/dashboard/listings" className="text-xs text-gray-400 hover:text-[#0B2A55] transition-colors">
              View all →
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #EEF2F8 0%, #DBEAFE 100%)" }}>
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#0B2A55" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#0F172A]">No confirmed shoots</p>
              <p className="text-xs text-gray-400 mt-1">Confirmed bookings will appear here.</p>
            </div>
          ) : (
            <div>
              {upcoming.map((l, idx) => {
                const date  = l.shootDate ? new Date(l.shootDate + "T12:00:00") : null;
                const mo    = date ? date.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "--";
                const dd    = date ? date.getDate() : "--";
                const dow   = date ? date.toLocaleDateString("en-US", { weekday: "short" }) : "";
                const aColor = avatarColor(l.clientName || "");
                const pay   = payLabel(l);
                const isToday    = date && date.toDateString() === new Date().toDateString();
                const isTomorrow = date && (() => { const t = new Date(); t.setDate(t.getDate() + 1); return date.toDateString() === t.toDateString(); })();

                return (
                  <Link key={l.id}
                    href={isMock ? "/dashboard/listings" : `/dashboard/listings/${l.id}`}
                    className="group flex items-center gap-5 px-6 py-4 transition-colors"
                    style={{ borderBottom: idx < upcoming.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "rgb(15 23 42 / 0.022)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>

                    {/* Date chip */}
                    <div className="w-14 flex-shrink-0 text-center"
                      style={{
                        background:   isToday ? "#0B2A55" : "#F8F9FC",
                        border:       isToday ? "none" : "1px solid var(--border-subtle)",
                        borderRadius: 12, padding: "6px 0 8px",
                      }}>
                      <div className={`text-[10px] font-bold uppercase tracking-wider leading-tight ${isToday ? "text-white/60" : "text-[#0B2A55]/40"}`}>{mo}</div>
                      <div className={`text-2xl font-bold leading-none my-0.5 ${isToday ? "text-white" : "text-[#0B2A55]"}`}>{dd}</div>
                      <div className={`text-[9px] font-semibold uppercase ${isToday ? "text-white/50" : "text-gray-400"}`}>{dow}</div>
                    </div>

                    {/* Avatar + info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: aColor }}>
                        {initials(l.clientName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#0F172A] truncate">{l.clientName}</p>
                          {isToday    && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0B2A55] text-white flex-shrink-0">Today</span>}
                          {isTomorrow && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">Tomorrow</span>}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {l.address?.split(",")[0]}
                          <span className="text-gray-300">{l.address?.split(",").slice(1, 2).join(",")}</span>
                        </p>
                      </div>
                    </div>

                    {/* Service tier tags */}
                    <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                      {l.totalPrice >= 1500 && <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#FDF6EB] text-[#B5872D]">Luxury</span>}
                      {l.totalPrice >= 500  && <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#EEF2F8] text-[#0B2A55]">Photos</span>}
                      {l.totalPrice >= 1000 && <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#ECFEFF] text-[#0891B2]">Drone</span>}
                    </div>

                    {/* Price + payment */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-sm font-bold text-[#0F172A]">${l.totalPrice?.toLocaleString()}</p>
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

        {/* ── Recent Listings ──────────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <h2 className="font-semibold text-[#0F172A] text-sm">
              Recent Listings
              {isMock && <span className="ml-2 text-xs font-normal text-gray-400">(sample data)</span>}
            </h2>
            <Link href="/dashboard/listings" className="text-xs text-gray-400 hover:text-[#0B2A55] transition-colors">
              View all →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--bg-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
                  {["Property", "Client", "Shoot Date", "Status", "Payment", "Total"].map((h, i) => (
                    <th key={h} className={`text-[10.5px] font-semibold text-gray-400 uppercase tracking-[0.08em] py-3 whitespace-nowrap ${i === 0 ? "text-left px-6" : i === 5 ? "text-right px-6" : "text-left px-4"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.slice(0, 8).map((l, idx) => {
                  const pay = payLabel(l);
                  return (
                    <tr key={l.id} className="group transition-colors"
                      style={{ borderBottom: idx < Math.min(display.length, 8) - 1 ? "1px solid var(--border-subtle)" : "none" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "rgb(15 23 42 / 0.022)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <td className="px-6 py-3.5 max-w-[240px]">
                        {isMock ? (
                          <span className="font-medium text-[#0F172A] line-clamp-1 block text-[13px]">{l.address?.split(",")[0]}</span>
                        ) : (
                          <Link href={`/dashboard/listings/${l.id}`}
                            className="font-medium text-[#0F172A] group-hover:text-[#0B2A55] transition-colors line-clamp-1 block text-[13px]">
                            {l.address?.split(",")[0]}
                          </Link>
                        )}
                        <span className="text-[11px] text-gray-400">{l.address?.split(",").slice(1, 2).join(",").trim()}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                            style={{ background: avatarColor(l.clientName || "") }}>
                            {initials(l.clientName)}
                          </div>
                          <span className="text-[13px] text-gray-600 whitespace-nowrap">{l.clientName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-[12px] text-gray-400 whitespace-nowrap">
                        {l.shootDate ? new Date(l.shootDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-3.5"><StatusDot status={l.status} /></td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${pay.cls}`}>
                          {pay.label}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-bold text-[#0F172A] text-[13px] whitespace-nowrap">
                        ${l.totalPrice?.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
