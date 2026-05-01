"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function TenantBookHeader({ tenant }) {
  const searchParams = useSearchParams();
  const [isEmbed, setIsEmbed] = useState(false);

  useEffect(() => {
    // Persist embed mode across booking steps via sessionStorage
    if (searchParams?.get("embed") === "1") {
      sessionStorage.setItem("sf_embed", "1");
    }
    if (sessionStorage.getItem("sf_embed") === "1") {
      setIsEmbed(true);
    }
  }, [searchParams]);

  const primary = tenant.branding?.primaryColor || "#3486cf";
  const accent  = tenant.branding?.accentColor  || "#c9a96e";
  const name    = tenant.branding?.businessName || tenant.businessName || "Your Photographer";
  const tagline = tenant.branding?.tagline || "";

  if (isEmbed) return null;

  return (
    <header className="bg-white/95 backdrop-blur-md sticky top-0 z-30" style={{ borderBottom: "1px solid var(--border-subtle)", boxShadow: "0 1px 3px 0 rgb(0 0 0/0.04)" }}>
      <div className="max-w-3xl mx-auto px-5 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {tenant.branding?.logoUrl ? (
            <img src={tenant.branding.logoUrl} alt={name} className="h-7 w-auto object-contain" />
          ) : null}
          <div>
            <span className="font-display text-base tracking-widest" style={{ color: primary }}>
              {name}
            </span>
            {tagline && (
              <p className="text-[11px] hidden sm:block tracking-wider" style={{ color: accent }}>
                {tagline}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 tracking-wide">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          Secure checkout
        </div>
      </div>
    </header>
  );
}
