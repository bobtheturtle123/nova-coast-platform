import Link from "next/link";

export const metadata = {
  title: "Client and Agent Portal for Real Estate Photographers - Kyoria OS",
  description:
    "Give every client and agent their own portal to view job history, download galleries, and track orders. A professional experience that sets you apart from photographers who still email zip files.",
  alternates: { canonical: "https://kyoriaos.com/features/client-portal" },
};

const FEATURES = [
  "Every client gets a dedicated portal with their full order history",
  "Agents access all their listings and galleries from one login",
  "Gallery download links gated behind payment confirmation",
  "Booking history, invoices, and status updates in one place",
  "Branded experience that matches your business",
  "No app downloads required - works in any browser",
  "Automatic gallery delivery notification on job completion",
  "Agents can share gallery access directly with their teams",
];

const CheckIcon = () => (
  <span className="w-4 h-4 rounded-full bg-navy/8 flex items-center justify-center flex-shrink-0 mt-0.5">
    <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" className="text-navy">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </span>
);

const OTHER_FEATURES = [
  { href: "/features/booking-scheduling", label: "Booking and Scheduling" },
  { href: "/features/gallery-delivery", label: "Gallery Delivery" },
  { href: "/features/team-management", label: "Team Management" },
  { href: "/features/payments-automation", label: "Payments and Automation" },
  { href: "/features/service-areas", label: "Service Areas" },
];

export default function ClientPortalPage() {
  return (
    <div>

      {/* HERO */}
      <section className="bg-navy text-white py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <Link href="/features" className="text-white/40 text-xs hover:text-white/65 transition-colors">
              &larr; All Features
            </Link>
          </div>
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Client and Agent Portal</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            A Professional Experience Your Clients Will Remember
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed mb-8">
            Every client gets their own portal to track orders, download galleries, and view invoices. Agents get a single login for every listing they have ever booked with you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/auth/register"
              className="inline-block bg-gold text-navy font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-colors text-sm text-center"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="inline-block border border-white/20 text-white/75 px-8 py-4 rounded-xl hover:bg-white/5 transition-colors text-sm text-center"
            >
              Sign in to your account
            </Link>
          </div>
          <p className="text-white/25 text-xs mt-4">From $79/month &middot; No contracts &middot; Cancel anytime</p>
        </div>
      </section>

      {/* FEATURES LIST */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">What&apos;s included</p>
            <h2 className="font-serif text-3xl text-navy font-normal mb-5">
              Stop emailing zip files. Give clients a real portal.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-7">
              Photographers who deliver via email look like hobbyists. Kyoria OS gives every client and agent a dedicated portal that makes your business look like the professional operation it is.
            </p>
            <ul className="space-y-3">
              {FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Portal mockup */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-gray-800">Sarah Nguyen</p>
                <p className="text-[10px] text-gray-400">Coastal Premier Realty</p>
              </div>
              <span className="text-[9px] text-navy bg-navy/5 border border-navy/10 px-2 py-0.5 rounded-full font-semibold">
                Agent Portal
              </span>
            </div>
            <div className="space-y-2">
              {[
                { addr: "2847 Coastal Ridge Dr", status: "Gallery Ready", badge: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                { addr: "105 Harbor View Pl", status: "Shoot Scheduled", badge: "text-blue-600 bg-blue-50 border-blue-100" },
                { addr: "418 Sunset Blvd", status: "Gallery Ready", badge: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                { addr: "7 Oceanfront Dr", status: "Payment Pending", badge: "text-amber-600 bg-amber-50 border-amber-100" },
              ].map((r) => (
                <div key={r.addr} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <p className="flex-1 text-xs text-gray-700 truncate">{r.addr}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border flex-shrink-0 ${r.badge}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 text-center">4 listings &middot; 2 galleries ready for download</p>
            </div>
          </div>
        </div>
      </section>

      {/* THREE-COLUMN CALLOUT */}
      <section className="py-16 px-6 bg-cream border-y border-gray-100">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            {
              icon: (
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              ),
              title: "One login for every listing",
              desc: "Agents see all their jobs and galleries in one place. No digging through emails for download links.",
            },
            {
              icon: (
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              ),
              title: "Payment-gated downloads",
              desc: "Gallery access unlocks automatically when the balance clears through Stripe. No manual release.",
            },
            {
              icon: (
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              ),
              title: "Full order history",
              desc: "Clients can view past bookings, invoices, and delivery status any time they need it.",
            },
          ].map((c) => (
            <div key={c.title} className="bg-white border border-gray-100 rounded-2xl p-6">
              <div className="w-10 h-10 bg-navy/5 border border-navy/10 rounded-xl flex items-center justify-center mb-4 text-navy">
                {c.icon}
              </div>
              <h3 className="font-semibold text-navy text-sm mb-2">{c.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Elevate your client experience</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Give your clients and agents the experience they expect.
          </h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Portals are live the moment a booking is created. No setup, no configuration.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-10 py-4 rounded-xl hover:bg-gold/90 transition-colors"
          >
            Get Started
          </Link>
          <p className="text-white/25 text-xs mt-4">No contract &middot; Cancel anytime</p>
        </div>
      </section>

      {/* BLOG LINKS */}
      <section className="bg-cream py-12 px-6 border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-5 font-semibold text-center">Related reading</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/blog/real-estate-photography-client-experience" className="text-sm text-gray-600 border border-gray-200 rounded-xl px-4 py-2 hover:border-navy/30 hover:text-navy transition-colors bg-white">
              How to create a professional client experience
            </Link>
            <Link href="/blog/best-software-real-estate-photographers-2026" className="text-sm text-gray-600 border border-gray-200 rounded-xl px-4 py-2 hover:border-navy/30 hover:text-navy transition-colors bg-white">
              Best software for real estate photographers in 2026
            </Link>
          </div>
        </div>
      </section>

      {/* OTHER FEATURES NAV */}
      <section className="bg-white py-10 px-6 border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-5 font-semibold text-center">Explore more features</p>
          <div className="flex flex-wrap justify-center gap-3">
            {OTHER_FEATURES.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="text-sm text-gray-600 border border-gray-200 rounded-xl px-4 py-2 hover:border-navy/30 hover:text-navy transition-colors"
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
