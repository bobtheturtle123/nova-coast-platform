import Link from "next/link";

export const metadata = {
  title: "Photography Team Scheduling Software — KyoriaOS",
  description:
    "KyoriaOS is the best team scheduling and photographer dispatch software for real estate photography businesses. See availability, assign jobs with one click, and sync everyone to Google Calendar.",
  alternates: { canonical: "https://kyoriaos.com/features/team-scheduling" },
};

const FEATURES = [
  "2-week availability grid shows every photographer's open slots at a glance",
  "Zone-based photographer suggestions route jobs to the right person automatically",
  "One-click assign with instant SMS and email notification to photographer",
  "Block time off for individual photographers without affecting the team calendar",
  "Google Calendar two-way sync keeps every photographer's personal calendar current",
  "Multi-view calendar: daily, weekly, and monthly team overview",
  "Photographer portal login so contractors see only their own jobs",
  "Per-shoot pay rate tracking for accurate contractor cost reporting",
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
  { href: "/features/gallery-delivery", label: "Gallery Delivery" },
  { href: "/features/service-areas", label: "Service Areas" },
  { href: "/features/client-crm", label: "Client & Agent CRM" },
  { href: "/features/agent-portal", label: "Agent Portal" },
];

export default function TeamSchedulingPage() {
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
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Team Scheduling</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            Team Scheduling &amp; Photographer Dispatch — Built for Growing Photo Teams
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed mb-8">
            Stop coordinating your photographers over group texts. See availability, assign jobs, and dispatch your whole crew from a single dashboard view.
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

      {/* FEATURES LIST + SCREENSHOT */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">What&apos;s included</p>
            <h2 className="font-serif text-3xl text-navy font-normal mb-5">
              Your whole team in one place — no group chat needed.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-7">
              KyoriaOS gives you a complete view of your team&apos;s availability, lets you assign photographers to jobs with one click, and keeps everyone notified automatically.
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
          <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-card-raised">
            <img
              src="/screenshots/schedule.png"
              alt="KyoriaOS team scheduling and dispatch view"
              className="w-full h-auto block"
            />
          </div>
        </div>
      </section>

      {/* SERVICE AREAS TIE-IN */}
      <section className="py-14 px-6 bg-cream border-y border-gray-100">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Works with Service Areas</p>
            <h2 className="font-serif text-2xl text-navy font-normal mb-3">
              Zone routing makes dispatch even faster.
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              When your service area zones are set up, KyoriaOS automatically surfaces the photographers who cover a given property address first — so you always assign the right person, not just the nearest available one.
            </p>
          </div>
          <Link
            href="/features/service-areas"
            className="flex-shrink-0 bg-navy text-white font-semibold px-6 py-3 rounded-xl hover:bg-navy/90 transition-colors text-sm"
          >
            See Service Area Management &rarr;
          </Link>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">How it works</p>
            <h2 className="font-serif text-3xl text-navy font-normal">
              From booking to dispatched in under a minute.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Booking comes in",
                desc: "When a client books a shoot, KyoriaOS immediately shows you which photographers cover the property address and have an open slot at the requested time.",
              },
              {
                step: "2",
                title: "Assign with one click",
                desc: "Tap a photographer's name to assign them. They get an instant SMS and email with the address, time, and job details. No group text, no forwarding.",
              },
              {
                step: "3",
                title: "Calendar stays current",
                desc: "The shoot appears on the team calendar and syncs to the photographer's Google Calendar automatically. Reminders go out the day before. No manual follow-up.",
              },
            ].map((s) => (
              <div key={s.step} className="bg-gray-50 border border-gray-100 rounded-2xl p-7">
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

      {/* CTA */}
      <section className="bg-navy py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Get started today</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Your team, running like a real operation.
          </h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Invite your photographers, set up their zones, and dispatch your first job — all in the same session.
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
