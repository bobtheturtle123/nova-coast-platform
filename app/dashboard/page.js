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

const MOCK_MONTHLY = [
  { month: "Nov", revenue: 3850 },
  { month: "Dec", revenue: 5120 },
  { month: "Jan", revenue: 4290 },
  { month: "Feb", revenue: 6740 },
  { month: "Mar", revenue: 7880 },
  { month: "Apr", revenue: 5960 },
];

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
  if (l.depositPaid) return { label: "Deposit paid", cls: "bg-blue-50 text-blue-700 border-blue-200" };
  return { label: "Unpaid", cls: "bg-gray-50 text-gray-500 border-gray-200" };
}

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

// ── Revenue area chart ────────────────────────────────────────────────────────
function RevenueAreaChart({ data }) {
  const W = 700, H = 190;
  const padL = 50, padR = 16, padT = 24, padB = 38;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const max = Math.max(...data.map(d => d.revenue), 1);

  const pts = data.map((d, i) => ({
    x: padL + (data.length > 1 ? (i / (data.length - 1)) * cW : cW * 0.5),
    y: padT + cH - (d.revenue / max) * cH,
    rev: d.revenue,
    mo: d.month,
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
  const lastP = pts[pts.length - 1];
  const firstP = pts[0];
  const bottom = padT + cH;
  const areaPath = `${linePath} L ${lastP.x.toFixed(1)},${bottom} L ${firstP.x.toFixed(1)},${bottom} Z`;
  const peakIdx = data.reduce((bi, d, i) => d.revenue > data[bi].revenue ? i : bi, 0);

  const yTicks = [0.25, 0.5, 0.75, 1].map(t => ({
    y: padT + cH - t * cH,
    label: max >= 10000 ? `$${Math.round((max * t) / 1000)}k` : `$${Math.round(max * t / 100) * 100}`,
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#0B2A55" stopOpacity="0.16" />
          <stop offset="60%"  stopColor="#0B2A55" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#0B2A55" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#C9A96E" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#C9A96E" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Dashed grid */}
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

      {/* Gold accent area under last bar section */}
      {pts.length >= 2 && (
        <path
          d={`M ${pts[pts.length - 2].x.toFixed(1)},${padT + cH} L ${pts[pts.length - 2].x.toFixed(1)},${pts[pts.length - 2].y.toFixed(1)} C ${(pts[pts.length - 2].x + (pts[pts.length - 1].x - pts[pts.length - 2].x) / 3).toFixed(1)},${pts[pts.length - 2].y.toFixed(1)} ${(pts[pts.length - 1].x - (pts[pts.length - 1].x - pts[pts.length - 2].x) / 3).toFixed(1)},${pts[pts.length - 1].y.toFixed(1)} ${pts[pts.length - 1].x.toFixed(1)},${pts[pts.length - 1].y.toFixed(1)} L ${pts[pts.length - 1].x.toFixed(1)},${padT + cH} Z`}
          fill="url(#goldGrad)" opacity="0.6"
        />
      )}

      {/* Main area */}
      <path d={areaPath} fill="url(#revGrad)" />

      {/* Main line */}
      <path d={linePath} fill="none" stroke="#0B2A55" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Data points */}
      {pts.map((p, i) => (
        <g key={i}>
          {i === pts.length - 1 ? (
            <>
              <circle cx={p.x} cy={p.y} r="10" fill="#C9A96E" fillOpacity="0.15" />
              <circle cx={p.x} cy={p.y} r="5.5" fill="#0B2A55" />
              <circle cx={p.x} cy={p.y} r="2.5" fill="white" />
            </>
          ) : (
            <circle cx={p.x} cy={p.y} r="4" fill="white" stroke="#0B2A55" strokeWidth="2" />
          )}
        </g>
      ))}

      {/* Peak callout */}
      {pts[peakIdx] && peakIdx !== pts.length - 1 && (
        <g>
          <line x1={pts[peakIdx].x} y1={pts[peakIdx].y - 8} x2={pts[peakIdx].x} y2={pts[peakIdx].y - 22}
            stroke="#0B2A55" strokeWidth="1" strokeDasharray="2,2" opacity="0.4" />
          <rect x={pts[peakIdx].x - 28} y={pts[peakIdx].y - 38} width={56} height={18} rx={5}
            fill="#0B2A55" />
          <text x={pts[peakIdx].x} y={pts[peakIdx].y - 25} textAnchor="middle" fontSize="10.5"
            fill="white" fontFamily="system-ui,-apple-system" fontWeight="700">
            ${(data[peakIdx].revenue / 1000).toFixed(1)}k
          </text>
        </g>
      )}

      {/* Current month callout */}
      {lastP && (
        <g>
          <line x1={lastP.x} y1={lastP.y - 12} x2={lastP.x} y2={lastP.y - 28}
            stroke="#C9A96E" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.7" />
          <rect x={lastP.x - 30} y={lastP.y - 46} width={60} height={20} rx={5}
            fill="#C9A96E" />
          <text x={lastP.x} y={lastP.y - 31} textAnchor="middle" fontSize="11"
            fill="white" fontFamily="system-ui,-apple-system" fontWeight="700">
            ${(data[data.length - 1].revenue / 1000).toFixed(1)}k
          </text>
        </g>
      )}

      {/* X labels */}
      {pts.map((p, i) => (
        <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="11"
          fill={i === pts.length - 1 ? "#C9A96E" : "#A0AEC0"}
          fontWeight={i === pts.length - 1 ? "700" : "400"}
          fontFamily="system-ui,-apple-system,sans-serif">
          {p.mo}
        </text>
      ))}
    </svg>
  );
}

// ── Quick action tile ─────────────────────────────────────────────────────────
function QuickTile({ label, sub, href, icon, bg, color }) {
  return (
    <Link href={href}
      className="group relative overflow-hidden rounded-2xl p-4 flex items-center gap-3.5 transition-all duration-200"
      style={{ background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.09)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"; }}>
      <div className="w-10 h-10 rounded-[11px] flex items-center justify-center flex-shrink-0"
        style={{ background: bg }}>
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2">
          {icon}
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
        <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>
      </div>
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#CBD5E1" strokeWidth="2"
        className="flex-shrink-0 group-hover:stroke-gray-400 transition-colors">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}

// ── Copy booking link button ──────────────────────────────────────────────────
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

  const monthlyData = useMemo(() => {
    if (isMock) return MOCK_MONTHLY;
    const byMonth = {};
    listings.forEach(l => {
      if (!l.shootDate) return;
      const d = new Date(l.shootDate + "T12:00:00");
      const k = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const mo = d.toLocaleDateString("en-US", { month: "short" });
      if (!byMonth[k]) byMonth[k] = { month: mo, revenue: 0, sort: k };
      byMonth[k].revenue += (l.paidInFull || l.balancePaid) ? (l.totalPrice || 0) : l.depositPaid ? (l.depositAmount || 0) : 0;
    });
    const result = Object.values(byMonth).sort((a, b) => a.sort.localeCompare(b.sort)).slice(-6);
    return result.length >= 2 ? result : MOCK_MONTHLY;
  }, [listings, isMock]);

  const actionItems = display.filter(l => l.status === "requested" || l.status === "pending_payment").slice(0, 6);
  const upcoming    = display.filter(l => l.status === "confirmed").sort((a, b) => (a.shootDate || "").localeCompare(b.shootDate || "")).slice(0, 5);

  const bookingUrl = tenant
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${tenant.slug}/book`
    : "";

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

  const today     = new Date();
  const hour      = today.getHours();
  const greeting  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const bizName   = tenant?.businessName || "";
  const firstName = bizName.split(" ")[0] || "there";
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const totalRevenue6mo = monthlyData.reduce((s, m) => s + m.revenue, 0);

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
            icon={<><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></>}
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

        {/* ── Main content row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">

          {/* Left: Revenue chart */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div className="px-6 pt-6 pb-3 flex items-start justify-between gap-4"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <div>
                <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-[0.09em] mb-1">6-Month Revenue</p>
                <p className="text-[32px] font-bold text-[#0F172A] leading-none tracking-tight">
                  ${totalRevenue6mo.toLocaleString()}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {monthlyData[0]?.month} – {monthlyData[monthlyData.length - 1]?.month}
                  {isMock && <span className="ml-2 text-gray-300 italic">sample</span>}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                {monthlyData.length >= 2 && (() => {
                  const prev = monthlyData[monthlyData.length - 2]?.revenue || 1;
                  const curr = monthlyData[monthlyData.length - 1]?.revenue || 0;
                  const pct  = Math.round(((curr - prev) / prev) * 100);
                  const up   = pct >= 0;
                  return (
                    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                      {up ? "↑" : "↓"} {Math.abs(pct)}% vs prev
                    </span>
                  );
                })()}
                <Link href="/dashboard/reports"
                  className="text-xs text-gray-400 hover:text-[#0B2A55] transition-colors">
                  Full report →
                </Link>
              </div>
            </div>
            <div className="px-4 pt-4 pb-3">
              <RevenueAreaChart data={monthlyData} />
            </div>
          </div>

          {/* Right column: Action Required + Quick Actions */}
          <div className="flex flex-col gap-4">

            {/* Action Required */}
            <div className="rounded-2xl overflow-hidden flex-1"
              style={{ background: "#fff", border: "1px solid var(--border-subtle)", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: actionItems.length > 0 ? "#FFF8ED" : "#ECFDF5" }}>
                    {actionItems.length > 0 ? (
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#D97706" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <h2 className="font-semibold text-[#0F172A] text-sm">Action Required</h2>
                </div>
                {actionItems.length > 0 && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: "#FFF8ED", color: "#B45309" }}>
                    {actionItems.length} pending
                  </span>
                )}
              </div>

              {actionItems.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)" }}>
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[#0F172A]">All caught up</p>
                  <p className="text-xs text-gray-400 mt-0.5">No pending actions.</p>
                </div>
              ) : (
                <div>
                  {actionItems.map((l, idx) => {
                    const isRequested = l.status === "requested";
                    const accentColor = isRequested ? "#D97706" : "#EA580C";
                    const accentBg    = isRequested ? "#FFF8ED" : "#FFF4ED";
                    const pay         = payLabel(l);
                    return (
                      <Link key={l.id}
                        href={isMock ? "/dashboard/listings" : `/dashboard/listings/${l.id}`}
                        className="group flex items-start gap-3 px-5 py-3.5 relative transition-colors"
                        style={{ borderBottom: idx < actionItems.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgb(15 23 42 / 0.022)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                        {/* Left accent bar */}
                        <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full"
                          style={{ background: accentColor }} />
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: accentBg }}>
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={accentColor} strokeWidth="2.5">
                            {isRequested
                              ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              : <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            }
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#0F172A] truncate leading-tight">{l.address?.split(",")[0]}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5 truncate">{l.clientName} · {l.address?.split(",").slice(1, 2).join("").trim()}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                              style={{ background: accentBg, color: accentColor }}>
                              {isRequested ? "Review booking" : "Awaiting payment"}
                            </span>
                            <span className="text-[10.5px] font-semibold text-gray-500">
                              ${l.totalPrice?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#CBD5E1" strokeWidth="2"
                          className="flex-shrink-0 mt-1.5 group-hover:stroke-gray-400 transition-colors">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="space-y-2">
              <p className="text-[10.5px] font-semibold text-gray-400 uppercase tracking-[0.09em] px-0.5">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                <QuickTile
                  label="New Listing"
                  sub="Create booking"
                  href="/dashboard/listings/new"
                  bg="#EEF2F8"
                  color="#0B2A55"
                  icon={<path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
                />
                <QuickTile
                  label="Add Service"
                  sub="Update catalog"
                  href="/dashboard/products"
                  bg="#FDF6EB"
                  color="#B5872D"
                  icon={<path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />}
                />
                <QuickTile
                  label="Invite Photog"
                  sub="Grow your team"
                  href="/dashboard/team"
                  bg="#ECFDF5"
                  color="#059669"
                  icon={<path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />}
                />
                <QuickTile
                  label="Settings"
                  sub="Configure account"
                  href="/dashboard/settings"
                  bg="#F5F3FF"
                  color="#7C3AED"
                  icon={<><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>}
                />
              </div>
            </div>
          </div>
        </div>

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
              {bookingUrl && (
                <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs font-semibold text-[#0B2A55] hover:underline">
                  Share booking page →
                </a>
              )}
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
                const isToday = date && date.toDateString() === new Date().toDateString();
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
                        background: isToday ? "#0B2A55" : "#F8F9FC",
                        border: isToday ? "none" : "1px solid var(--border-subtle)",
                        borderRadius: 12, padding: "6px 0 8px"
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
                          {isToday && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0B2A55] text-white flex-shrink-0">Today</span>
                          )}
                          {isTomorrow && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex-shrink-0">Tomorrow</span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {l.address?.split(",")[0]}
                          <span className="text-gray-300">{l.address?.split(",").slice(1, 2).join(",")}</span>
                        </p>
                      </div>
                    </div>

                    {/* Service tier indicator */}
                    <div className="hidden md:flex items-center gap-1.5 flex-shrink-0">
                      {l.totalPrice >= 1500 && (
                        <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#FDF6EB] text-[#B5872D]">Luxury</span>
                      )}
                      {l.totalPrice >= 500 && (
                        <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#EEF2F8] text-[#0B2A55]">Photos</span>
                      )}
                      {l.totalPrice >= 1000 && (
                        <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-[#ECFEFF] text-[#0891B2]">Drone</span>
                      )}
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

        {/* ── Recent Listings table ────────────────────────────────────────── */}
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
                  {["Property","Client","Shoot Date","Status","Payment","Total"].map((h, i) => (
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
