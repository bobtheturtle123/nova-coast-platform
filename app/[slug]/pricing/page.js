import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";

function fmt(price) {
  const n = Number(price);
  if (!n) return null;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
}

export default async function PricingPage({ params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Business not found.</p>
      </div>
    );
  }

  const [packagesSnap, servicesSnap, addonsSnap] = await Promise.all([
    adminDb.collection("tenants").doc(tenant.id).collection("packages").get(),
    adminDb.collection("tenants").doc(tenant.id).collection("services").get(),
    adminDb.collection("tenants").doc(tenant.id).collection("addons").get(),
  ]);

  const packages = packagesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.active !== false);
  const services = servicesSnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.active !== false);
  const addons   = addonsSnap.docs.map((d)   => ({ id: d.id, ...d.data() })).filter((a) => a.active !== false);

  const primary = tenant.branding?.primaryColor || "#3486cf";
  const accent  = tenant.branding?.accentColor  || "#c9a96e";
  const bizName = tenant.branding?.businessName || tenant.businessName || "";
  const logo    = tenant.branding?.logoUrl || null;

  const bookingUrl = `/${params.slug}/book`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt={bizName} className="h-8 w-auto object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                style={{ background: primary }}>
                {bizName?.[0]?.toUpperCase() || "S"}
              </div>
            )}
            <span className="font-semibold text-gray-900">{bizName}</span>
          </div>
          <a href={bookingUrl}
            className="text-sm font-semibold px-5 py-2 rounded-full text-white transition-opacity hover:opacity-90"
            style={{ background: primary }}>
            Book Now →
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="font-display text-4xl text-gray-900 mb-3">Services & Pricing</h1>
          <p className="text-gray-500 text-lg">Professional real estate media to market your listings.</p>
        </div>

        {/* Packages */}
        {packages.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Packages</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {packages.sort((a, b) => (a.price || 0) - (b.price || 0)).map((pkg) => (
                <div key={pkg.id} className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 text-lg">{pkg.name}</h3>
                    {fmt(pkg.price) && (
                      <span className="font-bold text-xl" style={{ color: primary }}>
                        {fmt(pkg.price)}
                      </span>
                    )}
                  </div>
                  {pkg.description && (
                    <p className="text-sm text-gray-500 leading-relaxed mb-4">{pkg.description}</p>
                  )}
                  {pkg.includes?.length > 0 && (
                    <ul className="space-y-1.5 mb-4">
                      {pkg.includes.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                          <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                  <a href={`${bookingUrl}?package=${pkg.id}`}
                    className="text-sm font-semibold text-white px-4 py-2 rounded-lg inline-block transition-opacity hover:opacity-90"
                    style={{ background: primary }}>
                    Book This Package
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* À la carte services */}
        {services.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">À La Carte Services</h2>
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              {services.sort((a, b) => (a.price || 0) - (b.price || 0)).map((svc) => (
                <div key={svc.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium text-gray-900">{svc.name}</p>
                    {svc.description && <p className="text-sm text-gray-500 mt-0.5">{svc.description}</p>}
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    {fmt(svc.price) ? (
                      <p className="font-semibold text-gray-900">{fmt(svc.price)}</p>
                    ) : (
                      <p className="text-sm text-gray-400">Custom</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Add-ons */}
        {addons.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Add-Ons</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {addons.sort((a, b) => (a.price || 0) - (b.price || 0)).map((addon) => (
                <div key={addon.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{addon.name}</p>
                    {addon.description && <p className="text-xs text-gray-500 mt-0.5">{addon.description}</p>}
                  </div>
                  {fmt(addon.price) ? (
                    <p className="font-semibold text-sm text-gray-900 flex-shrink-0 ml-3">{fmt(addon.price)}</p>
                  ) : (
                    <p className="text-xs text-gray-400 flex-shrink-0 ml-3">Custom</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {packages.length === 0 && services.length === 0 && addons.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">📋</p>
            <p className="font-medium">Pricing coming soon</p>
            <p className="text-sm mt-1">Check back later or contact us directly.</p>
          </div>
        )}

        {/* CTA */}
        <div className="text-center mt-8">
          <p className="text-gray-500 mb-4">Ready to book? We'll confirm your appointment within 24 hours.</p>
          <a href={bookingUrl}
            className="inline-block text-base font-semibold px-8 py-3 rounded-full text-white transition-opacity hover:opacity-90"
            style={{ background: primary }}>
            Request a Booking →
          </a>
        </div>
      </main>

      <footer className="text-center py-8 text-xs text-gray-300 border-t border-gray-100 mt-8">
        Powered by KyoriaOS
      </footer>
    </div>
  );
}
