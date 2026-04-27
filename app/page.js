import Link from "next/link";
import PricingSection from "@/components/PricingSection";

export const metadata = {
  title: "ShootFlow: Business software built for real estate photographers",
  description:
    "Booking, payments, galleries, and agent marketing tools. The complete operating system for real estate photography businesses.",
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
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-navy px-3 py-2 transition-colors">Sign in</Link>
            <Link href="/auth/register"
              className="text-sm bg-navy text-white px-4 py-2 rounded-sm hover:bg-navy/90 transition-colors font-medium">
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="bg-navy text-white pt-20 pb-0 px-6 overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-end">
            <div className="py-12">
              <p className="text-gold text-xs tracking-[0.2em] uppercase font-body mb-4">
                Made by media teams, for media teams
              </p>
              <h1 className="font-serif text-5xl md:text-6xl leading-tight mb-6 font-normal text-white">
                Run your business.<br />Get paid faster.
              </h1>
              <p className="text-white/70 text-lg max-w-xl leading-relaxed mb-10">
                Booking, deposits, media delivery, and balance collection handled automatically.
                Spend less time chasing invoices and more time shooting.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/auth/register"
                  className="bg-gold text-navy font-semibold px-8 py-4 rounded-sm hover:bg-gold/90 transition-colors text-center">
                  Start your 14-day free trial
                </Link>
                <a href="#features"
                  className="border border-white/30 text-white px-8 py-4 rounded-sm hover:bg-white/5 transition-colors text-center">
                  See what's included
                </a>
              </div>
              <p className="text-white/40 text-xs mt-4">No credit card required · Cancel anytime · Live in under an hour</p>
            </div>

            {/* Mock dashboard panel */}
            <div className="relative pb-0 hidden md:block">
              <div className="bg-white/5 border border-white/10 rounded-t-xl overflow-hidden shadow-2xl">
                <div className="bg-white/8 px-4 py-2.5 flex items-center gap-2 border-b border-white/10">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  </div>
                  <div className="flex-1 bg-white/10 rounded text-white/30 text-[10px] px-3 py-1 text-center">
                    app.shootflow.com/dashboard
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Listings", value: "47", cls: "bg-white/8 border-white/10", val: "text-white" },
                      { label: "Pending", value: "3",   cls: "bg-amber-500/20 border-amber-400/20", val: "text-amber-300" },
                      { label: "Active",  value: "8",   cls: "bg-emerald-500/15 border-emerald-400/15", val: "text-emerald-300" },
                      { label: "Revenue", value: "$12k", cls: "bg-yellow-500/15 border-yellow-400/20", val: "text-yellow-300" },
                    ].map((s) => (
                      <div key={s.label} className={`rounded-lg p-2.5 border ${s.cls}`}>
                        <p className="text-white/40 text-[9px] uppercase tracking-wide mb-1">{s.label}</p>
                        <p className={`font-semibold text-sm ${s.val}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white/8 rounded-lg border border-white/10 overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/8">
                      <p className="text-white/50 text-[10px] font-semibold uppercase tracking-wide">Recent Listings</p>
                    </div>
                    {[
                      { addr: "1842 Ocean View Dr, Coronado", status: "Delivered", badge: "text-emerald-300 bg-emerald-500/20" },
                      { addr: "3310 Maple Ave, La Jolla",     status: "Confirmed", badge: "text-blue-300 bg-blue-500/20" },
                      { addr: "905 Harbor Blvd, Del Mar",     status: "Pending",   badge: "text-amber-300 bg-amber-500/20" },
                    ].map((l) => (
                      <div key={l.addr} className="px-3 py-2 flex items-center justify-between border-b border-white/5 last:border-0">
                        <p className="text-white/70 text-[11px] truncate max-w-[130px]">{l.addr}</p>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${l.badge}`}>{l.status}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-yellow-500/15 border border-yellow-400/20 rounded-lg px-3 py-2 flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-yellow-400/30 flex items-center justify-center flex-shrink-0">
                      <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-yellow-300"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </div>
                    <p className="text-yellow-300/80 text-[10px]">Booking page live · 3 new inquiries today</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="bg-cream border-y border-gray-100 py-5 px-6">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-6 text-center text-sm text-gray-500">
          {["Branded booking pages","Deposit collected at booking","Media locked until balance paid","Service areas & travel fees","Direct Stripe payouts","Agent marketing portal + AI captions"].map((f) => (
            <span key={f} className="flex items-center gap-2"><span className="text-gold">✓</span> {f}</span>
          ))}
        </div>
      </div>

      {/* BEFORE / AFTER */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-serif text-4xl text-navy mb-4 font-normal">Before and after</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Stop managing your business in a mess of texts and spreadsheets.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-7">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-5">Without ShootFlow</p>
              <ul className="space-y-3">
                {[
                  "Chase clients for deposits over text",
                  "Email gallery links manually after delivery",
                  "Chase balances manually after delivery",
                  "Build pricing tables in Google Docs",
                  "No record of what each shoot made",
                  "Clients lose links to view their media",
                  "No marketing tools for agents to share",
                  "Manually create invoices one by one",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                    <span className="text-red-300 mt-0.5 flex-shrink-0">✕</span>{item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-navy/10 rounded-xl p-7" style={{ background: "rgba(11,42,85,0.03)" }}>
              <p className="text-xs font-semibold text-emerald-500 uppercase tracking-widest mb-5">With ShootFlow</p>
              <ul className="space-y-3">
                {[
                  "Deposit collected the moment they book",
                  "Gallery delivered with one click",
                  "Balance auto-collected before download",
                  "Guided booking flow upsells for you",
                  "Full revenue breakdown per listing",
                  "Token-based links, no login needed",
                  "Agent portal: website, QR code & captions",
                  "Confirmations, reminders & invoices automated",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="text-emerald-500 mt-0.5 flex-shrink-0">✓</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES GRID */}
      <section id="features" className="py-28 px-6 bg-cream">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl text-navy mb-4 font-normal">Everything you need, nothing you don't.</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              Built from the ground up for real estate photographers, not adapted from generic software.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-xl border border-gray-100 p-7 hover:shadow-md transition-all duration-300">
                <div className="text-2xl mb-4">{f.icon}</div>
                <h3 className="font-serif text-lg text-navy mb-2 font-normal">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4">{f.desc}</p>
                <ul className="space-y-1.5">
                  {f.bullets.map((b) => (
                    <li key={b} className="text-xs text-gray-400 flex items-start gap-2">
                      <span className="text-gold mt-0.5 flex-shrink-0">→</span>{b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AGENT PORTAL SPOTLIGHT */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-14 items-center">
            <div>
              <p className="text-gold text-xs tracking-[0.2em] uppercase font-body mb-3">Agent marketing portal</p>
              <h2 className="font-serif text-4xl text-navy mb-5 font-normal">Every agent gets a professional listing kit.</h2>
              <p className="text-gray-500 leading-relaxed mb-6">
                Automatically delivered with every gallery. No extra work on your end. Agents get everything they need to market the listing, all in one link.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Branded property website with full details",
                  "Print-ready brochure (PDF)",
                  "QR code for open houses and print marketing",
                  "AI-generated Instagram, Facebook & email captions",
                  "3D Matterport tour embedded in-browser",
                  "One-click gallery access, no login needed",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-navy flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register"
                className="inline-block bg-navy text-white font-semibold px-7 py-3 rounded-sm hover:bg-navy/90 transition-colors text-sm">
                Start free trial →
              </Link>
            </div>
            <div className="bg-gray-50 rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center">
                  <span className="text-white text-sm font-bold">S</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Sarah Chen · Compass Realty</p>
                  <p className="text-xs text-gray-400">1842 Ocean View Dr, Coronado CA</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[{ icon: "🖼️", label: "Gallery", sub: "48 photos" },{ icon: "🏡", label: "Website", sub: "Share link" },{ icon: "📋", label: "Brochure", sub: "Print ready" }].map((c) => (
                  <div key={c.label} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                    <div className="text-xl mb-1">{c.icon}</div>
                    <p className="text-xs font-semibold text-gray-700">{c.label}</p>
                    <p className="text-[10px] text-gray-400">{c.sub}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">✨ AI Social Caption</p>
                <p className="text-xs text-gray-600 italic leading-relaxed">"Just listed! 4BR/3BA in Coronado with ocean views. Stunning photography, swipe to see every detail. Link in bio to book a showing. 🏡"</p>
                <div className="mt-2 text-[10px] text-navy font-semibold border border-navy/20 rounded px-2 py-1 inline-block">Copy →</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="bg-cream py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl text-navy mb-4 font-normal">Up and running in minutes.</h2>
            <p className="text-gray-500 max-w-lg mx-auto">No lengthy onboarding. No setup fees. Your booking page goes live the day you sign up.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.title} className="text-center">
                <div className="w-10 h-10 bg-navy text-white rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-4">{i + 1}</div>
                <h3 className="font-serif text-base text-navy mb-2 font-normal">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FULL FEATURE CHECKLIST */}
      <section className="bg-white py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl text-navy mb-3 font-normal">Everything included in every plan.</h2>
            <p className="text-gray-500 text-sm">Every plan gets the full platform. No locked features, no surprise add-ons.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {FEATURE_CATEGORIES.map((cat) => (
              <div key={cat.name}>
                <p className="text-xs font-bold text-navy uppercase tracking-widest mb-4">{cat.name}</p>
                <ul className="space-y-2.5">
                  {cat.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-gold mt-1 flex-shrink-0">✓</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IS THIS FOR */}
      <section className="bg-cream py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl text-navy mb-3 font-normal">Built for how you actually work.</h2>
            <p className="text-gray-500 text-sm">Whether you shoot solo or run a crew, the platform fits around you.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-100 rounded-xl p-8">
              <p className="text-xs font-bold text-navy uppercase tracking-widest mb-3">Working Solo</p>
              <h3 className="font-serif text-2xl text-navy mb-4 font-normal">You shoot, deliver, and collect. All in one place.</h3>
              <ul className="space-y-3">
                {[
                  "Your own booking page live in minutes",
                  "Deposit collected when they book, balance before download",
                  "Galleries delivered in one click",
                  "Agent gets a branded marketing kit automatically",
                  "Track every listing, payment, and status from your dashboard",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="text-gold mt-0.5 flex-shrink-0">✓</span>{i}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-navy text-white rounded-xl p-8">
              <p className="text-xs font-bold text-gold uppercase tracking-widest mb-3">Running a Team</p>
              <h3 className="font-serif text-2xl text-white mb-4 font-normal">Assign, dispatch, and deliver without the back-and-forth.</h3>
              <ul className="space-y-3">
                {[
                  "See every team member's availability at a glance",
                  "Assign photographers to bookings with one click",
                  "Service areas and zone routing built in",
                  "Track contractor costs and profit per job",
                  "Everyone works in the same system, no spreadsheets",
                ].map((i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                    <span className="text-gold mt-0.5 flex-shrink-0">✓</span>{i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="bg-white py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl text-navy mb-3 font-normal">Transparent pricing that grows with you.</h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              A monthly subscription plus a small per-transaction fee. Annual listing credits included in every plan. No hidden charges. Cancel anytime.
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-4 text-gray-400 font-medium text-xs uppercase tracking-wide">Feature</th>
                  <th className="px-6 py-4 text-center">
                    <span className="font-display text-navy text-base tracking-wide">ShootFlow</span>
                  </th>
                  <th className="px-6 py-4 text-center text-gray-400 font-medium text-sm">Other platforms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.feature} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-gray-600 font-medium">{row.feature}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-block text-xs font-medium px-3 py-1 rounded-full ${
                        row.highlight ? "bg-emerald-50 text-emerald-700" : "text-gray-700"
                      }`}>{row.us}</span>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-400 text-xs">{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            Stripe processing fees are separate and charged by Stripe directly. Transaction fees decrease as you move to higher plans.
          </p>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-cream py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl text-navy mb-3 font-normal">Real estate photographers love it.</h2>
            <p className="text-gray-500 text-sm">Set up in under an hour. Running on autopilot after day one.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white rounded-xl border border-gray-100 p-7">
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map((s) => (
                    <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill="#c9a96e"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed mb-5 italic">"{t.quote}"</p>
                <div>
                  <p className="font-semibold text-charcoal text-sm">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
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
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Ready to grow?</p>
          <h2 className="font-serif text-4xl text-white mb-4 font-normal">Your business, running on autopilot.</h2>
          <p className="text-white/60 mb-8 text-lg leading-relaxed">
            Booking, payment collection, and media delivery. Fully automated, starting at $79/mo.
          </p>
          <Link href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-10 py-4 rounded-sm hover:bg-gold/90 transition-colors text-base">
            Start free, no credit card needed
          </Link>
          <p className="text-white/30 text-xs mt-5">14-day free trial · No contract · Cancel anytime</p>
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
    title: "Clients book and pay, no back-and-forth",
    desc: "A guided booking flow collects package selection, property details, scheduling, and a deposit in one shot. Your calendar fills itself.",
    bullets: [
      "Multi-step booking with package upsells",
      "Deposit collected at time of booking",
      "Travel fee auto-calculated by address",
      "Embeddable on any website",
    ],
  },
  {
    icon: "💳",
    title: "Get paid without asking twice",
    desc: "Deposits lock in at booking. Balances collect automatically before downloads unlock. You never have to ask for money.",
    bullets: [
      "Direct payouts to your bank account",
      "Configurable deposit per service type",
      "Balance due reminders with one-click payment",
      "Full or deposit-only payment options",
    ],
  },
  {
    icon: "🖼️",
    title: "Deliver photos, collect balance, done",
    desc: "Upload your gallery and hit send. Photos are preview-only until the balance clears. No chasing clients for payment.",
    bullets: [
      "Photo and video upload (up to 1,000 files)",
      "Payment-gated download access",
      "3D tour embedding",
      "Floor plans and file attachments",
    ],
  },
  {
    icon: "🏡",
    title: "Every listing gets a professional kit",
    desc: "A branded property website and print-ready brochure, auto-built from your booking data. No extra work required.",
    bullets: [
      "Branded property landing page",
      "One-click print brochure (PDF)",
      "QR code for open houses",
      "Full agent info and property detail editor",
    ],
  },
  {
    icon: "✨",
    title: "Agents share your work, you get referrals",
    desc: "Agents get a private marketing portal with gallery, website, QR code, and AI-generated social captions. Sent automatically on delivery.",
    bullets: [
      "AI social captions for Instagram, Facebook, and email",
      "Branded to your business",
      "No login required for agents",
      "Permanent link, usable for all future shoots",
    ],
  },
  {
    icon: "📊",
    title: "See exactly where your money is",
    desc: "Every shoot tracked from request to delivered. Revenue, pending payments, and photographer costs in one place.",
    bullets: [
      "Revenue tracking per listing",
      "Booking status pipeline",
      "Photographer pay rate tracking",
      "Client and agent order history",
    ],
  },
];

const STEPS = [
  { title: "Create your account", desc: "Sign up with your business name. Your branded booking page is live immediately." },
  { title: "Add your services", desc: "Set up packages, add-ons, and pricing. The booking form builds itself." },
  { title: "Connect Stripe", desc: "Link Stripe in minutes. Deposits and balances flow directly to your bank." },
  { title: "Start taking bookings", desc: "Share your link. Clients book, pay, and you get notified instantly." },
];

const FEATURE_CATEGORIES = [
  {
    name: "Booking & Payments",
    items: [
      "Guided client booking flow",
      "Package & add-on upsells",
      "Configurable deposit amounts",
      "Stripe Connect direct payouts",
      "Full payment or deposit options",
      "Promo code support",
      "Travel fee calculator",
      "Square footage pricing tiers",
    ],
  },
  {
    name: "Media & Delivery",
    items: [
      "Photo & video gallery delivery",
      "Payment-gated downloads",
      "3D Matterport tour embedding",
      "Floor plan attachments",
      "Scheduled gallery delivery",
      "Direct upload or external URL",
      "Up to 1,000 files per gallery",
      "Video tour (YouTube / Vimeo embed)",
    ],
  },
  {
    name: "Marketing & Client Tools",
    items: [
      "Branded property websites",
      "Print-ready PDF brochures",
      "QR code generation",
      "AI social media captions",
      "Agent portal (no login needed)",
      "Customizable email templates",
      "SMS notifications (Studio plan+)",
      "Service agreement e-capture",
    ],
  },
];

const COMPARISON_ROWS = [
  { feature: "Starting monthly price",            us: "From $79/mo",                   them: "From $99+/mo",            highlight: true },
  { feature: "Listing credits",                   us: "Included in plan, buy more as needed", them: "Annual caps — charge extra mid-cycle", highlight: true },
  { feature: "Transaction fee",                   us: "1–2% (shown upfront)",           them: "Varies, often hidden",    highlight: false },
  { feature: "Deposit + balance automation",      us: "Built in on every plan",          them: "Manual or add-on",       highlight: true },
  { feature: "Agent marketing kit",               us: "Included, auto-sent on delivery", them: "Separate product/upsell", highlight: false },
  { feature: "AI social captions",                us: "Included on all plans",          them: "Upsell or not available",  highlight: true },
  { feature: "Payment before download",           us: "Yes, gallery locked until paid",  them: "Manual follow-up",       highlight: true },
  { feature: "Setup time",                        us: "Under 1 hour, no onboarding call needed", them: "Days + demo required", highlight: true },
  { feature: "Contract",                          us: "None, cancel anytime",            them: "Often annual",            highlight: false },
];

const TESTIMONIALS = [
  {
    name: "Marcus W.",
    role: "Real estate photographer, San Diego CA",
    quote: "I used to spend half my Friday chasing down payment requests. Now the balance just shows up in my account before I even think about it. The whole system runs itself.",
  },
  {
    name: "Devon T.",
    role: "Photography team owner, Phoenix AZ",
    quote: "Assigning shoots to my team used to be a group text. Now I open the booking, see who is available, tap their name, and they get notified. Game changer for us.",
  },
  {
    name: "Brooke S.",
    role: "Solo photographer, Nashville TN",
    quote: "I was nervous it would take forever to set up. I had my booking page live, Stripe connected, and my first real booking confirmed within the same afternoon.",
  },
];
