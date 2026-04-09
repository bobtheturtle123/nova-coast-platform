"use client";

export default function TenantBookHeader({ tenant }) {
  const primary = tenant.branding?.primaryColor || "#0b2a55";
  const accent  = tenant.branding?.accentColor  || "#c9a96e";
  const name    = tenant.branding?.businessName || tenant.businessName || "Your Photographer";
  const tagline = tenant.branding?.tagline || "";

  return (
    <header className="border-b border-gray-100 bg-white">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {tenant.branding?.logoUrl && (
            <img src={tenant.branding.logoUrl} alt={name}
              className="h-8 w-auto object-contain" />
          )}
          <div>
            <span className="font-display text-lg tracking-wide" style={{ color: primary }}>
              {name.toUpperCase()}
            </span>
            {tagline && (
              <p className="text-xs font-body hidden sm:block" style={{ color: accent }}>
                {tagline}
              </p>
            )}
          </div>
        </div>
        <span className="text-xs text-gray-400 font-body">Secure booking</span>
      </div>
    </header>
  );
}
