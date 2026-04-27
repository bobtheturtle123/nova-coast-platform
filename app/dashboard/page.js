"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import Link from "next/link";

const STATUS_LABELS = {
  pending_payment: "Awaiting Payment",
  requested:       "Pending Review",
  confirmed:       "Confirmed",
  completed:       "Shoot Complete",
  cancelled:       "Cancelled",
};

function PayBadge({ listing }) {
  const paid = listing.paidInFull || listing.balancePaid;
  const dep  = !paid && listing.depositPaid;
  if (paid) return <span className="tag-green">Paid</span>;
  if (dep)  return <span className="tag-blue">Deposit</span>;
  return <span className="tag-gray">Unpaid</span>;
}

export default function DashboardHome() {
  const router = useRouter();
  const [listings,       setListings]       = useState([]);
  const [tenant,         setTenant]         = useState(null);
  const [hasProducts,    setHasProducts]    = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [showSetupModal, setShowSetupModal] = useState(false);

  useEffect(() => {
    auth.currentUser?.getIdToken(true).then(async (token) => {
      const h = { Authorization: `Bearer ${token}` };
      const [listRes, tenantRes, svcRes, pkgRes] = await Promise.all([
        fetch("/api/dashboard/listings",          { headers: h }),
        fetch("/api/dashboard/tenant",            { headers: h }),
        fetch("/api/dashboard/products?type=services", { headers: h }),
        fetch("/api/dashboard/products?type=packages", { headers: h }),
      ]);
      if (listRes.ok)   { const d = await listRes.json();   setListings(d.listings || []); }
      if (tenantRes.ok) {
        const d = await tenantRes.json();
        setTenant(d.tenant);
        // Show welcome modal if onboarding not done and not dismissed this session
        if (d.tenant && !d.tenant.onboardingCompleted) {
          const dismissed = typeof window !== "undefined"
            && localStorage.getItem(`sfSetupDismissed_${d.tenant.id || "x"}`);
          if (!dismissed) setShowSetupModal(true);
        }
      }
      const svcData = svcRes.ok  ? await svcRes.json()  : {};
      const pkgData = pkgRes.ok  ? await pkgRes.json()  : {};
      setHasProducts((svcData.items?.length || 0) > 0 || (pkgData.items?.length || 0) > 0);
      setLoading(false);
    });
  }, []);

  function dismissSetupModal() {
    if (tenant) localStorage.setItem(`sfSetupDismissed_${tenant.id || "x"}`, "1");
    setShowSetupModal(false);
  }

  const stats = {
    total:     listings.length,
    pending:   listings.filter((l) => l.status === "requested").length,
    confirmed: listings.filter((l) => l.status === "confirmed").length,
    // Correct formula: paid-in-full → total; deposit only → deposit; else → 0
    revenue: listings.reduce((s, l) => {
      if (l.paidInFull || l.balancePaid) return s + (l.totalPrice || 0);
      if (l.depositPaid)                 return s + (l.depositAmount || 0);
      return s;
    }, 0),
  };

  const recent = listings.slice(0, 8);
  const bookingUrl = tenant
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/${tenant.slug}/book`
    : "";

  if (loading) return (
    <div className="p-8 flex items-center justify-center h-64">
      <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-6xl">

      {/* ── Setup welcome modal ─────────────────────────────────────────── */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
            <div className="w-12 h-12 bg-navy/5 rounded-xl flex items-center justify-center mb-5">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-navy">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <h2 className="font-display text-2xl text-navy mb-2">Want to set up now?</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-2">
              Takes about 5–10 minutes. We'll walk you through:
            </p>
            <ul className="space-y-1.5 mb-6">
              {["Business basics & contact info", "Your services and pricing", "Connecting Stripe for payments", "Service areas and travel fees", "Inviting your team (optional)"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-gold font-bold">✓</span> {item}
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-3">
              <button onClick={() => router.push("/onboarding")}
                className="btn-primary py-3 text-sm w-full">
                Yes, let's set up →
              </button>
              <button onClick={dismissSetupModal}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-2 text-center">
                Not now — I'll do it later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Resume setup banner (dismissed but not complete) ────────────── */}
      {tenant && !tenant.onboardingCompleted && !showSetupModal && (
        <div className="bg-navy/[0.04] border border-navy/10 rounded-xl px-5 py-3 mb-5 flex items-center justify-between">
          <p className="text-sm text-navy/70">Finish setting up your account to go live.</p>
          <Link href="/onboarding"
            className="text-xs font-semibold text-navy border border-navy/20 px-4 py-1.5 rounded-lg hover:bg-navy/5 transition-colors">
            Continue Setup →
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">Dashboard</p>
          <h1 className="font-semibold text-2xl text-charcoal leading-tight">
            {tenant?.businessName || "Welcome back"}
          </h1>
        </div>
        {bookingUrl && (
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer"
            className="btn-outline text-xs px-4 py-2 flex items-center gap-1.5">
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Booking Page
          </a>
        )}
      </div>

      {/* Stripe connect banner */}
      {tenant && !tenant.stripeConnectOnboarded && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-amber-900 font-medium text-sm">Connect Stripe to accept payments</p>
            <p className="text-amber-700/70 text-xs mt-0.5">Deposits won't be collected until Stripe Connect is active.</p>
          </div>
          <Link href="/dashboard/billing"
            className="text-xs font-semibold text-amber-900 border border-amber-300 bg-white px-4 py-2 rounded-lg hover:bg-amber-50 transition-colors">
            Connect Stripe →
          </Link>
        </div>
      )}

      {/* Onboarding checklist — shown until all steps done */}
      {tenant && (() => {
        const steps = [
          { done: !!tenant.phone,                  label: "Complete your profile (phone & location)", href: "/onboarding" },
          { done: !!(tenant.branding?.primaryColor && tenant.branding?.businessName), label: "Set up your branding & colors", href: "/dashboard/settings#settings-branding" },
          { done: !!(tenant.bookingConfig || tenant.pricingConfig || tenant.availabilityConfig), label: "Review Settings — configure how your business operates", href: "/dashboard/settings" },
          { done: !!tenant.stripeConnectOnboarded, label: "Connect Stripe to accept payments",        href: "/dashboard/billing" },
          { done: hasProducts, label: "Add services & share your booking page", href: "/dashboard/products", external: false },
          { done: listings.length > 0,             label: "Receive your first booking",               href: null },
        ];
        const doneCount = steps.filter((s) => s.done).length;
        if (doneCount === steps.length) return null;
        return (
          <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-charcoal">Get started — {doneCount}/{steps.length} complete</p>
              <div className="flex gap-1">
                {steps.map((s, i) => (
                  <div key={i} className={`h-1 w-6 rounded-full ${s.done ? "bg-emerald-500" : "bg-gray-200"}`} />
                ))}
              </div>
            </div>
            <div className="space-y-2.5">
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    s.done ? "bg-emerald-500 border-emerald-500" : "border-gray-300"
                  }`}>
                    {s.done && (
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0">
                    {s.done || !s.href ? (
                      <span className={`text-sm ${s.done ? "line-through text-gray-400" : "text-charcoal"}`}>{s.label}</span>
                    ) : s.external ? (
                      <a href={s.href} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-navy hover:underline font-medium">{s.label}</a>
                    ) : (
                      <Link href={s.href} className="text-sm text-navy hover:underline font-medium">{s.label}</Link>
                    )}
                  </div>
                </div>
              ))}
              {/* Quick links row */}
              {doneCount < steps.length && (
                <div className="pt-2 mt-1 border-t border-gray-100 flex flex-wrap gap-3">
                  <Link href="/dashboard/products" className="text-xs text-gray-500 hover:text-navy transition-colors">→ Add services & pricing</Link>
                  <Link href="/dashboard/settings" className="text-xs text-gray-500 hover:text-navy transition-colors">→ Review booking settings</Link>
                  <Link href="/dashboard/team" className="text-xs text-gray-500 hover:text-navy transition-colors">→ Invite a photographer</Link>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="stat-card-navy">
          <p className="text-[11px] text-navy/50 uppercase tracking-widest mb-3 font-semibold">Total Listings</p>
          <p className="text-3xl font-semibold leading-none mb-1 text-navy">{stats.total}</p>
          <p className="text-[11px] text-navy/40">all time</p>
        </div>
        <div className={stats.pending > 0 ? "rounded-xl p-5 border border-amber-200 bg-amber-50" : "stat-card"}>
          <p className={`text-[11px] uppercase tracking-widest mb-3 font-semibold ${stats.pending > 0 ? "text-amber-600" : "text-gray-400"}`}>Pending Review</p>
          <p className={`text-3xl font-semibold leading-none mb-1 ${stats.pending > 0 ? "text-amber-600" : "text-charcoal"}`}>{stats.pending}</p>
          <p className={`text-[11px] ${stats.pending > 0 ? "text-amber-500" : "text-gray-400"}`}>need action</p>
        </div>
        <div className="stat-card-green">
          <p className="text-[11px] text-emerald-600/60 uppercase tracking-widest mb-3 font-semibold">Active Shoots</p>
          <p className="text-3xl font-semibold leading-none mb-1 text-emerald-700">{stats.confirmed}</p>
          <p className="text-[11px] text-emerald-600/50">confirmed</p>
        </div>
        <div className="stat-card-gold">
          <p className="text-[11px] text-[#A8843F]/60 uppercase tracking-widest mb-3 font-semibold">Revenue</p>
          <p className="text-3xl font-semibold leading-none mb-1 text-[#A8843F]">${stats.revenue.toLocaleString()}</p>
          <p className="text-[11px] text-[#A8843F]/50">collected</p>
        </div>
      </div>

      {/* Recent listings */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base text-charcoal">Recent Listings</h2>
        <Link href="/dashboard/listings" className="text-xs text-gray-400 hover:text-charcoal transition-colors">View all →</Link>
      </div>

      {listings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center shadow-card">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <p className="font-medium text-gray-700 mb-1">No listings yet</p>
          <p className="text-sm text-gray-400 mb-5">Share your booking page to start receiving orders.</p>
          {bookingUrl && (
            <div className="bg-gray-50 rounded-lg px-4 py-2.5 inline-flex items-center gap-2 border border-gray-200">
              <code className="text-xs text-gray-500">{bookingUrl}</code>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {recent.map((listing) => {
            const coverUrl = listing.gallery?.coverUrl;
            return (
              <Link key={listing.id} href={`/dashboard/listings/${listing.id}`}
                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-card-hover hover:border-gray-300 hover:-translate-y-0.5 transition-all duration-200">
                <div className="relative h-32 bg-gray-100">
                  {coverUrl ? (
                    <img src={coverUrl} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-50">
                      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1" className="text-gray-200">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                  )}
                  {listing.gallery?.delivered && (
                    <div className="absolute top-2 left-2">
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">Delivered</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-charcoal truncate leading-tight mb-0.5">{listing.address}</p>
                  <p className="text-[11px] text-gray-400 truncate mb-2.5">{listing.clientName}</p>
                  <div className="flex items-center justify-between">
                    <PayBadge listing={listing} />
                    <span className="text-xs font-semibold text-charcoal">${listing.totalPrice?.toLocaleString()}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
