"use client";

export default function TenantBookHeader({ tenant }) {
  const primary = tenant.branding?.primaryColor || "#0b2a55";
  const accent  = tenant.branding?.accentColor  || "#c9a96e";
  const name    = tenant.branding?.businessName || tenant.businessName || "Your Photographer";
  const tagline = tenant.branding?.tagline || "";

  return (
    <header className="bg-white/90 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-30">
      <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
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
