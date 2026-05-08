"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export default function AgentNav({ slug }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      // Sign out of Firebase Auth if available
      const { auth } = await import("@/lib/firebase");
      const { signOut } = await import("firebase/auth");
      await signOut(auth).catch(() => {});
    } catch {}
    // Clear server-side session cookie
    await fetch(`/api/${slug}/agent/session`, { method: "DELETE" }).catch(() => {});
    router.replace(`/${slug}/agent/login`);
  }

  const navItems = [
    { label: "Dashboard", href: `/${slug}/agent`,          exact: true },
    { label: "Settings",  href: `/${slug}/agent/settings`               },
  ];

  return (
    <nav className="border-b border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-0 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? "border-[#3486cf] text-[#3486cf]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </nav>
  );
}
