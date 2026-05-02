"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AgentNav({ slug }) {
  const [token,   setToken]   = useState("");
  const pathname = usePathname();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`agent-token-${slug}`);
      if (saved) setToken(saved);
    } catch {}
  }, [slug]);

  const t = token ? `?token=${token}` : "";

  const navItems = [
    { label: "Dashboard",   href: `/${slug}/agent`,          exact: true },
    { label: "My Listings", href: `/${slug}/agent/listings`               },
    { label: "Settings",    href: `/${slug}/agent/settings`               },
  ];

  return (
    <nav className="border-b border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex gap-0 overflow-x-auto">
          {navItems.map((item) => {
            const base     = item.href;
            const isActive = item.exact ? pathname === base : pathname.startsWith(base);
            return (
              <Link
                key={item.href}
                href={`${item.href}${t}`}
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
      </div>
    </nav>
  );
}
