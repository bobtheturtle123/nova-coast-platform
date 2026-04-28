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
    label: "Team",
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
  const [user,        setUser]       = useState(undefined);
  const [tenantName,  setTenantName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/auth/login"); return; }
      const tokenResult = await u.getIdTokenResult();
      if (!tokenResult.claims.tenantId) { router.push("/onboarding"); return; }
      setUser(u);
      fetch("/api/dashboard/tenant", {
        headers: { Authorization: `Bearer ${await u.getIdToken()}` },
      }).then((r) => r.json()).then((d) => {
        if (d.tenant?.businessName) setTenantName(d.tenant.businessName);
      }).catch(() => {});
    });
    return unsub;
  }, [router]);

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
    <aside
      className="w-56 flex flex-col h-full"
      style={{
        background: "linear-gradient(180deg, #0e2f5a 0%, #091e3e 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Brand */}
      <div className="px-4 pt-5 pb-4 flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-[13px] text-white"
          style={{ background: "linear-gradient(135deg, #C9A96E 0%, #9a7535 100%)" }}
        >
          K
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-white text-[13px] tracking-tight leading-tight">KyoriaOS</p>
          {tenantName && (
            <p className="text-white/45 text-[11px] mt-0.5 truncate leading-none">{tenantName}</p>
          )}
        </div>
      </div>

      {/* Separator */}
      <div className="mx-4 mb-2" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />

      {/* Nav */}
      <nav className="px-2.5 pt-1 flex-1 overflow-y-auto space-y-0.5">
        {NAV.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className="relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[12.5px] font-medium transition-all duration-150 group"
              style={{
                color:      active ? "#ffffff" : "rgba(255,255,255,0.58)",
                background: active ? "rgba(255,255,255,0.11)" : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = "transparent";
              }}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
                  style={{ width: 3, height: 18, background: "#C9A96E" }}
                />
              )}
              <span
                className="flex-shrink-0 w-[28px] h-[28px] rounded-lg flex items-center justify-center transition-all"
                style={{ background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)" }}
              >
                {item.icon}
              </span>
              <span className="tracking-tight leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Upgrade CTA */}
      <div className="px-3 pb-3">
        <div className="rounded-xl p-3"
          style={{ background: "linear-gradient(135deg, rgba(201,169,110,0.13) 0%, rgba(201,169,110,0.07) 100%)", border: "1px solid rgba(201,169,110,0.22)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(201,169,110,0.22)" }}>
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#C9A96E" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <p className="text-[11.5px] font-semibold" style={{ color: "rgba(255,255,255,0.82)" }}>Upgrade to Pro</p>
          </div>
          <p className="text-[10px] mb-2.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
            Unlock advanced analytics, custom branding, and priority support.
          </p>
          <Link href="/dashboard/billing"
            className="block w-full text-center text-[11px] font-semibold py-1.5 rounded-lg transition-colors"
            style={{ background: "rgba(201,169,110,0.18)", color: "#C9A96E", border: "1px solid rgba(201,169,110,0.28)" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,169,110,0.28)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(201,169,110,0.18)"; }}>
            View Plans →
          </Link>
        </div>
      </div>

      {/* Footer — user area */}
      <div className="px-2.5 pb-3.5">
        <div className="mx-1 mb-3" style={{ height: 1, background: "rgba(255,255,255,0.07)" }} />
        <div className="flex items-center gap-2.5 px-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-semibold text-white"
            style={{ background: "rgba(201,169,110,0.32)" }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10.5px] text-white/45 truncate leading-none">{user?.email}</p>
          </div>
          <button
            onClick={() => auth.signOut().then(() => router.push("/auth/login"))}
            className="text-white/30 hover:text-white/70 transition-colors p-1 rounded flex-shrink-0"
            title="Sign out"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen flex" style={{ background: "var(--bg-base)" }}>
        {/* Desktop sidebar */}
        <div className="hidden md:flex flex-col flex-shrink-0 w-56 sticky top-0 h-screen">
          <Sidebar />
        </div>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
              onClick={() => setSidebarOpen(false)}
            />
            <div className="relative w-56 flex flex-col">
              <Sidebar />
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mobile top bar */}
          <div
            className="md:hidden flex items-center gap-3 px-4 py-3"
            style={{ background: "linear-gradient(90deg, #0e2f5a 0%, #091e3e 100%)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <button onClick={() => setSidebarOpen(true)} className="text-white/60 hover:text-white transition-colors">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="font-semibold text-white text-[13px] tracking-tight">KyoriaOS</span>
          </div>

          <main className="flex-1 overflow-auto">{children}</main>
        </div>

        <AiChatButton />
      </div>
    </ToastProvider>
  );
}
