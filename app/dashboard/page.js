"use client";

import { useEffect, useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import Link from "next/link";

// ── Mock data (displayed when no real listings exist) ─────────────────────────
const MOCK_LISTINGS = [
  { id: "m1", address: "4821 Ocean View Dr, La Jolla, CA",          clientName: "Sarah Mitchell", status: "confirmed",       totalPrice: 1199, depositAmount: 599,  depositPaid: true,  paidInFull: false, balancePaid: false, shootDate: "2026-05-02", gallery: {} },
  { id: "m2", address: "1205 Hillcrest Ave, Del Mar, CA",           clientName: "James Holbrook", status: "completed",       totalPrice: 549,  depositAmount: 274,  depositPaid: true,  paidInFull: true,  balancePaid: true,  shootDate: "2026-04-28", gallery: { delivered: true } },
  { id: "m3", address: "780 Sunset Blvd, Coronado, CA",             clientName: "Priya Anand",    status: "requested",       totalPrice: 1999, depositAmount: 999,  depositPaid: false, paidInFull: false, balancePaid: false, shootDate: "2026-05-06", gallery: {} },
  { id: "m4", address: "330 Harbor Dr, Point Loma, CA",             clientName: "Tom Reyes",      status: "confirmed",       totalPrice: 875,  depositAmount: 437,  depositPaid: true,  paidInFull: false, balancePaid: false, shootDate: "2026-05-04", gallery: {} },
  { id: "m5", address: "2190 Rancho Santa Fe Rd, Encinitas, CA",    clientName: "Amanda Flores",  status: "completed",       totalPrice: 1549, depositAmount: 774,  depositPaid: true,  paidInFull: true,  balancePaid: true,  shootDate: "2026-04-22", gallery: { delivered: true } },
  { id: "m6", address: "555 Coast Blvd, La Jolla, CA",              clientName: "Derek Wang",     status: "pending_payment", totalPrice: 299,  depositAmount: 149,  depositPaid: false, paidInFull: false, balancePaid: false, shootDate: "2026-05-09", gallery: {} },
  { id: "m7", address: "892 Torrey Pines Rd, San Diego, CA",        clientName: "Natalie Cruz",   status: "confirmed",       totalPrice: 2399, depositAmount: 1199, depositPaid: true,  paidInFull: false, balancePaid: false, shootDate: "2026-05-01", gallery: {} },
  { id: "m8", address: "110 Prospect St, La Jolla, CA",             clientName: "Alex Yuen",      status: "completed",       totalPrice: 749,  depositAmount: 374,  depositPaid: true,  paidInFull: true,  balancePaid: true,  shootDate: "2026-04-19", gallery: { delivered: true } },
];

const MOCK_MONTHLY = [
  { month: "Nov", revenue: 3850 },
  { month: "Dec", revenue: 5120 },
  { month: "Jan", revenue: 4290 },
  { month: "Feb", revenue: 6740 },
  { month: "Mar", revenue: 7880 },
  { month: "Apr", revenue: 5960 },
];

// ── Status metadata ───────────────────────────────────────────────────────────
const STATUS_META = {
  pending_payment: { label: "Awaiting Payment", bg: "bg-orange-50",  text: "text-orange-700",  dot: "bg-orange-400" },
  requested:       { label: "Pending Review",   bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400"  },
  confirmed:       { label: "Confirmed",         bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-400"   },
  completed:       { label: "Completed",         bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  cancelled:       { label: "Cancelled",         bg: "bg-gray-100",   text: "text-gray-500",    dot: "bg-gray-400"   },
};

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.requested;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${m.dot}`} />
      {m.label}
    </span>
  );
}

function PayBadge({ listing }) {
  const paid = listing.paidInFull || listing.balancePaid;
  const dep  = !paid && listing.depositPaid;
  if (paid) return <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">Paid</span>;
  if (dep)  return <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">Deposit</span>;
  return <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Unpaid</span>;
}

function KpiCard({ label, value, sub, variant = "default" }) {
  const styles = {
    navy:    { wrap: "bg-[#0B2A55]",                          label: "text-white/50",          value: "text-white",        sub: "text-white/40"        },
    amber:   { wrap: "bg-amber-50 border border-amber-200",   label: "text-amber-600/80",      value: "text-amber-700",    sub: "text-amber-500/80"    },
    green:   { wrap: "bg-emerald-50 border border-emerald-200", label: "text-emerald-600/70",  value: "text-emerald-700",  sub: "text-emerald-600/60"  },
    gold:    { wrap: "bg-[#fdfaf5] border border-[#e8d9b8]",  label: "text-[#A8843F]/70",      value: "text-[#A8843F]",    sub: "text-[#A8843F]/60"    },
    default: { wrap: "bg-white border border-gray-200",       label: "text-gray-400",          value: "text-[#1a1a1a]",    sub: "text-gray-400"        },
  };
  const s = styles[variant] || styles.default;
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${s.wrap}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-widest mb-3 ${s.label}`}>{label}</p>
      <p className={`text-3xl font-bold leading-none mb-1 ${s.value}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-0.5 ${s.sub}`}>{sub}</p>}
    </div>
  );
}

function RevenueChart({ data }) {
  const max   = Math.max(...data.map((d) => d.revenue), 1);
  const H     = 80;
  const barW  = 32;
  const gap   = 12;
  const total = data.length * (barW + gap) - gap;

  return (
    <svg viewBox={`0 0 ${total} ${H + 28}`} className="w-full" style={{ maxWidth: total * 2.5 }}>
      {data.map((d, i) => {
        const barH = Math.max(6, (d.revenue / max) * H);
        const x    = i * (barW + gap);
        const y    = H - barH;
        const isLast = i === data.length - 1;
        return (
          <g key={d.month}>
            <rect x={x} y={y} width={barW} height={barH} rx={6}
              fill={isLast ? "#0B2A55" : "#0B2A5518"} />
            <text x={x + barW / 2} y={H + 20} textAnchor="middle"
              fontSize="10" fill="#9ca3af" fontFamily="system-ui, sans-serif">
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function CopyButton({ label, icon, text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-2 text-xs font-medium bg-white border border-gray-200 text-gray-600 px-3.5 py-2 rounded-xl hover:border-gray-300 hover:text-gray-800 transition-colors shadow-sm"
    >
      {icon}
      {copied ? "Copied!" : label}
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
    pending:   display.filter((l) => l.status === "requested").length,
    confirmed: display.filter((l) => l.status === "confirmed").length,
    completed: display.filter((l) => l.status === "completed").length,
    revenue:   display.reduce((s, l) => {
      if (l.paidInFull || l.balancePaid) return s + (l.totalPrice || 0);
      if (l.depositPaid)                 return s + (l.depositAmount || 0);
      return s;
    }, 0),
  }), [display]);

  const monthlyData = useMemo(() => {
    if (isMock) return MOCK_MONTHLY;
    const byMonth = {};
    listings.forEach((l) => {
      if (!l.shootDate) return;
      const d  = new Date(l.shootDate + "T12:00:00");
      const k  = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const mo = d.toLocaleDateString("en-US", { month: "short" });
      if (!byMonth[k]) byMonth[k] = { month: mo, revenue: 0, sort: k };
      const rev = (l.paidInFull || l.balancePaid)
        ? (l.totalPrice || 0)
        : l.depositPaid ? (l.depositAmount || 0) : 0;
      byMonth[k].revenue += rev;
    });
    const result = Object.values(byMonth).sort((a, b) => a.sort.localeCompare(b.sort)).slice(-6);
    return result.length >= 2 ? result : MOCK_MONTHLY;
  }, [listings, isMock]);

  const actionItems = display.filter((l) =>
    l.status === "requested" || l.status === "pending_payment"
  ).slice(0, 6);

  const upcoming = display
    .filter((l) => l.status === "confirmed")
    .sort((a, b) => (a.shootDate || "").localeCompare(b.shootDate || ""))
    .slice(0, 5);

  const bookingUrl = tenant
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${tenant.slug}/book`
    : "";

  const setupSteps = tenant ? [
    { done: !!tenant.phone,                                                                label: "Complete your profile",    href: "/onboarding" },
    { done: !!(tenant.branding?.primaryColor && tenant.branding?.businessName),            label: "Configure branding",       href: "/dashboard/settings#settings-branding" },
    { done: !!(tenant.bookingConfig || tenant.pricingConfig || tenant.availabilityConfig), label: "Review booking settings",  href: "/dashboard/settings" },
    { done: !!tenant.stripeConnectOnboarded,                                               label: "Connect Stripe",           href: "/dashboard/billing" },
    { done: hasProducts,                                                                   label: "Add services",             href: "/dashboard/products" },
    { done: listings.length > 0,                                                           label: "First booking received",   href: null },
  ] : [];
  const doneCount     = setupSteps.filter((s) => s.done).length;
  const setupComplete = doneCount === setupSteps.length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
    </div>
  );

  const today    = new Date();
  const hour     = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const bizName  = tenant?.businessName || "";
  const firstName = bizName.split(" ")[0] || "there";

  const quickActions = [
    {
      label: "New Listing",
      href:  "/dashboard/listings/new",
      icon:  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>,
    },
    {
      label: "Add Service",
      href:  "/dashboard/products",
      icon:  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" /></svg>,
    },
    {
      label: "Invite Photographer",
      href:  "/dashboard/team",
      icon:  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
    },
    {
      label: "Settings",
      href:  "/dashboard/settings",
      icon:  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8F7F5]">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-5">

        {/* ── A. Setup hero ──────────────────────────────────────────────────── */}
        {tenant && !setupComplete && (
          <div className="relative overflow-hidden rounded-2xl bg-[#0B2A55] px-8 py-7">
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none"
              style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "22px 22px" }}
            />
            <div className="relative z-10">
              <div className="flex items-start justify-between gap-6 mb-5">
                <div>
                  <p className="text-white/50 text-[11px] font-semibold uppercase tracking-widest mb-1">Getting started</p>
                  <h2 className="text-white text-xl font-semibold leading-snug">
                    {doneCount} of {setupSteps.length} steps complete
                  </h2>
                  <p className="text-white/50 text-sm mt-1">Finish setup to start accepting bookings.</p>
                </div>
                <Link
                  href="/onboarding"
                  className="flex-shrink-0 text-xs font-semibold bg-white text-[#0B2A55] px-5 py-2.5 rounded-xl hover:bg-white/90 transition-colors whitespace-nowrap shadow-sm"
                >
                  Continue Setup →
                </Link>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1 mb-4">
                <div
                  className="bg-[#C9A96E] h-1 rounded-full transition-all duration-700"
                  style={{ width: `${(doneCount / setupSteps.length) * 100}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {setupSteps.map((s, i) => (
                  <span
                    key={i}
                    className={`text-[11px] font-medium px-3 py-1 rounded-full ${
                      s.done
                        ? "bg-white/10 text-white/35 line-through"
                        : "bg-white/15 text-white/80"
                    }`}
                  >
                    {s.done ? "✓ " : ""}{s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stripe connect banner */}
        {tenant && !tenant.stripeConnectOnboarded && setupComplete && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-amber-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-amber-900 font-semibold text-sm">Connect Stripe to accept payments</p>
                <p className="text-amber-700/70 text-xs mt-0.5">Deposits will not be collected until Stripe Connect is active.</p>
              </div>
            </div>
            <Link
              href="/dashboard/billing"
              className="flex-shrink-0 text-xs font-semibold text-amber-900 border border-amber-300 bg-white px-4 py-2.5 rounded-xl hover:bg-amber-50 transition-colors whitespace-nowrap"
            >
              Connect Stripe →
            </Link>
          </div>
        )}

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-0.5">Overview</p>
            <h1 className="text-2xl font-semibold text-[#1a1a1a] leading-tight">
              {greeting}, {firstName}
              {isMock && (
                <span className="ml-3 align-middle text-xs font-normal text-gray-400 bg-gray-100 px-2.5 py-0.5 rounded-full">
                  sample data
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {bookingUrl && (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-semibold border border-gray-200 bg-white text-gray-700 px-4 py-2.5 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Booking Page
              </a>
            )}
            <Link
              href="/dashboard/listings/new"
              className="inline-flex items-center gap-2 text-xs font-semibold bg-[#0B2A55] text-white px-4 py-2.5 rounded-xl hover:bg-[#0d3268] transition-colors shadow-sm"
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Listing
            </Link>
          </div>
        </div>

        {/* ── B. KPI cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label="Total Listings" value={stats.total}     sub="all time"   variant="navy" />
          <KpiCard label="Pending Review" value={stats.pending}   sub={stats.pending > 0 ? "need action" : "none pending"} variant={stats.pending > 0 ? "amber" : "default"} />
          <KpiCard label="Active Shoots"  value={stats.confirmed} sub="confirmed"  variant="green" />
          <KpiCard label="Completed"      value={stats.completed} sub="delivered"  variant="default" />
          <KpiCard label="Revenue"        value={`$${stats.revenue.toLocaleString()}`} sub="collected" variant="gold" />
        </div>

        {/* ── F. Quick actions ───────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {quickActions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="inline-flex items-center gap-2 text-xs font-medium bg-white border border-gray-200 text-gray-600 px-3.5 py-2 rounded-xl hover:border-gray-300 hover:text-gray-800 transition-colors shadow-sm"
            >
              {a.icon}
              {a.label}
            </Link>
          ))}
          {bookingUrl && (
            <CopyButton
              label="Copy Booking Link"
              text={bookingUrl}
              icon={
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              }
            />
          )}
        </div>

        {/* ── C. Upcoming + Action Required ──────────────────────────────────── */}
        <div className="grid lg:grid-cols-[1fr_380px] gap-4">

          {/* Upcoming Shoots */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-[#1a1a1a] text-sm">Upcoming Shoots</h2>
              <Link href="/dashboard/listings" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                View all →
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500 font-medium">No confirmed shoots</p>
                {bookingUrl && (
                  <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-[#0B2A55] hover:underline">
                    Share booking page →
                  </a>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcoming.map((l) => {
                  const date = l.shootDate ? new Date(l.shootDate + "T12:00:00") : null;
                  const dd   = date ? date.getDate() : "--";
                  const mo   = date ? date.toLocaleDateString("en-US", { month: "short" }) : "";
                  return (
                    <Link
                      key={l.id}
                      href={isMock ? "/dashboard/listings" : `/dashboard/listings/${l.id}`}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors group"
                    >
                      <div className="flex-shrink-0 w-11 text-center">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#0B2A55]/40">{mo}</div>
                        <div className="text-xl font-bold leading-none text-[#0B2A55]">{dd}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] truncate">{l.address}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{l.clientName}</p>
                      </div>
                      <div className="flex-shrink-0 text-right space-y-1">
                        <p className="text-sm font-semibold text-[#1a1a1a]">${l.totalPrice?.toLocaleString()}</p>
                        <PayBadge listing={l} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Required */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-[#1a1a1a] text-sm">Action Required</h2>
              {actionItems.length > 0 && (
                <span className="text-[11px] font-bold bg-amber-100 text-amber-700 w-6 h-6 rounded-full flex items-center justify-center">
                  {actionItems.length}
                </span>
              )}
            </div>
            {actionItems.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="text-emerald-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-700">All caught up</p>
                <p className="text-xs text-gray-400 mt-1">No pending actions right now.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {actionItems.map((l) => (
                  <Link
                    key={l.id}
                    href={isMock ? "/dashboard/listings" : `/dashboard/listings/${l.id}`}
                    className="flex items-start gap-3 px-6 py-4 hover:bg-gray-50/60 transition-colors group"
                  >
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
                      l.status === "requested" ? "bg-amber-100" : "bg-orange-100"
                    }`}>
                      <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"
                        className={l.status === "requested" ? "text-amber-600" : "text-orange-600"}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-sm font-medium text-[#1a1a1a] truncate leading-snug">{l.address}</p>
                      <p className="text-xs text-gray-400 truncate">{l.clientName}</p>
                      <StatusBadge status={l.status} />
                    </div>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                      className="flex-shrink-0 text-gray-300 group-hover:text-gray-400 mt-1 transition-colors">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── D. Revenue chart ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 pt-5 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Revenue</p>
              <p className="text-2xl font-bold text-[#1a1a1a]">
                ${monthlyData.reduce((s, m) => s + m.revenue, 0).toLocaleString()}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Last 6 months</p>
            </div>
            {isMock && (
              <span className="text-[11px] text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg flex-shrink-0">sample</span>
            )}
          </div>
          <div className="px-6 py-6">
            <RevenueChart data={monthlyData} />
          </div>
        </div>

        {/* ── E. Listings table ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-[#1a1a1a] text-sm">
              Recent Listings
              {isMock && <span className="ml-2 text-xs font-normal text-gray-400">(sample data)</span>}
            </h2>
            <Link href="/dashboard/listings" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              View all →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-6 py-3 whitespace-nowrap">Property</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3 whitespace-nowrap">Client</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3 whitespace-nowrap">Shoot Date</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-4 py-3 whitespace-nowrap">Payment</th>
                  <th className="text-right text-[11px] font-semibold text-gray-400 uppercase tracking-widest px-6 py-3 whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {display.slice(0, 8).map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 max-w-[260px]">
                      {isMock ? (
                        <span className="font-medium text-[#1a1a1a] line-clamp-1 block">{l.address}</span>
                      ) : (
                        <Link
                          href={`/dashboard/listings/${l.id}`}
                          className="font-medium text-[#1a1a1a] group-hover:text-[#0B2A55] transition-colors line-clamp-1 block"
                        >
                          {l.address}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-500 whitespace-nowrap">{l.clientName}</td>
                    <td className="px-4 py-4 text-gray-400 whitespace-nowrap text-xs">{l.shootDate || "-"}</td>
                    <td className="px-4 py-4"><StatusBadge status={l.status} /></td>
                    <td className="px-4 py-4"><PayBadge listing={l} /></td>
                    <td className="px-6 py-4 text-right font-semibold text-[#1a1a1a] whitespace-nowrap">
                      ${l.totalPrice?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
