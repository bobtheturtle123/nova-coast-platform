"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

const NAV = [
  { href: "/superadmin",          label: "Overview",  icon: "⬛" },
  { href: "/superadmin/tenants",  label: "Accounts",  icon: "🏢" },
];

export default function SuperadminLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,     setUser]     = useState(undefined);
  const [isSuper,  setIsSuper]  = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push("/auth/login"); return; }
      const token = await u.getIdTokenResult();
      if (token.claims.role !== "superadmin") { router.push("/"); return; }
      setUser(u);
      setIsSuper(true);
    });
    return unsub;
  }, [router]);

  if (user === undefined) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
    </div>
  );
  if (!isSuper) return null;

  return (
    <div className="min-h-screen bg-cream flex">
      <aside className="w-56 bg-navy flex-shrink-0 flex flex-col">
        <div className="p-6 border-b border-white/10">
          <p className="font-display text-white text-sm tracking-widest uppercase">NovaOS</p>
          <p className="text-red-400/70 text-xs font-body mt-0.5">Superadmin</p>
        </div>
        <nav className="p-4 space-y-1 flex-1">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/superadmin" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-body transition-colors
                  ${active ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"}`}>
                <span>{item.icon}</span>{item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <button onClick={() => auth.signOut().then(() => router.push("/auth/login"))}
            className="text-xs text-white/40 hover:text-white/70 transition-colors">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
