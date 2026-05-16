"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ToastProvider } from "@/components/Toast";

const NAV = [
  {
    href: "/photographer",
    label: "My Shoots",
    exact: true,
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    href: "/photographer/schedule",
    label: "Schedule",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: "/photographer/profile",
    label: "Profile",
    icon: (
      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function PhotographerLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,         setUser]        = useState(undefined);
  const [bizName,      setBizName]     = useState("");
  const [memberName,   setMemberName]  = useState("");
  const [sidebarOpen,  setSidebarOpen] = useState(false);
  const [permissions,  setPermissions] = useState({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/auth/login"); return; }
      const tokenResult = await u.getIdTokenResult(true);
      const claims = tokenResult.claims;
      // Must be a photographer role — redirect admins to the admin dashboard
      if (claims.role !== "photographer") {
        if (claims.tenantId) { router.push("/dashboard"); return; }
        router.push("/auth/login");
        return;
      }
      setUser(u);
      // Load branding + member name on auth (static — no need to re-fetch on navigation)
      try {
        const token = await u.getIdToken();
        const res  = await fetch("/api/photographer/me", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.member?.name)           setMemberName(data.member.name);
        if (data.branding?.businessName) setBizName(data.branding.businessName);
      } catch { /* non-critical */ }
    });
    return unsub;
  }, [router]);

  // Re-fetch permissions on every navigation and on page refresh — sole owner of permission state
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    user.getIdToken().then((token) =>
      fetch("/api/photographer/me", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled && data.member?.permissions) setPermissions(data.member.permissions);
        })
        .catch(() => {})
    );
    return () => { cancelled = true; };
  }, [user, pathname]);

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  function isActive(item) {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  }

  const Sidebar = () => (
    <aside className="w-56 bg-[#0F172A] flex flex-col h-full">
      <div className="px-5 pt-5 pb-4 border-b border-white/5">
        <p className="font-semibold text-white text-sm tracking-tight">{bizName || "KyoriaOS"}</p>
        {memberName && <p className="text-white/40 text-xs mt-0.5 truncate">{memberName}</p>}
        <span className="inline-block mt-1.5 text-[10px] bg-white/10 text-white/50 px-2 py-0.5 rounded-full">Photographer</span>
      </div>

      <nav className="px-2.5 py-3 space-y-0.5 flex-1 overflow-y-auto">
        {NAV.map((item) => {
          const active = isActive(item);
          return (
            <Link key={item.href} href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-100 ${
                active ? "bg-white/15 text-white" : "text-white/65 hover:text-white hover:bg-white/8"
              }`}>
              <span className={`flex-shrink-0 ${active ? "opacity-100" : "opacity-75"}`}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Dashboard access items — shown based on owner-granted permissions */}
        {[
          { href: "/dashboard/bookings",    label: "All Bookings",  show: permissions.canCreateBookings,  icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
          { href: "/dashboard/listings",    label: "Listings",      show: permissions.canCreateBookings || permissions.canManageProducts, icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
          { href: "/dashboard/team",        label: "Team",          show: permissions.canManageTeam,      icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
          { href: "/dashboard/products",    label: "Products",      show: permissions.canManageProducts,  icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg> },
          { href: "/dashboard/reports",     label: "Reports",       show: permissions.canViewReports,     icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
          { href: "/dashboard/settings",    label: "Settings",      show: permissions.canEditSettings,    icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
        ].filter((item) => item.show).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-100 ${
                active ? "bg-white/15 text-white" : "text-white/65 hover:text-white hover:bg-white/8"
              }`}>
              <span className={`flex-shrink-0 ${active ? "opacity-100" : "opacity-75"}`}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-white/5">
        <p className="text-[11px] text-white/40 truncate px-2 mb-1">{user?.email}</p>
        <button onClick={() => auth.signOut().then(() => router.push("/auth/login"))}
          className="w-full text-left text-[12px] text-white/50 hover:text-white/80 transition-colors px-2 py-1 rounded hover:bg-white/5">
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
  <ToastProvider>
    <div className="min-h-screen bg-gray-50 flex">
      <div className="hidden md:flex flex-col flex-shrink-0 w-56 sticky top-0 h-screen">
        <Sidebar />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-56 flex flex-col"><Sidebar /></div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-[#0F172A] border-b border-white/10">
          <button onClick={() => setSidebarOpen(true)} className="text-white/60 hover:text-white">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-white text-sm tracking-tight">{bizName || "KyoriaOS"}</span>
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  </ToastProvider>
  );
}
