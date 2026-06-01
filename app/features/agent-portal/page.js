import Link from "next/link";

export const metadata = {
  title: "Agent Marketing Portal for Real Estate Photographers — KyoriaOS",
  description:
    "KyoriaOS automatically generates a branded property website, print-ready PDF brochure, and QR code for every real estate listing you photograph. Zero extra work — it happens at delivery.",
  alternates: { canonical: "https://kyoriaos.com/features/agent-portal" },
};

const FEATURES = [
  "Branded property website auto-generated with listing details and all media",
  "Print-ready PDF brochure for open houses, generated automatically",
  "QR code for yard signs and print materials, unique to each listing",
  "Private link — agents access everything without creating an account",
  "Photos, video, and 3D Matterport tour all in one agent-facing view",
  "MLS-ready download packages sized and labeled for easy upload",
  "Fully mobile responsive — agents can share directly from their phone",
  "Every delivery auto-generates the kit — no extra step on your end",
];

const CheckIcon = () => (
  <span className="w-4 h-4 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center flex-shrink-0 mt-0.5">
    <svg width="7" height="7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" className="text-gold">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </span>
);

const CheckIconLight = () => (
  <span className="w-4 h-4 rounded-full bg-navy/8 flex items-center justify-center flex-shrink-0 mt-0.5">
    <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" className="text-navy">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </span>
);

const OTHER_FEATURES = [
  { href: "/features/booking", label: "Booking & Payments" },
  { href: "/features/team-scheduling", label: "Team Scheduling" },
  { href: "/features/gallery-delivery", label: "Gallery Delivery" },
  { href: "/features/service-areas", label: "Service Areas" },
  { href: "/features/client-crm", label: "Client & Agent CRM" },
];

export default function AgentPortalPage() {
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
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Agent Portal</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            Automatic Agent Marketing Kits — Every Delivery, Without Extra Work
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed mb-8">
            When you deliver a gallery, the agent automatically gets a branded property website, a print brochure, and a QR code for their sign. No extra steps on your end — ever.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/auth/register"
              className="inline-block bg-gold text-navy font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-colors text-sm text-center"
            >
              Start for free
            </Link>
            <Link
              href="/auth/login"
              className="inline-block border border-white/20 text-white/75 px-8 py-4 rounded-xl hover:bg-white/5 transition-colors text-sm text-center"
            >
              Sign in to your account
            </Link>
          </div>
          <p className="text-white/25 text-xs mt-4">No credit card required &middot; Live in under an hour</p>
        </div>
      </section>

      {/* FEATURES LIST — navy bg to match homepage agent portal section */}
      <section className="py-20 px-6 bg-navy">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">What agents receive</p>
            <h2 className="font-serif text-3xl text-white font-normal mb-5">
              A professional listing kit that makes agents book you again.
            </h2>
            <p className="text-white/50 leading-relaxed mb-7">
              Agents stay loyal to photographers who make their job easier. The agent portal gives every client a reason to keep coming back — without you doing a single extra thing.
            </p>
            <ul className="space-y-3">
              {FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-white/70">
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          {/* Agent portal mockup */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center flex-shrink-0">
                <span className="text-gold text-sm font-bold">S</span>
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Sarah Chen &middot; Compass Realty</p>
                <p className="text-xs text-white/35">1842 Ocean View Dr, Coronado CA</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                {
                  icon: (
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  ),
                  label: "Gallery",
                  sub: "48 photos",
                },
                {
                  icon: (
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  ),
                  label: "Website",
                  sub: "Share link",
                },
                {
                  icon: (
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ),
                  label: "Brochure",
                  sub: "Print ready",
                },
              ].map((c) => (
                <div key={c.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center h-7 mb-1.5 text-white/60">{c.icon}</div>
                  <p className="text-xs font-semibold text-white/75">{c.label}</p>
                  <p className="text-[10px] text-white/30">{c.sub}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <div>
                <p className="text-xs font-semibold text-white/75">QR Code</p>
                <p className="text-[10px] text-white/35">For yard sign &middot; Download PNG</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHY IT MATTERS */}
      <section className="py-20 px-6 bg-cream">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Why it matters</p>
            <h2 className="font-serif text-3xl text-navy font-normal">
              A reason for every agent to book you again.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: "You become more than a photographer",
                desc: "When an agent gets a branded website, brochure, and QR code with every shoot — automatically — you stop being a vendor and start being a partner. That shift means repeat business.",
              },
              {
                title: "Agents share your work for you",
                desc: "The property website and QR code travel everywhere the agent's listing does — open houses, print flyers, Instagram, MLS listings. Your work gets seen by every future client they have.",
              },
              {
                title: "No account required for agents",
                desc: "Agents access everything through a private link — no login, no password, no learning curve. They click the link, grab the files, share the site. Done.",
              },
              {
                title: "Zero extra work on your end",
                desc: "The kit is generated automatically when you deliver a gallery. You don't touch it. The agent doesn't ask for it. It's just there, every single time.",
              },
            ].map((c) => (
              <div key={c.title} className="bg-white border border-gray-100 rounded-2xl p-7">
                <h3 className="font-semibold text-navy text-base mb-3">{c.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Get started today</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Give every agent a reason to come back.
          </h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            The agent portal turns every delivery into a retention tool — automatically. Start today and it&apos;s live with your first order.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-10 py-4 rounded-xl hover:bg-gold/90 transition-colors"
          >
            Start for free &rarr;
          </Link>
          <p className="text-white/25 text-xs mt-4">No contract &middot; Cancel anytime</p>
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
