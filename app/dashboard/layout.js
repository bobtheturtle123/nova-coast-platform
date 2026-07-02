"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import AiChatButton from "@/components/dashboard/AiChatButton";
import NotificationBell from "@/components/NotificationBell";
import { ToastProvider } from "@/components/Toast";
import { DashboardPermissionsContext } from "@/lib/dashboardPermissions";
import { TenantSettingsContext } from "@/lib/TenantSettingsContext";
import DemoProvider from "@/components/DemoProvider";
import { isDemo, exitDemo, DEMO_TENANT } from "@/lib/demoData";
import { isUnlimitedTenant, getEffectivePlan } from "@/lib/plans";

// permKey: required permission for non-owners. ownerOnly: only owner/admin sees it.
const NAV = [
  {
    href: "/dashboard",
    label: "Overview",
    exact: true,
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/dashboard/listings",
    label: "Listings",
    permKey: "canViewListings",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: "/dashboard/bookings",
    label: "Bookings",
    permKey: "canCreateBookings",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: "/dashboard/calendar",
    label: "My Schedule",
    // Only for members who don't have the Team & Schedule page (photographers).
    restrictedOnly: true,
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/agents",
    label: "Customers",
    // Customer data is for owners/managers — not photographers.
    permKey: "canViewListings",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/team",
    label: "Team & Schedule",
    permKey: "canManageTeam",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/products",
    label: "Products",
    permKey: "canManageProducts",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: "/dashboard/service-areas",
    label: "Service Areas",
    permKey: "canManageProducts",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    permKey: "canViewReports",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    permKey: "canEditSettings",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    ownerOnly: true,
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/referrals",
    label: "Refer & Earn",
    ownerOnly: true,
    demoHidden: true,
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/help",
    label: "Help & Guides",
    // Renders the guides hub inside the dashboard shell (sidebar stays visible).
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function DashboardLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,               setUser]              = useState(undefined);
  const [userRole,           setUserRole]           = useState("owner");
  const [permissions,        setPermissions]        = useState(null);
  const [tenantName,         setTenantName]         = useState("");
  const [tenantLogo,         setTenantLogo]         = useState("");
  const [sidebarOpen,        setSidebarOpen]        = useState(false);
  const [pendingRevCount,    setPendingRevCount]    = useState(0);
  const [tenantPlan,         setTenantPlan]         = useState("starter");
  const [tenantSettings,     setTenantSettings]     = useState({ tempUnit: "F", locale: "en-US", currency: "USD" });
  const [subscriptionLapsed, setSubscriptionLapsed] = useState(false);
  const [deactivated,        setDeactivated]        = useState(false);
  const [reactivating,       setReactivating]       = useState(false);

  const hadRealUser = useRef(false);
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        // If a REAL session just ended in this tab (sign-out / account deletion),
        // never fall into demo — clear the flag and go to login.
        if (hadRealUser.current) { exitDemo(); router.push("/auth/login"); return; }
        // No real user. If this is a genuine view-only demo visit, render the
        // shell with a sample tenant and skip auth/subscription gating.
        if (isDemo()) {
          setUser({ email: "demo@aperturemedia.co", getIdToken: async () => "demo-token" });
          setUserRole("owner");
          setTenantName(DEMO_TENANT.businessName);
          setTenantPlan(DEMO_TENANT.subscriptionPlan);
          return;
        }
        router.push("/auth/login"); return;
      }
      // A real user is signed in — make sure demo mode can't linger in this tab.
      hadRealUser.current = true;
      if (isDemo()) exitDemo();
      // Force-refresh so custom claims (tenantId, role) are always current
      await u.getIdToken(true);
      const tokenResult = await u.getIdTokenResult();
      if (!tokenResult.claims.tenantId) {
        // Claims missing — attempt auto-repair before sending to onboarding
        let repaired = false;
        try {
          const repairRes = await fetch("/api/auth/repair-claims", {
            method: "POST",
            headers: { Authorization: `Bearer ${tokenResult.token}` },
          });
          const repairData = await repairRes.json();
          if (repairData.ok) {
            await u.getIdToken(true);
            const refreshed = await u.getIdTokenResult();
            repaired = !!refreshed.claims.tenantId;
          }
        } catch {}
        if (!repaired) { router.push("/onboarding"); return; }
      }
      const role = tokenResult.claims.role || "owner";
      const tok = await u.getIdToken();

      // Fetch tenant and enforce subscription gate before rendering any dashboard
      // page. SECURITY: this gate is FAIL-CLOSED — if we can't positively confirm
      // an active subscription (network error, bad response, no sub), we do NOT
      // render the dashboard. A previous fail-open path let unpaid accounts in.
      try {
        const res = await fetch("/api/dashboard/tenant", {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (!res.ok) { router.push("/auth/plan"); return; }
        const d = await res.json();
        if (d.tenant?.businessName) setTenantName(d.tenant.businessName);
        if (d.tenant?.branding?.logoUrl) setTenantLogo(d.tenant.branding.logoUrl);
        setTenantPlan(getEffectivePlan(d.tenant));
        setTenantSettings({
          tempUnit: d.tenant?.tempUnit || "F",
          locale:   d.tenant?.locale   || "en-US",
          currency: d.tenant?.currency || "USD",
        });
        const hasSub = !!(d.tenant?.stripeSubscriptionId || d.tenant?.permanentPlan) || isUnlimitedTenant(d.tenant);
        if (!hasSub) {
          router.push("/auth/plan");
          return;
        }
        setSubscriptionLapsed(d.tenant?.subscriptionStatus === "canceled");
      } catch {
        // Could not verify subscription — fail closed: send to plan selection.
        router.push("/auth/plan");
        return;
      }

      // Detect a member who deactivated their own profile — show a reactivate
      // screen instead of the dashboard (and never the company onboarding).
      try {
        const meRes = await fetch("/api/dashboard/team/me", { headers: { Authorization: `Bearer ${tok}` } });
        if (meRes.ok) {
          const me = await meRes.json();
          if (me.member && me.member.active === false) setDeactivated(true);
        }
      } catch {}

      setUser(u);
      setUserRole(role);
    });
    return unsub;
  }, [router]);

  async function reactivateSelf() {
    setReactivating(true);
    try {
      const tok = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/dashboard/team/me", { method: "POST", headers: { Authorization: `Bearer ${tok}` } });
      if (res.ok) { setDeactivated(false); router.refresh(); }
    } catch {}
    setReactivating(false);
  }

  const refreshSettings = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    const tok = await u.getIdToken();
    fetch("/api/dashboard/tenant", { headers: { Authorization: `Bearer ${tok}` } })
      .then((r) => r.json())
      .then((d) => {
        setTenantSettings({
          tempUnit: d.tenant?.tempUnit || "F",
          locale:   d.tenant?.locale   || "en-US",
          currency: d.tenant?.currency || "USD",
        });
      })
      .catch(() => {});
  }, []);

  // Re-fetch permissions on every navigation so owner changes take effect immediately
  useEffect(() => {
    if (!user || userRole === "owner" || userRole === "admin") return;
    user.getIdToken().then((tok) =>
      fetch("/api/dashboard/me", { headers: { Authorization: `Bearer ${tok}` } })
        .then((r) => r.json())
        .then((d) => {
          if (d.member?.permissions) setPermissions(d.member.permissions);
          else setPermissions({});
        })
        .catch(() => {})
    );
  }, [user, userRole, pathname]);

  // Re-fetch revision badge whenever the user navigates — clears stale counts after viewing
  useEffect(() => {
    if (!user) return;
    user.getIdToken().then((tok) => {
      fetch("/api/dashboard/revisions?status=pending", {
        headers: { Authorization: `Bearer ${tok}` },
      }).then((r) => r.json()).then((d) => {
        setPendingRevCount(d.revisions?.length ?? 0);
      }).catch(() => {});
    });
  }, [user, pathname]);

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  // Deactivated team member — offer reactivation instead of the dashboard.
  if (deactivated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--bg-base)" }}>
        <div className="max-w-sm w-full text-center bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          </div>
          <h1 className="text-lg font-bold text-[#0F172A]">Your profile is deactivated</h1>
          <p className="text-sm text-gray-500 mt-1 mb-5">Welcome back. Reactivate your profile to access your account again.</p>
          <button onClick={reactivateSelf} disabled={reactivating}
            className="btn-primary w-full py-2.5 text-sm disabled:opacity-50">
            {reactivating ? "Reactivating…" : "Reactivate my profile"}
          </button>
          <button onClick={async () => { const { signOut } = await import("firebase/auth"); await signOut(auth); router.push("/auth/login"); }}
            className="w-full text-sm text-gray-400 hover:text-gray-600 mt-3">Sign out</button>
        </div>
      </div>
    );
  }

  function isActive(item) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  const initials = tenantName
    ? tenantName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : (user?.email?.[0] || "K").toUpperCase();

  const Sidebar = () => (
    <aside className="ky-sidebar">
      {/* Branded top accent */}
      <div style={{ height: 3, background: "linear-gradient(90deg, #3486cf 0%, #5ba8e5 60%, transparent 100%)", flexShrink: 0 }} />

      {/* Brand */}
      <div className="ky-logo-wrap">
        <img src="/kyoriaos-logo.png" alt="KyoriaOS" className="h-8 w-auto object-contain flex-shrink-0" />
        {tenantName && (
          <div className="min-w-0">
            <p className="ky-logo-sub">{tenantName}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="ky-nav">
        {NAV.map((item) => {
          const isOwner = userRole === "owner" || userRole === "admin";
          const hasTeamPage = isOwner || !!permissions?.canManageTeam;
          if (item.demoHidden && isDemo()) return null;
          if (item.ownerOnly && !isOwner) return null;
          // "My Schedule" is only for restricted members (photographers) — anyone
          // with the Team & Schedule page uses that instead.
          if (item.restrictedOnly && hasTeamPage) return null;
          if (item.permKey && !isOwner && !permissions?.[item.permKey]) return null;
          const active = isActive(item);
          // Public guide pages open in a new tab so the user keeps their place.
          if (item.external) {
            return (
              <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                onClick={() => setSidebarOpen(false)} className="ky-nav-item">
                <span className="flex-shrink-0">{item.icon}</span>
                <span className="leading-none flex-1">{item.label}</span>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 opacity-40">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`ky-nav-item${active ? " active" : ""}`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="leading-none flex-1">{item.label}</span>
              {item.label === "Listings" && pendingRevCount > 0 && (
                <span style={{ background: "#ef4444", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 9999, padding: "1px 6px", lineHeight: "16px" }}>
                  {pendingRevCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade CTA — hidden on top-tier plan */}
      {(() => {
        const NEXT = { starter: "Studio", solo: "Studio", studio: "Pro", pro: "Scale" };
        const DESC = {
          starter: "More listings and team members.",
          solo:    "300 listings/year and up to 3 team members.",
          studio:  "600 listings/year and up to 5 team members.",
          pro:     "1,000 listings/year and up to 10 team members.",
        };
        const next = NEXT[tenantPlan];
        if (!next) return null;
        return (
          <div className="ky-upgrade-card">
            <p className="text-[11.5px] font-semibold text-[#1E5A8A]">Upgrade to {next}</p>
            <p className="text-[11px] mt-1 leading-relaxed text-gray-500">{DESC[tenantPlan]}</p>
            <Link href="/dashboard/billing" className="ky-upgrade-btn">View Plans →</Link>
          </div>
        );
      })()}

      {/* User area — avatar+email links to profile, logout button separate */}
      <div className="ky-user-card">
        <Link
          href="/dashboard/profile"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-2 flex-1 min-w-0 group"
        >
          {tenantLogo ? (
            <img
              src={tenantLogo}
              alt={tenantName || "Company logo"}
              className="w-6 h-6 rounded-full object-cover flex-shrink-0 transition-opacity group-hover:opacity-80"
            />
          ) : (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white transition-opacity group-hover:opacity-80"
              style={{ background: "#3486cf" }}
            >
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-500 truncate leading-none group-hover:text-[#3486cf] transition-colors">{user?.email}</p>
          </div>
        </Link>
        <button
          onClick={() => auth.signOut().then(() => router.push("/auth/login"))}
          className="flex-shrink-0 p-1 rounded text-gray-400 hover:text-gray-700 transition-colors"
          title="Sign out"
        >
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      {/* Legal links */}
      <div className="px-4 pb-4 pt-2 flex items-center gap-3 flex-wrap">
        <Link href="/terms"   className="text-[10px] text-gray-400 hover:text-[#3486cf] transition-colors">Terms</Link>
        <Link href="/privacy" className="text-[10px] text-gray-400 hover:text-[#3486cf] transition-colors">Privacy</Link>
        <Link href="/cookies" className="text-[10px] text-gray-400 hover:text-[#3486cf] transition-colors">Cookies</Link>
      </div>
    </aside>
  );

  return (
    <DemoProvider>
    <ToastProvider>
      <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
        {/* Desktop sidebar — fixed position, see .ky-sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative">
              <Sidebar />
            </div>
          </div>
        )}

        <div className="flex flex-col min-h-screen md:ml-[240px]">
          {/* Top bar (hamburger + logo on mobile; notifications bell on all sizes) */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{
              background: "#ffffff",
              borderBottom: "1px solid #E9ECF0",
            }}
          >
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-500 hover:text-gray-800 transition-colors">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <img src="/kyoriaos-logo.png" alt="KyoriaOS" className="md:hidden h-6 w-auto object-contain" />
            <div className="ml-auto"><NotificationBell /></div>
          </div>

          <TenantSettingsContext.Provider value={{ ...tenantSettings, refresh: refreshSettings }}>
            <DashboardPermissionsContext.Provider value={{ permissions: permissions || {}, userRole, subscriptionLapsed }}>
              {subscriptionLapsed && (
                <div style={{ background: "#FEF2F2", borderBottom: "1px solid #FECACA", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <p style={{ fontSize: 13, color: "#B91C1C", margin: 0, lineHeight: 1.5 }}>
                    <strong>Subscription ended.</strong> Your existing listings stay live and bookable. Reactivate to add team members, schedule shoots, and manage your account.
                  </p>
                  <Link href="/dashboard/billing"
                    style={{ fontSize: 12, fontWeight: 600, color: "#B91C1C", border: "1px solid #B91C1C", borderRadius: 6, padding: "4px 14px", whiteSpace: "nowrap", textDecoration: "none", flexShrink: 0 }}>
                    Reactivate →
                  </Link>
                </div>
              )}
              <main className="flex-1 overflow-x-hidden min-w-0">{children}</main>
            </DashboardPermissionsContext.Provider>
          </TenantSettingsContext.Provider>
        </div>

        <AiChatButton />
      </div>
    </ToastProvider>
    </DemoProvider>
  );
}
