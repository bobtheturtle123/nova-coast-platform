"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import WorkflowStatusBadge from "@/components/WorkflowStatusBadge";
import { resolveWorkflowStatus } from "@/lib/workflowStatus";
import { getAppUrl } from "@/lib/appUrl";
import TimeRangePicker from "@/components/TimeRangePicker";

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
  "7d": [
    { label: "Apr 29", revenue: 549,  bookings: 1 },
    { label: "Apr 30", revenue: 0,    bookings: 0 },
    { label: "May 1",  revenue: 875,  bookings: 1 },
    { label: "May 2",  revenue: 1199, bookings: 1 },
    { label: "May 3",  revenue: 0,    bookings: 0 },
    { label: "May 4",  revenue: 0,    bookings: 0 },
    { label: "May 5",  revenue: 299,  bookings: 1 },
  ],
  "30d": [
    { label: "Apr 1",  revenue: 980,  bookings: 2 },
    { label: "Apr 8",  revenue: 1420, bookings: 3 },
    { label: "Apr 15", revenue: 890,  bookings: 2 },
    { label: "Apr 22", revenue: 1650, bookings: 4 },
    { label: "Apr 28", revenue: 1020, bookings: 2 },
  ],
  "3m": [
    { label: "Mar", revenue: 7880, bookings: 13 },
    { label: "Apr", revenue: 5960, bookings: 9  },
    { label: "May", revenue: 2920, bookings: 4  },
  ],
  "6m": [
    { label: "Dec", revenue: 5120, bookings: 9  },
    { label: "Jan", revenue: 4290, bookings: 7  },
    { label: "Feb", revenue: 6740, bookings: 11 },
    { label: "Mar", revenue: 7880, bookings: 13 },
    { label: "Apr", revenue: 5960, bookings: 9  },
    { label: "May", revenue: 2920, bookings: 4  },
  ],
  "12m": [
    { label: "Jun '25", revenue: 3400, bookings: 6  },
    { label: "Jul",     revenue: 4800, bookings: 8  },
    { label: "Aug",     revenue: 5600, bookings: 9  },
    { label: "Sep",     revenue: 3900, bookings: 6  },
    { label: "Oct",     revenue: 4200, bookings: 7  },
    { label: "Nov",     revenue: 3850, bookings: 6  },
    { label: "Dec",     revenue: 5120, bookings: 9  },
    { label: "Jan '26", revenue: 4290, bookings: 7  },
    { label: "Feb",     revenue: 6740, bookings: 11 },
    { label: "Mar",     revenue: 7880, bookings: 13 },
    { label: "Apr",     revenue: 5960, bookings: 9  },
    { label: "May",     revenue: 2920, bookings: 4  },
  ],
  "all": [
    { label: "Jan '25", revenue: 1200, bookings: 2  },
    { label: "Feb",     revenue: 2100, bookings: 3  },
    { label: "Mar",     revenue: 3200, bookings: 5  },
    { label: "Apr",     revenue: 2800, bookings: 4  },
    { label: "May",     revenue: 3100, bookings: 5  },
    { label: "Jun",     revenue: 3400, bookings: 6  },
    { label: "Jul",     revenue: 4800, bookings: 8  },
    { label: "Aug",     revenue: 5600, bookings: 9  },
    { label: "Sep",     revenue: 3900, bookings: 6  },
    { label: "Oct",     revenue: 4200, bookings: 7  },
    { label: "Nov",     revenue: 3850, bookings: 6  },
    { label: "Dec",     revenue: 5120, bookings: 9  },
    { label: "Jan '26", revenue: 4290, bookings: 7  },
    { label: "Feb",     revenue: 6740, bookings: 11 },
    { label: "Mar",     revenue: 7880, bookings: 13 },
    { label: "Apr",     revenue: 5960, bookings: 9  },
    { label: "May",     revenue: 2920, bookings: 4  },
  ],
};


// ── Helpers ───────────────────────────────────────────────────────────────────
function avatarColor(str) {
  const p = ["#3486cf","#1e6091","#2e7d32","#6a1b9a","#d84315","#00695c","#b5872d","#c0392b"];
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}

function initials(name) {
  return (name || "?").split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function payLabel(l) {
  if (l.paidInFull || l.balancePaid) return { label: "Paid in full", color: "#059669", bg: "#ECFDF5" };
  if (l.depositPaid)                 return { label: "Deposit paid",  color: "#3486cf", bg: "#E8F2FD" };
  return                                    { label: "Unpaid",        color: "#9CA3AF", bg: "#F9FAFB" };
}

function buildChartData(listings, period, metric) {
  const now = new Date();
  const buckets = {};

  if (period === "7d" || period === "30d") {
    const days   = period === "7d" ? 7 : 30;
    const weeks  = period === "7d" ? 1 : 4;
    const step   = period === "7d" ? 1 : 7;
    const count  = period === "7d" ? 7 : 5;
    for (let i = count - 1; i >= 0; i--) {
      const anchor = new Date(now);
      anchor.setDate(anchor.getDate() - i * step);
      const key = `B${count - 1 - i}`;
      buckets[key] = {
        label: anchor.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: 0, bookings: 0, sort: count - 1 - i,
      };
    }
    listings.forEach((l) => {
      if (!l.shootDate) return;
      const d = new Date(l.shootDate + "T12:00:00");
      const daysAgo = Math.floor((now - d) / 86400000);
      if (daysAgo < 0 || daysAgo >= days) return;
      const bucket = Math.min(count - 1, Math.floor(daysAgo / step));
      const key = `B${count - 1 - bucket}`;
      if (!buckets[key]) return;
      buckets[key].bookings += 1;
      buckets[key].revenue += (l.paidInFull || l.balancePaid) ? (l.totalPrice || 0) : l.depositPaid ? (l.depositAmount || 0) : 0;
    });
  } else if (period === "all") {
    listings.forEach((l) => {
      if (!l.shootDate) return;
      const d = new Date(l.shootDate + "T12:00:00");
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      if (!buckets[key]) {
        buckets[key] = { label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), revenue: 0, bookings: 0, sort: d.getTime() };
      }
      buckets[key].bookings += 1;
      buckets[key].revenue += (l.paidInFull || l.balancePaid) ? (l.totalPrice || 0) : l.depositPaid ? (l.depositAmount || 0) : 0;
    });
  } else {
    const months = period === "12m" ? 12 : period === "3m" ? 3 : 6;
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

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, badge, icon, iconBg, href }) {
  const Inner = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: iconBg || "#EBF5FF" }}>
              {icon}
            </div>
          )}
          <p className="text-[12px] font-semibold uppercase tracking-[0.07em]" style={{ color: "#6B7280" }}>{label}</p>
        </div>
        {badge != null && badge > 0 && (
          <span className="text-[10px] font-bold w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
            {badge}
          </span>
        )}
      </div>
      <p className="text-[32px] font-bold leading-none tracking-tight" style={{ color: "#0F172A" }}>{value}</p>
      {sub && <p className="text-[12.5px] mt-2 leading-snug" style={{ color: "#6B7280" }}>{sub}</p>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="block bg-white rounded-xl p-6 transition-shadow hover:shadow-md"
        style={{ border: "1px solid #E9ECF0" }}>
        <Inner />
      </Link>
    );
  }
  return (
    <div className="bg-white rounded-xl p-6" style={{ border: "1px solid #E9ECF0" }}>
      <Inner />
    </div>
  );
}

// ── Area chart ────────────────────────────────────────────────────────────────
function AreaChart({ data, formatY }) {
  const W = 820, H = 200;
  const padL = 48, padR = 16, padT = 20, padB = 36;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const max = Math.max(...data.map(d => d.value), 1);
  const accent = "#3486cf";

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
  const bottom   = padT + cH;
  const lastP    = pts[pts.length - 1];
  const firstP   = pts[0];
  const areaPath = `${linePath} L ${lastP.x.toFixed(1)},${bottom} L ${firstP.x.toFixed(1)},${bottom} Z`;

  const yTicks = [0.25, 0.5, 0.75, 1].map(t => ({
    y: padT + cH - t * cH,
    label: formatY(Math.round(max * t)),
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={accent} stopOpacity="0.10" />
          <stop offset="100%" stopColor={accent} stopOpacity="0"    />
        </linearGradient>
      </defs>

      {yTicks.map((t, i) => (
        <line key={i} x1={padL} y1={t.y} x2={W - padR} y2={t.y}
          stroke="#F0F1F3" strokeWidth="1" />
      ))}
      {yTicks.map((t, i) => (
        <text key={i} x={padL - 8} y={t.y + 4} textAnchor="end" fontSize="11"
          fill="#9CA3AF" fontFamily="system-ui,sans-serif">{t.label}</text>
      ))}

      <path d={areaPath} fill="url(#chartGrad)" />
      <path d={linePath} fill="none" stroke={accent} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />

      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 4 : 3}
          fill="white" stroke={accent} strokeWidth={i === pts.length - 1 ? 2.5 : 1.5} />
      ))}

      {lastP && (
        <g>
          <rect x={lastP.x - 28} y={lastP.y - 34} width={56} height={18} rx={5}
            fill={accent} />
          <text x={lastP.x} y={lastP.y - 21} textAnchor="middle" fontSize="11.5"
            fill="white" fontFamily="system-ui,sans-serif" fontWeight="600">
            {formatY(data[data.length - 1].value)}
          </text>
        </g>
      )}

      {pts.map((p, i) => (
        <text key={i} x={p.x} y={H - 2} textAnchor="middle" fontSize="11.5"
          fill={i === pts.length - 1 ? accent : "#9CA3AF"}
          fontWeight={i === pts.length - 1 ? "600" : "400"}
          fontFamily="system-ui,sans-serif">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

// ── Revenue section ───────────────────────────────────────────────────────────
function RevenueSection({ listings, isMock }) {
  const [period, setPeriod] = useState("6m");
  const [metric, setMetric] = useState("revenue");

  const chartData = useMemo(() => {
    if (isMock) {
      return MOCK_DATA[period].map(d => ({ label: d.label, value: metric === "revenue" ? d.revenue : d.bookings }));
    }
    return buildChartData(listings, period, metric);
  }, [period, metric, listings, isMock]);

  const total  = chartData.reduce((s, d) => s + d.value, 0);
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
    : (v) => String(v);

  const displayTotal = metric === "revenue" ? `$${total.toLocaleString()}` : total.toLocaleString();
  const periodLabel  = { "7d": "7 days", "30d": "30 days", "3m": "3 months", "6m": "6 months", "12m": "12 months", "all": "All time" }[period] || period;

  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #E9ECF0" }}>
      <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-6" style={{ borderBottom: "1px solid #E9ECF0" }}>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.07em] mb-1.5" style={{ color: "#6B7280" }}>
            {periodLabel} · {metric === "revenue" ? "Revenue" : "Bookings"}
            {isMock && <span className="ml-2 font-normal normal-case tracking-normal text-gray-300 italic">sample</span>}
          </p>
          <p className="text-[32px] font-bold leading-none tracking-tight mb-2" style={{ color: "#0F172A" }}>{displayTotal}</p>
          <div className="flex items-center gap-3">
            {change && (
              <span className={`inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-0.5 rounded-md ${change.up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {change.up ? "↑" : "↓"} {Math.abs(change.pct)}% vs prev
              </span>
            )}
            <Link href="/dashboard/reports" className="text-[11.5px] text-gray-400 hover:text-[#374151] transition-colors">
              Full report →
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <TimeRangePicker value={period} onChange={setPeriod} />
          <div className="flex items-center rounded-lg overflow-hidden" style={{ border: "1px solid #E9ECF0" }}>
            {[{ id: "revenue", label: "Revenue" }, { id: "bookings", label: "Bookings" }].map(m => (
              <button key={m.id} onClick={() => setMetric(m.id)}
                className="px-3 py-1.5 text-[12.5px] font-semibold transition-colors"
                style={metric === m.id
                  ? { background: "#EEF5FC", color: "#1E5A8A", borderBottom: "2px solid #3486cf" }
                  : { color: "#9CA3AF", background: "#fff" }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-3">
        <AreaChart data={chartData} formatY={formatY} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardHome() {
  const [listings,         setListings]         = useState([]);
  const [tenant,           setTenant]           = useState(null);
  const [hasProducts,      setHasProducts]      = useState(false);
  const [pendingRevisions, setPendingRevisions] = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [linkCopied,       setLinkCopied]       = useState(false);

  useEffect(() => {
    auth.currentUser?.getIdToken(true).then(async (token) => {
      const h = { Authorization: `Bearer ${token}` };
      const [listRes, tenantRes, svcRes, pkgRes, revRes] = await Promise.all([
        fetch("/api/dashboard/listings",               { headers: h }),
        fetch("/api/dashboard/tenant",                 { headers: h }),
        fetch("/api/dashboard/products?type=services", { headers: h }),
        fetch("/api/dashboard/products?type=packages", { headers: h }),
        fetch("/api/dashboard/revisions?status=pending", { headers: h }),
      ]);
      if (listRes.ok)   { const d = await listRes.json();   setListings(d.listings || []); }
      if (tenantRes.ok) { const d = await tenantRes.json(); setTenant(d.tenant); }
      if (revRes.ok)    { const d = await revRes.json();    setPendingRevisions(d.revisions || []); }
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

  const ACTIVE_WF = ["booked","appointment_confirmed","photographer_assigned","shot_completed","editing_complete","qa_review","postponed"];
  const upcoming = display
    .filter(l => ACTIVE_WF.includes(resolveWorkflowStatus(l)) && (l.shootDate || l.preferredDate))
    .sort((a, b) => (a.shootDate || a.preferredDate || "").localeCompare(b.shootDate || b.preferredDate || ""))
    .slice(0, 5);

  // Action required items
  const actionItems = isMock ? [] : [
    ...pendingRevisions.map(r => ({
      type: "revision_request", id: r.id,
      label: r.agentName || r.agentEmail || "Client",
      detail: r.message ? (r.message.length > 55 ? r.message.slice(0, 55) + "…" : r.message) : "Revision requested",
      href: r.bookingId ? `/dashboard/listings/${r.bookingId}` : `/dashboard/revisions`,
      urgency: "high",
    })),
    ...display.filter(l => l.status === "requested" && !l.depositPaid)
      .map(l => ({ type: "booking_request", id: l.id, label: l.clientName, detail: l.address?.split(",")[0], href: `/dashboard/listings/${l.id}`, urgency: "high" })),
    ...display.filter(l => (l.paidInFull || l.balancePaid ? false : l.depositPaid) && !l.balancePaid && resolveWorkflowStatus(l) === "delivered")
      .map(l => ({ type: "balance_due",     id: l.id, label: l.clientName, detail: `Balance $${((l.totalPrice || 0) - (l.depositAmount || 0)).toLocaleString()}`, href: `/dashboard/listings/${l.id}`, urgency: "medium" })),
    ...display.filter(l => ACTIVE_WF.includes(resolveWorkflowStatus(l)) && !l.shootDate && !l.preferredDate)
      .map(l => ({ type: "no_date",         id: l.id, label: l.clientName, detail: l.address?.split(",")[0], href: `/dashboard/listings/${l.id}`, urgency: "medium" })),
  ].slice(0, 8);

  const setupSteps = tenant ? [
    { done: !!tenant.phone,                                                                label: "Complete your profile",   href: "/onboarding" },
    { done: !!(tenant.branding?.primaryColor && tenant.branding?.businessName),            label: "Configure branding",      href: "/dashboard/settings#settings-branding" },
    { done: !!(tenant.bookingConfig || tenant.pricingConfig || tenant.availabilityConfig), label: "Review booking settings", href: "/dashboard/settings" },
    { done: !!tenant.stripeConnectOnboarded,                                               label: "Connect Stripe",          href: "/dashboard/billing" },
    { done: hasProducts,                                                                   label: "Add services or packages", href: "/dashboard/products" },
    { done: listings.length > 0,                                                           label: "Receive your first booking", href: null },
  ] : [];
  const doneCount     = setupSteps.filter(s => s.done).length;
  const setupComplete = doneCount === setupSteps.length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-[#1B4BB8] rounded-full animate-spin" />
    </div>
  );

  const today    = new Date();
  const hour     = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const bizName  = tenant?.businessName || "";
  const firstName = bizName.split(" ")[0] || "";
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const bookingUrl = tenant
    ? `${getAppUrl()}/${tenant.slug}/book`
    : "";

  function copyLink() {
    if (!bookingUrl) return;
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1500);
    });
  }

  return (
    <div className="min-h-screen" style={{ background: "#F7F8FA" }}>
      <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">

        {/* ── Stripe banner ────────────────────────────────────────────── */}
        {tenant && !tenant.stripeConnectOnboarded && setupComplete && (
          <div className="rounded-xl px-5 py-3.5 flex items-center justify-between gap-4 bg-white"
            style={{ border: "1px solid #FDE68A" }}>
            <div className="flex items-center gap-3">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#D97706" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-800">Connect Stripe to accept payments</p>
                <p className="text-xs text-gray-400 mt-0.5">Deposits won't be collected until Stripe Connect is active.</p>
              </div>
            </div>
            <Link href="/dashboard/billing"
              className="flex-shrink-0 text-xs font-semibold text-amber-700 border border-amber-200 bg-amber-50 px-3.5 py-2 rounded-lg hover:bg-amber-100 transition-colors whitespace-nowrap">
              Connect Stripe →
            </Link>
          </div>
        )}

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight" style={{ color: "#0F172A" }}>
              {greeting}{firstName ? `, ${firstName}` : ""}
              {isMock && <span className="ml-2 text-sm font-normal" style={{ color: "#9CA3AF" }}>· sample data</span>}
            </h1>
            <p className="text-[13.5px] mt-1 flex items-center gap-1.5" style={{ color: "#6B7280" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 inline-block" style={{ background: "#9CA3AF" }} />
              {dateLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {bookingUrl && (
              <button onClick={copyLink}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-lg transition-colors"
                style={{ border: "1px solid #E9ECF0", background: "#fff", color: "#475569" }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "#C7D2E8"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#E9ECF0"}>
                {linkCopied ? "✓ Copied" : "Copy Booking Link"}
              </button>
            )}
            {bookingUrl && (
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-lg transition-colors"
                style={{ border: "1px solid #E9ECF0", background: "#fff", color: "#475569" }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = "#C7D2E8"}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = "#E9ECF0"}>
                Booking Page ↗
              </a>
            )}
            <Link href="/dashboard/bookings/create"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white px-4 py-2 rounded-lg transition-colors"
              style={{ background: "#3486cf" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#2a6dab"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#3486cf"}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Listing
            </Link>
          </div>
        </div>

        {/* ── Setup checklist ───────────────────────────────────────────── */}
        {tenant && !setupComplete && (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #E9ECF0" }}>
            <div className="px-6 py-4 flex items-center gap-4" style={{ borderBottom: "1px solid #E9ECF0" }}>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-semibold" style={{ color: "#0F172A" }}>Get your workspace ready</h3>
                <p className="text-[12.5px] mt-0.5" style={{ color: "#6B7280" }}>{doneCount} of {setupSteps.length} steps complete</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#93C4E6] transition-all duration-500"
                    style={{ width: `${Math.round((doneCount / setupSteps.length) * 100)}%` }} />
                </div>
                <Link href="/onboarding"
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap">
                  Continue setup →
                </Link>
              </div>
            </div>
            <div>
              {setupSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-3.5"
                  style={{ borderBottom: i < setupSteps.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all ${
                    step.done ? "bg-[#93C4E6]" : "border-2 border-gray-200"
                  }`}>
                    {step.done && (
                      <svg width="10" height="10" fill="none" viewBox="0 0 12 12">
                        <path d="M2.5 6L5 8.5 9.5 3.5" stroke="white" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className={`text-[14px] flex-1 ${step.done ? "line-through decoration-gray-300" : ""}`} style={{ color: step.done ? "#9CA3AF" : "#374151" }}>
                    {step.label}
                  </span>
                  {!step.done && step.href && (
                    <Link href={step.href}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">
                      Set up →
                    </Link>
                  )}
                  {step.done && <span className="text-[11px] text-gray-300 font-medium">Done</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <StatCard label="Total Listings" value={stats.total} sub="all time"
            href="/dashboard/listings"
            iconBg="#F0F7FD"
            icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#6BAED0" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>}
          />
          <StatCard label="Pending Review" value={stats.pending} sub={stats.pending > 0 ? "need your action" : "all clear"} badge={stats.pending}
            href="/dashboard/listings"
            iconBg="#FEF3C7"
            icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#D97706" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          />
          <StatCard label="Active Shoots" value={stats.confirmed} sub="confirmed"
            href="/dashboard/listings"
            iconBg="#F0F7FD"
            icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#6BAED0" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
          />
          <StatCard label="Revenue Collected" value={`$${stats.revenue.toLocaleString()}`} sub="deposits + paid"
            href="/dashboard/reports"
            iconBg="#ECFDF5"
            icon={<svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
          />
        </div>

        {/* ── Action Required ───────────────────────────────────────────── */}
        {actionItems.length > 0 && (
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #FEE2E2" }}>
            <div className="px-6 py-3.5 flex items-center gap-3" style={{ borderBottom: "1px solid #FEF2F2", background: "#FFF5F5" }}>
              <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#DC2626" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h2 className="text-[14px] font-semibold text-red-700">Action Required</h2>
              <span className="text-[11px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{actionItems.length}</span>
            </div>
            <div>
              {actionItems.map((item, idx) => {
                const typeLabel = item.type === "revision_request" ? "Revision request"
                  : item.type === "booking_request" ? "New booking request"
                  : item.type === "balance_due"     ? "Balance due"
                  : "No shoot date scheduled";
                const dotColor = item.urgency === "high" ? "#DC2626" : "#D97706";
                return (
                  <Link key={`${item.type}-${item.id}`}
                    href={item.href}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50 transition-colors group"
                    style={{ borderBottom: idx < actionItems.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-medium text-gray-800 truncate">{item.label}</p>
                      <p className="text-[12px] text-gray-400 truncate">{item.detail}</p>
                    </div>
                    <span className="text-[11.5px] font-medium text-gray-400 flex-shrink-0">{typeLabel}</span>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#D1D5DB" strokeWidth="2"
                      className="flex-shrink-0 group-hover:stroke-[#9CA3AF] transition-colors">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Revenue chart ─────────────────────────────────────────────── */}
        <RevenueSection listings={display} isMock={isMock} />

        {/* ── Upcoming Shoots ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #E9ECF0" }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #E9ECF0" }}>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "#F2F7FB" }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#8BBAD4" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </div>
                <h2 className="text-[15px] font-semibold" style={{ color: "#0F172A" }}>Upcoming Shoots</h2>
              </div>
              {upcoming.length > 0 && (
                <span className="text-[12px] bg-gray-100 px-2 py-0.5 rounded-full" style={{ color: "#6B7280" }}>
                  {upcoming.length} confirmed
                </span>
              )}
            </div>
            <Link href="/dashboard/listings" className="text-[12.5px] hover:text-[#374151] transition-colors" style={{ color: "#6B7280" }}>
              View all →
            </Link>
          </div>

          {upcoming.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center bg-gray-50"
                style={{ border: "1px solid #E9ECF0" }}>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500">No confirmed shoots yet</p>
              <p className="text-xs text-gray-400 mt-1">Confirmed bookings will appear here.</p>
            </div>
          ) : (
            <div>
              {upcoming.map((l, idx) => {
                const date  = l.shootDate ? new Date(l.shootDate + "T12:00:00") : null;
                const mo    = date ? date.toLocaleDateString("en-US", { month: "short" }).toUpperCase() : "--";
                const dd    = date ? date.getDate() : "--";
                const dow   = date ? date.toLocaleDateString("en-US", { weekday: "short" }) : "";
                const isToday    = date && date.toDateString() === new Date().toDateString();
                const isTomorrow = date && (() => { const t = new Date(); t.setDate(t.getDate() + 1); return date.toDateString() === t.toDateString(); })();
                const pay   = payLabel(l);

                return (
                  <Link key={l.id}
                    href={isMock ? "/dashboard/listings" : `/dashboard/listings/${l.id}`}
                    className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-gray-50"
                    style={{ borderBottom: idx < upcoming.length - 1 ? "1px solid #F3F4F6" : "none" }}>

                    {/* Date block */}
                    <div className="w-11 flex-shrink-0 text-center rounded-xl py-1.5"
                      style={{
                        background: isToday ? "#3486cf" : "#F3F4F6",
                        border: isToday ? "none" : "1px solid #E5E7EB",
                      }}>
                      <div className="text-[9px] font-semibold uppercase tracking-wide leading-tight" style={{ color: isToday ? "rgba(255,255,255,0.75)" : "#9CA3AF" }}>{mo}</div>
                      <div className="text-[20px] font-bold leading-none my-0.5" style={{ color: isToday ? "#fff" : "#0F172A" }}>{dd}</div>
                      <div className="text-[9px] font-medium uppercase" style={{ color: isToday ? "rgba(255,255,255,0.6)" : "#9CA3AF" }}>{dow}</div>
                    </div>

                    {/* Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: avatarColor(l.clientName || "") }}>
                        {initials(l.clientName)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[14.5px] font-medium truncate" style={{ color: "#0F172A" }}>{l.clientName}</p>
                          {isToday    && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: "#EEF4FA", color: "#1E5A8A" }}>Today</span>}
                          {isTomorrow && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 flex-shrink-0">Tomorrow</span>}
                        </div>
                        <p className="text-[12.5px] truncate mt-0.5" style={{ color: "#6B7280" }}>{l.address?.split(",")[0]}</p>
                        {(l.shootTime || l.photographerName) && (
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {l.shootTime && (
                              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2"/>
                                </svg>
                                {l.shootTime}
                              </span>
                            )}
                            {l.photographerName && (
                              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                                </svg>
                                {l.photographerName}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Price + payment */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-[14.5px] font-semibold" style={{ color: "#0F172A" }}>${l.totalPrice?.toLocaleString()}</p>
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md"
                        style={{ color: pay.color, background: pay.bg }}>
                        {pay.label}
                      </span>
                    </div>

                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24"
                      stroke="#D1D5DB" strokeWidth="2"
                      className="flex-shrink-0 group-hover:stroke-[#9CA3AF] transition-colors">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Recent Listings ───────────────────────────────────────────── */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #E9ECF0" }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #E9ECF0" }}>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: "#F2F7FB" }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#8BBAD4" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                </div>
                <h2 className="text-[15px] font-semibold" style={{ color: "#0F172A" }}>Recent Listings</h2>
              </div>
              {isMock && <span className="text-[12px] bg-gray-100 px-2 py-0.5 rounded-full" style={{ color: "#6B7280" }}>sample</span>}
            </div>
            <Link href="/dashboard/listings" className="text-[12.5px] hover:text-[#374151] transition-colors" style={{ color: "#6B7280" }}>
              View all →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#FAFAFA", borderBottom: "1px solid #E9ECF0" }}>
                  {["Property", "Client", "Shoot Date", "Status", "Payment", "Total"].map((h, i) => (
                    <th key={h}
                      className={`text-[11.5px] font-semibold uppercase tracking-[0.07em] py-3 whitespace-nowrap ${
                        i === 0 ? "text-left px-6" : i === 5 ? "text-right px-6" : "text-left px-4"
                      }`} style={{ color: "#6B7280" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.slice(0, 8).map((l, idx) => {
                  const pay = payLabel(l);
                  return (
                    <tr key={l.id} className="group transition-colors hover:bg-gray-50"
                      style={{ borderBottom: idx < Math.min(display.length, 8) - 1 ? "1px solid #F3F4F6" : "none" }}>
                      <td className="px-6 py-4 max-w-[220px]">
                        {isMock ? (
                          <span className="font-medium line-clamp-1 block text-[14px]" style={{ color: "#0F172A" }}>{l.address?.split(",")[0]}</span>
                        ) : (
                          <Link href={`/dashboard/listings/${l.id}`}
                            className="font-medium group-hover:text-[#374151] transition-colors line-clamp-1 block text-[14px]" style={{ color: "#0F172A" }}>
                            {l.address?.split(",")[0]}
                          </Link>
                        )}
                        <span className="text-[12px]" style={{ color: "#6B7280" }}>{l.address?.split(",").slice(1, 2).join(",").trim()}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                            style={{ background: avatarColor(l.clientName || "") }}>
                            {initials(l.clientName)}
                          </div>
                          <span className="text-[14px] whitespace-nowrap" style={{ color: "#475569" }}>{l.clientName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[13px] whitespace-nowrap" style={{ color: "#6B7280" }}>
                        {l.shootDate ? new Date(l.shootDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-4 py-4"><WorkflowStatusBadge status={resolveWorkflowStatus(l)} size="xs" /></td>
                      <td className="px-4 py-4">
                        <span className="text-[12px] font-medium px-1.5 py-0.5 rounded-md"
                          style={{ color: pay.color, background: pay.bg }}>
                          {pay.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-[14px] whitespace-nowrap" style={{ color: "#0F172A" }}>
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
