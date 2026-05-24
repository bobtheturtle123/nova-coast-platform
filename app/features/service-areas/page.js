import Link from "next/link";

export const metadata = {
  title: "Service Area Management for Photography Businesses — KyoriaOS",
  description:
    "Draw custom map zones, assign photographers per coverage area, and let KyoriaOS automatically route new bookings to the right photographer. Built for real estate photography companies.",
};

const FEATURES = [
  "Draw custom polygon zones directly on an interactive map",
  "Assign one or more photographers to each zone",
  "Excluded zones for areas outside your coverage (permit areas, other markets)",
  "Color-coded zones for easy visual identification at a glance",
  "Add notes to each zone (special instructions, pricing exceptions)",
  "Auto-routing on booking surfaces zone-matched photographers first",
  "Guided zone setup during onboarding — live in minutes",
  "Zones update in real time as you add or remove photographers",
];

const CheckIcon = () => (
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
  { href: "/features/client-crm", label: "Client & Agent CRM" },
  { href: "/features/agent-portal", label: "Agent Portal" },
];

export default function ServiceAreasPage() {
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
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Service Areas</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            Map-Based Service Area Management for Photography Businesses
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed mb-8">
            Draw your coverage zones on a map, assign photographers to each one, and let KyoriaOS route incoming bookings to the right person — automatically, every time.
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

      {/* FEATURES LIST */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">What&apos;s included</p>
            <h2 className="font-serif text-3xl text-navy font-normal mb-5">
              Define where you shoot, and who shoots there.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-7">
              Instead of manually checking which photographer covers which neighborhood every time a booking comes in, KyoriaOS does it for you — based on the zones you define on the map.
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
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-card-raised">
              <img
                src="/screenshots/service-areas.png"
                alt="KyoriaOS service area map view with coverage zones"
                className="w-full h-auto block"
              />
            </div>
            <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-card">
              <img
                src="/screenshots/zone-setup.png"
                alt="KyoriaOS new zone setup modal"
                className="w-full h-auto block"
              />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-6 bg-cream">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">How it works</p>
            <h2 className="font-serif text-3xl text-navy font-normal">
              Draw zones once. Dispatch correctly forever.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Draw your coverage zones",
                desc: "Open the service area map and draw polygon zones around the neighborhoods or regions your team covers. Color-code them, add notes, and mark any excluded areas.",
              },
              {
                step: "2",
                title: "Assign photographers per zone",
                desc: "Tag each zone with the photographer or photographers who cover it. One photographer can cover multiple zones, and zones can have multiple photographers.",
              },
              {
                step: "3",
                title: "Route jobs automatically",
                desc: "When a new booking comes in, KyoriaOS identifies the matching zone and surfaces the right photographers first in your dispatch view. No manual cross-referencing.",
              },
            ].map((s) => (
              <div key={s.step} className="bg-white border border-gray-100 rounded-2xl p-7">
                <div className="w-9 h-9 rounded-full bg-navy text-white font-bold text-sm flex items-center justify-center mb-5">
                  {s.step}
                </div>
                <h3 className="font-semibold text-navy text-base mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TEAM SCHEDULING TIE-IN */}
      <section className="py-14 px-6 bg-white border-y border-gray-100">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Works with Team Scheduling</p>
            <h2 className="font-serif text-2xl text-navy font-normal mb-3">
              Zones power smarter dispatch.
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Service area zones feed directly into the team scheduling view. When you go to assign a photographer for a job, the system already knows who covers that address and puts them at the top of the list.
            </p>
          </div>
          <Link
            href="/features/team-scheduling"
            className="flex-shrink-0 bg-navy text-white font-semibold px-6 py-3 rounded-xl hover:bg-navy/90 transition-colors text-sm"
          >
            See Team Scheduling &rarr;
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Get started today</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Stop manually routing every job. Set up your zones today.
          </h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Draw your coverage zones during onboarding and start dispatching smarter from day one.
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
