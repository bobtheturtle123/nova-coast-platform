"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import AiChatButton from "@/components/dashboard/AiChatButton";
import { ToastProvider } from "@/components/Toast";

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
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: "/dashboard/bookings",
    label: "Bookings",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: "/dashboard/agents",
    label: "Customers",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/team",
    label: "Team & Schedule",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/products",
    label: "Products",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    href: "/dashboard/service-areas",
    label: "Service Areas",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/profile",
    label: "My Profile",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
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
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/referrals",
    label: "Refer & Earn",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function DashboardLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,            setUser]           = useState(undefined);
  const [userRole,        setUserRole]        = useState("owner");
  const [tenantName,      setTenantName]      = useState("");
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [pendingRevCount, setPendingRevCount] = useState(0);
  const [tenantPlan,      setTenantPlan]      = useState("starter");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/auth/login"); return; }
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
      setUser(u);
      setUserRole(tokenResult.claims.role || "owner");
      const tok = await u.getIdToken();
      fetch("/api/dashboard/tenant", {
        headers: { Authorization: `Bearer ${tok}` },
      }).then((r) => r.json()).then((d) => {
        if (d.tenant?.businessName) setTenantName(d.tenant.businessName);
        setTenantPlan(d.tenant?.permanentPlan || d.tenant?.subscriptionPlan || "starter");
      }).catch(() => {});
    });
    return unsub;
  }, [router]);

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
          if (item.href === "/dashboard/billing" && userRole !== "owner" && userRole !== "admin") return null;
          const active = isActive(item);
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
        const NEXT = { starter: "Studio", solo: "Studio", studio: "Pro Team", pro: "Scale" };
        const DESC = {
          starter: "More listings, custom branding, and team seats.",
          solo:    "More listings, custom branding, and team seats.",
          studio:  "Multi-photographer ops with up to 12 seats.",
          pro:     "Unlimited seats and 1,200 listing credits.",
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

      {/* User area */}
      <div className="ky-user-card">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white"
          style={{ background: "#3486cf" }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-500 truncate leading-none">{user?.email}</p>
        </div>
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
          {/* Mobile top bar */}
          <div
            className="md:hidden flex items-center gap-3 px-4 py-3"
            style={{
              background: "#ffffff",
              borderBottom: "1px solid #E9ECF0",
            }}
          >
            <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-gray-800 transition-colors">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <img src="/kyoriaos-logo.png" alt="KyoriaOS" className="h-6 w-auto object-contain" />
          </div>

          <main className="flex-1 overflow-x-hidden min-w-0">{children}</main>
        </div>

        <AiChatButton />
      </div>
    </ToastProvider>
  );
}
