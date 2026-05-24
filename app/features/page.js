import Link from "next/link";

export const metadata = {
  title: "Features — KyoriaOS: Real Estate Photography Software",
  description:
    "Explore every feature in KyoriaOS — online booking, team scheduling, payment-gated gallery delivery, service area management, client CRM, and an agent marketing portal. Built for real estate photography businesses.",
};

const FEATURES = [
  {
    href: "/features/booking",
    title: "Booking & Payments",
    desc: "A guided online booking flow that collects deposits at checkout and auto-calculates travel fees — no back-and-forth required.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/features/team-scheduling",
    title: "Team Scheduling",
    desc: "See your whole team's availability at a glance, assign photographers with one click, and sync everyone to Google Calendar.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/features/gallery-delivery",
    title: "Gallery Delivery",
    desc: "Deliver photos, video, floor plans, and 3D tours in one branded link — locked until the balance is paid.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/features/service-areas",
    title: "Service Areas",
    desc: "Draw custom map polygon zones, assign photographers per zone, and let KyoriaOS route new bookings to the right person automatically.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    href: "/features/client-crm",
    title: "Client & Agent CRM",
    desc: "Track lifetime revenue per client, group customers by brokerage, and see your top accounts at a glance.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    href: "/features/agent-portal",
    title: "Agent Portal",
    desc: "Every delivery automatically generates a branded property website, print brochure, and QR code for the listing agent — zero extra work.",
    icon: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
];

export default function FeaturesPage() {
  return (
    <div>
      {/* HERO */}
      <section className="bg-navy text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
            <span className="text-white/75 text-xs">Built for real estate media teams</span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5">
            Every tool your photography business needs,<br className="hidden md:block" /> built into one platform.
          </h1>
          <p className="text-white/55 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            KyoriaOS covers every step of your workflow — from the first online booking to the final payment collected — so you can stop managing software and start running your business.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-colors text-sm"
          >
            Start for free — no credit card needed
          </Link>
        </div>
      </section>

      {/* FEATURE GRID */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">What&apos;s inside</p>
            <h2 className="font-serif text-3xl text-navy font-normal">Six modules. One platform.</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="group bg-gray-50 border border-gray-100 rounded-2xl p-7 hover:border-navy/20 hover:shadow-card-hover transition-all"
              >
                <div className="w-11 h-11 bg-navy/5 border border-navy/10 rounded-xl flex items-center justify-center mb-5 text-navy group-hover:bg-navy group-hover:text-white transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-navy text-base mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-5">{f.desc}</p>
                <span className="text-sm font-medium text-navy/60 group-hover:text-navy transition-colors">
                  Learn more &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="bg-cream py-16 px-6 border-y border-gray-100">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-3xl text-navy font-normal mb-4">
            Ready to see it in action?
          </h2>
          <p className="text-gray-500 mb-7 leading-relaxed">
            Set up your booking page, connect Stripe, and take your first real booking — all within the same afternoon.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-navy text-white font-semibold px-8 py-4 rounded-xl hover:bg-navy/90 transition-colors text-sm"
          >
            Get started free
          </Link>
          <p className="text-gray-400 text-xs mt-4">No contract &middot; Cancel anytime</p>
        </div>
      </section>
    </div>
  );
}
