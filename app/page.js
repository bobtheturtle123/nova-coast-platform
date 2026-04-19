import Link from "next/link";
import PricingSection from "@/components/PricingSection";

export const metadata = {
  title: "ShootFlow: Business software built for real estate photographers",
  description:
    "Booking, payments, and media delivery built for real estate photography businesses. Get paid faster, deliver faster, grow faster.",
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white font-body">
      {/* NAV */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-display text-navy text-xl tracking-wide">ShootFlow</span>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-navy transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-navy transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-navy transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-navy px-3 py-2 transition-colors">
              Sign in
            </Link>
            <Link href="/auth/register"
              className="text-sm bg-navy text-white px-4 py-2 rounded-sm hover:bg-navy/90 transition-colors font-medium">
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-navy text-white pt-24 pb-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gold text-xs tracking-[0.2em] uppercase font-body mb-4">
            Built for real estate photographers and media teams
          </p>
          <h1 className="font-serif text-5xl md:text-6xl leading-tight mb-6 font-normal">
            Run your business.<br />Get paid faster.
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-10">
            ShootFlow handles booking, deposits, media delivery, and payment collection,
            so you spend less time on admin and more time shooting.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register"
              className="bg-gold text-navy font-semibold px-8 py-4 rounded-sm hover:bg-gold/90 transition-colors text-center">
              Start your 14-day free trial
            </Link>
            <a href="#features"
              className="border border-white/30 text-white px-8 py-4 rounded-sm hover:bg-white/5 transition-colors text-center">
              See how it works
            </a>
          </div>
          <p className="text-white/40 text-xs mt-4">No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="bg-cream border-y border-gray-100 py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 text-center text-sm text-gray-500">
          {[
            "Branded booking pages",
            "Deposits collected at booking",
            "Media locked until payment",
            "Automatic balance collection",
            "Direct Stripe payouts",
          ].map((f) => (
            <span key={f} className="flex items-center gap-2">
              <span className="text-gold">✓</span> {f}
            </span>
          ))}
        </div>
      </div>

      {/* REVENUE PITCH */}
      <section className="py-28 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-4xl text-navy mb-6 font-normal">Every booking should work harder for you.</h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
            Most tools track your work. ShootFlow is designed to increase the value of it.
          </p>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed mt-3">
            A guided booking flow walks clients through packages, add-ons, and payment,
            raising your average order without any extra effort on your end.
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-32 px-6 bg-cream">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl text-navy mb-4 font-normal">
              The complete operating system for your photography business.
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Built from the ground up for real estate photographers and media teams,
              not adapted from generic software.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-8 border border-transparent rounded-sm hover:border-gray-200 hover:bg-white transition-all duration-300 bg-cream/60">
                <div className="text-2xl mb-5">{f.icon}</div>
                <h3 className="font-serif text-xl text-navy mb-3 font-normal">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="bg-white py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl text-navy mb-4 font-normal">Up and running in minutes.</h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              No lengthy onboarding. No setup fees. Your booking page goes live the day you sign up.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.title} className="text-center">
                <div className="w-10 h-10 bg-navy text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-4">
                  {i + 1}
                </div>
                <h3 className="font-serif text-lg text-navy mb-2 font-normal">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <PricingSection />

      {/* CTA */}
      <section className="bg-navy py-28 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-serif text-4xl text-white mb-4 font-normal">Your business, running on autopilot.</h2>
          <p className="text-white/60 mb-8 text-lg">
            Booking, payment collection, and media delivery, fully automated, starting at $39/mo.
          </p>
          <Link href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-10 py-4 rounded-sm hover:bg-gold/90 transition-colors">
            Start free, no credit card needed
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-navy border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-white/40 text-xs">
          <span>© {new Date().getFullYear()} ShootFlow. All rights reserved.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white/70 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/70 transition-colors">Terms</a>
            <a href="mailto:hello@shootflow.app" className="hover:text-white/70 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: "📅",
    title: "Booking that sells for you",
    desc: "Clients move through a guided flow, packages, add-ons, property details, payment, designed to raise average order value without any extra selling on your part.",
  },
  {
    icon: "💳",
    title: "Deposits collected at booking",
    desc: "Every booking locks in a deposit the moment it's confirmed. Configurable per service type. Funds route directly to your Stripe account.",
  },
  {
    icon: "🖼️",
    title: "Media locked until balance is paid",
    desc: "Clients can preview their gallery but can't download until the balance clears. One click to deliver, payment collected automatically.",
  },
  {
    icon: "✉️",
    title: "Automated communication",
    desc: "Confirmations, reminders, delivery notices, and balance-due emails go out automatically, all branded to your business.",
  },
  {
    icon: "📊",
    title: "Full shoot visibility",
    desc: "Every shoot moves through a clear status pipeline: requested → confirmed → shot → delivered. Nothing falls through the cracks.",
  },
  {
    icon: "🏡",
    title: "Client marketing tools, built in",
    desc: "Every delivered shoot includes a private portal for your client, property website, digital brochure, and AI-generated social captions, ready to share.",
  },
];

const STEPS = [
  {
    title: "Create your account",
    desc: "Sign up with your business name and email. Your branded booking page is live immediately.",
  },
  {
    title: "Connect Stripe",
    desc: "Link your Stripe account in minutes. Deposits and balances flow directly to your bank, no manual transfers.",
  },
  {
    title: "Start taking bookings",
    desc: "Share your booking link. Clients choose their services, pay a deposit, and you get notified instantly.",
  },
];
