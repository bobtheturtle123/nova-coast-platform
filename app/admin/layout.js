"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";

const NAV = [
  { href: "/admin",              label: "Dashboard",    icon: "⬛" },
  { href: "/admin/bookings",     label: "Bookings",     icon: "📋" },
  { href: "/admin/photographers",label: "Photographers",icon: "📷" },
  { href: "/admin/gallery",      label: "Galleries",    icon: "🖼️"  },
];

export default function AdminLayout({ children }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user,    setUser]    = useState(undefined); // undefined = loading
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        router.push("/admin/login");
        return;
      }
      // Check admin custom claim
      const token = await u.getIdTokenResult();
      if (!token.claims.admin) {
        router.push("/");
        return;
      }
      setUser(u);
      setIsAdmin(true);
    });
    return unsub;
  }, [router]);

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-cream flex">
      {/* Sidebar */}
      <aside className="w-56 bg-navy flex-shrink-0 flex flex-col">
        <div className="p-6 border-b border-white/10">
          <p className="font-display text-white text-sm tracking-widest uppercase">
            Nova Coast
          </p>
          <p className="text-gold/70 text-xs font-body mt-0.5">Admin</p>
        </div>

        <nav className="p-4 space-y-1 flex-1">
          {NAV.map((item) => {
            const active = pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-body
                  transition-colors duration-150
                  ${active
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => auth.signOut()}
            className="text-xs text-white/40 hover:text-white/70 font-body transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
