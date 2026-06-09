import Link from "next/link";

export const metadata = {
  title: "Online Booking Software for Real Estate Photographers - KyoriaOS",
  description:
    "KyoriaOS is the best online booking software for real estate photographers. Collect deposits at checkout, auto-calculate travel fees, send automatic reminders, and embed your booking page on any website.",
};

const FEATURES = [
  "Guided multi-step booking flow with package selection and upsells",
  "Deposit collected at checkout via Stripe - no chasing required",
  "Automatic travel fee calculation based on property address",
  "Real-time availability calendar blocks double-bookings",
  "Automated email and SMS reminders to client and photographer",
  "Add-on upsells (twilight, floor plan, video) built into checkout",
  "Embeddable on your existing website with a single link",
  "Service agreement capture at the point of booking",
];

const CheckIcon = () => (
  <span className="w-4 h-4 rounded-full bg-navy/8 flex items-center justify-center flex-shrink-0 mt-0.5">
    <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" className="text-navy">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  </span>
);

const OTHER_FEATURES = [
  { href: "/features/team-scheduling", label: "Team Scheduling" },
  { href: "/features/gallery-delivery", label: "Gallery Delivery" },
  { href: "/features/service-areas", label: "Service Areas" },
  { href: "/features/client-crm", label: "Client & Agent CRM" },
  { href: "/features/agent-portal", label: "Agent Portal" },
];

export default function BookingPage() {
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
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Booking &amp; Payments</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            Online Booking Software Built for Real Estate Photographers
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed mb-8">
            Replace the back-and-forth texts with a professional booking flow that collects the deposit, confirms the appointment, and notifies everyone - all without you lifting a finger.
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
              Everything a photographer needs at checkout.
            </h2>
            <p className="text-gray-500 leading-relaxed mb-7">
              Your clients get a smooth, professional booking experience. You get a confirmed appointment and a deposit in your account - automatically.
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
              alt="KyoriaOS booking and schedule view"
              className="w-full h-auto block"
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20 px-6 bg-cream">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">How it works</p>
            <h2 className="font-serif text-3xl text-navy font-normal">
              From inquiry to confirmed shoot in three steps.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "1",
                title: "Client visits your booking page",
                desc: "Share your booking link - or embed it on your website. Clients pick their package, select a date from your live availability, and enter property details.",
              },
              {
                step: "2",
                title: "Deposit collected at checkout",
                desc: "Stripe processes the deposit before the appointment is confirmed. No invoice needed, no follow-up required. The money is in your account immediately.",
              },
              {
                step: "3",
                title: "Everyone gets notified automatically",
                desc: "You, your photographer, and the client all receive confirmation emails. Automated reminders go out the day before and morning of the shoot.",
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

      {/* CTA */}
      <section className="bg-navy py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Get started today</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Your first booking, collected and confirmed - today.
          </h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Set up your booking page, connect Stripe, and go live in under an hour. No developer needed.
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
