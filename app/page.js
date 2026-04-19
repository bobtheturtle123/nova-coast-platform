import Link from "next/link";
import PricingSection from "@/components/PricingSection";

export const metadata = {
  title: "NovaOS — The all-in-one platform for real estate photographers",
  description:
    "Booking, payments, and gallery delivery built for real estate photographers. Replace Aryeo in minutes.",
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white font-body">
      {/* NAV */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-display text-navy text-xl tracking-wide">NovaOS</span>
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#features" className="hover:text-navy transition-colors">Features</a>
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
            Built for photographers who want to scale
          </p>
          <h1 className="font-display text-5xl md:text-6xl leading-tight mb-6">
            Increase your revenue<br />on every shoot.
          </h1>
          <p className="text-white/70 text-lg max-w-2xl mx-auto mb-10">
            Turn your booking flow into a revenue engine with built-in upsells,
            deposits, and payment unlocks — all in one platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register"
              className="bg-gold text-navy font-semibold px-8 py-4 rounded-sm hover:bg-gold/90 transition-colors text-center">
              Start your 14-day free trial
            </Link>
            <a href="#pricing"
              className="border border-white/30 text-white px-8 py-4 rounded-sm hover:bg-white/5 transition-colors text-center">
              See pricing
            </a>
          </div>
          <p className="text-white/40 text-xs mt-4">No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* SOCIAL PROOF BAR */}
      <div className="bg-cream border-y border-gray-100 py-6 px-6">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 text-center text-sm text-gray-500">
          {["Branded booking pages", "Deposits accepted at booking", "Secure media galleries", "Balance payment on delivery", "Stripe Connect payouts"].map((f) => (
            <span key={f} className="flex items-center gap-2">
              <span className="text-gold">✓</span> {f}
            </span>
          ))}
        </div>
      </div>

      {/* REVENUE PITCH */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-4xl text-navy mb-6">Make more on every booking.</h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
            Most platforms just manage your business. NovaOS helps you grow it.
          </p>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed mt-3">
            Clients select services and add-ons through a guided booking flow designed to
            increase order value automatically.
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6 bg-cream">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl text-navy mb-4">
              Everything you need. Nothing you don't.
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Built specifically for real estate photographers who want to look professional
              and get paid on time — without paying Aryeo prices.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-8 border border-gray-100 rounded-sm hover:border-gold/30 transition-colors">
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-display text-xl text-navy mb-3">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-cream py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl text-navy mb-4">Live in under 10 minutes</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.title} className="text-center">
                <div className="w-10 h-10 bg-navy text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-4">
                  {i + 1}
                </div>
                <h3 className="font-display text-lg text-navy mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <PricingSection />

      {/* CTA */}
      <section className="bg-navy py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-4xl text-white mb-4">Start increasing your revenue per shoot.</h2>
          <p className="text-white/60 mb-8">
            Set up your booking page in minutes. Starts at $39/mo after your free trial.
          </p>
          <Link href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-10 py-4 rounded-sm hover:bg-gold/90 transition-colors">
            Get started free
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-navy border-t border-white/10 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-white/40 text-xs">
          <span>© {new Date().getFullYear()} NovaOS. All rights reserved.</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white/70 transition-colors">Privacy</a>
            <a href="#" className="hover:text-white/70 transition-colors">Terms</a>
            <a href="mailto:hello@nova-os.app" className="hover:text-white/70 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const FEATURES = [
  { icon: "📅", title: "Booking that increases order value", desc: "Clients move through a guided flow — package, add-ons, property details, and payment — designed to maximize what they spend." },
  { icon: "💳", title: "Get paid upfront, every time", desc: "Collect a deposit the moment a client books. Configurable per shoot type. Funds go directly to your Stripe account." },
  { icon: "🖼️", title: "Get paid before clients download", desc: "Media stays locked until the balance is paid. One click to deliver and collect — no chasing invoices." },
  { icon: "✉️", title: "Automated Email Workflows", desc: "Booking confirmations, shoot approvals, gallery delivery, and payment reminders — all sent automatically." },
  { icon: "📊", title: "Booking Dashboard", desc: "Track every shoot from requested → confirmed → delivered. Know exactly what's outstanding at a glance." },
  { icon: "⚡", title: "Fast Payouts via Stripe", desc: "Stripe Connect routes client payments straight to your bank. No manual invoicing. No waiting." },
];

const STEPS = [
  { title: "Create your account", desc: "Sign up with your business name and email. Your booking page is created instantly." },
  { title: "Connect Stripe", desc: "Link your Stripe account so client deposits and balances flow directly to you." },
  { title: "Share your booking link", desc: "Send agents your unique link. They book, pay a deposit, and you confirm the shoot." },
];

