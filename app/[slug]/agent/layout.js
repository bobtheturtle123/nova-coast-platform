import { getTenantBySlug } from "@/lib/tenants";

export default async function AgentPortalLayout({ children, params }) {
  const tenant = await getTenantBySlug(params.slug);
  const primary = tenant?.branding?.primaryColor || "#0b2a55";
  const accent  = tenant?.branding?.accentColor  || "#c9a96e";
  const name    = tenant?.branding?.businessName || tenant?.businessName || "";
  const logo    = tenant?.branding?.logoUrl || null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt={name} className="h-7 w-auto object-contain" />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ background: primary }}>
                {name?.[0]?.toUpperCase() || "S"}
              </div>
            )}
            <span className="font-semibold text-sm" style={{ color: primary }}>{name}</span>
            <span className="text-gray-300 text-xs">· Agent Portal</span>
          </div>
          <span className="text-xs text-gray-400">Powered by KyoriaOS</span>
        </div>
      </header>
      {children}
    </div>
  );
}
