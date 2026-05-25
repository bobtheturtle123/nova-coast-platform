import Link from "next/link";
import PricingSection from "@/components/PricingSection";
import DiscountPopup from "@/components/DiscountPopup";

export const metadata = {
  title: "KyoriaOS — Built for real estate media businesses",
  description:
    "Booking, scheduling, gallery delivery, and client portals — all connected. Replace the tools you're patching together.",
};

export default function MarketingPage() {
  return (
    <>
      <DiscountPopup />
      <div className="min-h-screen bg-white font-body">

        {/* NAV */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <img src="/kyoriaos-logo.png" alt="KyoriaOS" className="h-11 w-auto object-contain" />
            <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
              <a href="#how-it-works" className="hover:text-navy transition-colors">How it works</a>
              <a href="#pricing" className="hover:text-navy transition-colors">Pricing</a>
            </nav>
            <div className="flex items-center gap-3">
              <Link href="/auth/login" className="text-sm text-gray-600 hover:text-navy px-3 py-2 transition-colors">
                Sign in
              </Link>
              <Link
                href="/auth/register"
                className="text-sm bg-navy text-white px-4 py-2 rounded-xl hover:bg-navy/90 transition-colors font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </header>

        {/* HERO */}
        <section className="bg-navy text-white pt-20 pb-0 px-6 overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-end">
              <div className="py-12">
                <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 rounded-full px-4 py-1.5 mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-white/75 text-xs">Built for real estate media teams</span>
                </div>
                <h1 className="font-serif text-5xl md:text-[3.25rem] leading-[1.1] mb-6 font-normal text-white">
                  Stop running your<br />business out of a<br />group chat.
                </h1>
                <p className="text-white/60 text-lg max-w-lg leading-relaxed mb-10">
                  KyoriaOS connects booking, scheduling, gallery delivery, and payments into one system — so you can stop patching tools together and start running a real business.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/auth/register"
                    className="bg-gold text-navy font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-colors text-center text-sm"
                  >
                    Get Started →
                  </Link>
                  <a
                    href="#pricing"
                    className="border border-white/20 text-white/75 px-8 py-4 rounded-xl hover:bg-white/5 transition-colors text-center text-sm"
                  >
                    See Pricing
                  </a>
                </div>
                <p className="text-white/30 text-xs mt-4">From $79/month · No contracts · Cancel anytime</p>
              </div>

              <div className="relative pb-0 hidden md:block">
                <div className="rounded-t-2xl overflow-hidden shadow-2xl border border-white/10">
                  <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/10" style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
                      <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
                      <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
                    </div>
                    <div className="flex-1 bg-white/10 rounded text-white/25 text-[10px] px-3 py-1 text-center">
                      app.kyoriaos.com/dashboard
                    </div>
                  </div>
                  <img
                    src="/screenshots/schedule.png"
                    alt="KyoriaOS — team schedule and bookings dashboard"
                    className="w-full block"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST BAR */}
        <div className="bg-cream border-y border-gray-100 py-4 px-6">
          <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-x-8 gap-y-2">
            {[
              "Online booking + deposits",
              "Team scheduling",
              "Gallery delivery",
              "Payment-gated downloads",
              "Agent portal",
              "Calendar sync",
            ].map((f) => (
              <span key={f} className="flex items-center gap-2 text-xs text-gray-500">
                <span className="text-gold">✓</span>{f}
              </span>
            ))}
          </div>
        </div>

        {/* BEFORE / AFTER */}
        <section className="py-24 px-6 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Sound familiar?</p>
              <h2 className="font-serif text-4xl text-navy mb-4 font-normal">
                You&apos;re running a media business<br />out of duct tape and iMessage.
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto text-base leading-relaxed">
                Every tool disconnected. Every follow-up manual. There&apos;s a better way.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-7">
                <p className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-5">Without KyoriaOS</p>
                <ul className="space-y-3">
                  {[
                    "Chase deposits over iMessage",
                    "Send Dropbox links manually after delivery",
                    "Follow up on unpaid balances for weeks",
                    "Coordinate photographers in group texts",
                    "Clients lose the gallery link and text you",
                    "No record of what each shoot actually made",
                    "Build pricing tables in Google Docs",
                    "No marketing materials for agents",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-gray-500">
                      <span className="text-red-300 mt-0.5 flex-shrink-0 font-bold">✕</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-navy text-white rounded-2xl p-7">
                <p className="text-xs font-semibold text-gold uppercase tracking-widest mb-5">With KyoriaOS</p>
                <ul className="space-y-3">
                  {[
                    "Deposit collected the moment they book",
                    "Gallery delivered in one click, locked until paid",
                    "Balance auto-collected before downloads unlock",
                    "Assign photographers from the dashboard",
                    "Gallery link re-sent on demand",
                    "Full revenue breakdown per listing",
                    "Guided booking flow upsells for you",
                    "Agent portal with brochure, QR code, and downloads",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-white/70">
                      <span className="text-gold mt-0.5 flex-shrink-0 font-bold">✓</span>{item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="py-24 px-6 bg-navy text-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">How it works</p>
              <h2 className="font-serif text-4xl text-white mb-4 font-normal">
                Four steps. Every job, handled.
              </h2>
              <p className="text-white/45 max-w-xl mx-auto text-base">
                From first contact to final payment — the entire job cycle runs through one system.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
              {HOW_IT_WORKS.map((step, i) => (
                <div key={step.title}>
                  <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/25 flex items-center justify-center mb-4">
                    <span className="text-gold font-bold text-sm">{i + 1}</span>
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-2">{step.title}</h3>
                  <p className="text-white/45 text-xs leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CORE BENEFITS */}
        <section className="py-24 px-6 bg-white border-b border-gray-100">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Why it works</p>
              <h2 className="font-serif text-4xl text-navy mb-4 font-normal">
                Built to grow your business,<br />not just manage it.
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {BENEFITS.map((b) => (
                <div key={b.title} className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
                  <div className="w-9 h-9 bg-navy/5 border border-navy/10 rounded-xl flex items-center justify-center mb-4 text-navy">
                    {b.icon}
                  </div>
                  <h3 className="font-semibold text-sm text-gray-900 mb-2">{b.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRODUCT SCREENSHOTS */}
        <section className="py-20 px-6 bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Real product · real screenshots</p>
              <h2 className="font-serif text-4xl text-navy mb-4 font-normal">
                Every part of your business,<br />in one dashboard.
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto text-base leading-relaxed">
                Not renders. Not mockups. The actual platform, running live businesses today.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-5">
              {SCREENSHOTS.map((s) => (
                <div key={s.title} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="overflow-hidden bg-gray-100 aspect-[16/9]">
                    <img
                      src={s.src}
                      alt={`${s.title} — KyoriaOS real estate photography software`}
                      className="w-full h-full object-cover object-top"
                    />
                  </div>
                  <div className="p-5 border-t border-gray-100">
                    <p className="text-sm font-semibold text-navy mb-1">{s.title}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AGENT PORTAL SPOTLIGHT */}
        <section className="py-24 px-6 bg-navy text-white">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Agent marketing portal</p>
                <h2 className="font-serif text-4xl text-white mb-5 font-normal">
                  Every agent gets a professional listing kit. Automatically.
                </h2>
                <p className="text-white/50 leading-relaxed mb-7">
                  When you deliver a gallery, the agent gets everything they need to market the listing — with no extra work from you. It&apos;s a reason for them to keep booking you.
                </p>
                <ul className="space-y-3 mb-8">
                  {[
                    "Branded property website with full listing details",
                    "Print-ready brochure for open houses",
                    "QR code for print and signage",
                    "3D Matterport and video tour embedded",
                    "Private link — no agent account required",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm text-white/70">
                      <span className="w-4 h-4 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg width="7" height="7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" className="text-gold">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/register"
                  className="inline-block bg-gold text-navy font-semibold px-7 py-3 rounded-xl hover:bg-gold/90 transition-colors text-sm"
                >
                  Get started →
                </Link>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-gold text-sm font-bold">S</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">Sarah Chen · Compass Realty</p>
                    <p className="text-xs text-white/35">1842 Ocean View Dr, Coronado CA</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    {
                      icon: (
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      ),
                      label: "Gallery",
                      sub: "48 photos",
                    },
                    {
                      icon: (
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      ),
                      label: "Website",
                      sub: "Share link",
                    },
                    {
                      icon: (
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      ),
                      label: "Brochure",
                      sub: "Print ready",
                    },
                  ].map((c) => (
                    <div key={c.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                      <div className="flex items-center justify-center h-6 mb-1.5 text-white/60">{c.icon}</div>
                      <p className="text-xs font-semibold text-white/75">{c.label}</p>
                      <p className="text-[10px] text-white/30">{c.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="bg-cream py-20 px-6">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-serif text-3xl text-navy mb-3 font-normal">
                Built for photographers who mean business.
              </h2>
              <p className="text-gray-500 text-sm">Set up in under an hour. Running on autopilot after day one.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {TESTIMONIALS.map((t) => (
                <div key={t.name} className="bg-white rounded-2xl border border-gray-100 p-7">
                  <div className="flex gap-0.5 mb-4">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <svg key={s} width="13" height="13" viewBox="0 0 24 24" fill="#c9a96e">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed mb-5 italic">&quot;{t.quote}&quot;</p>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* TRUST / POSITIONING */}
        <section className="py-16 px-6 border-y border-gray-100">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              {[
                {
                  label: "01",
                  title: "Purpose-built for real estate media",
                  desc: "Not adapted from generic booking software. Designed around how real estate shoots actually work — MLS delivery, agent portals, and all.",
                },
                {
                  label: "02",
                  title: "Replaces 4–6 separate tools",
                  desc: "Calendly, Dropbox, HoneyBook, Wave, and your group chat. One platform. One monthly cost. Everything connected.",
                },
                {
                  label: "03",
                  title: "Designed for real workflows",
                  desc: "Shoot cycles, photographer dispatch, gallery delivery, agent marketing — built in the right order, the way your business actually runs.",
                },
              ].map((item) => (
                <div key={item.label}>
                  <span className="font-serif text-4xl text-navy/10 block mb-3">{item.label}</span>
                  <h3 className="font-semibold text-navy text-sm mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <PricingSection />

        {/* FINAL CTA */}
        <section className="bg-navy py-28 px-6 text-center">
          <div className="max-w-2xl mx-auto">
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">One system. Every job.</p>
            <h2 className="font-serif text-4xl text-white mb-4 font-normal">
              Run your entire media business<br />from one place.
            </h2>
            <p className="text-white/50 mb-8 text-lg leading-relaxed max-w-xl mx-auto">
              Booking, scheduling, delivery, and payments — automated, connected, and built for real estate photographers.
            </p>
            <Link
              href="/auth/register"
              className="inline-block bg-gold text-navy font-semibold px-10 py-4 rounded-xl hover:bg-gold/90 transition-colors text-base"
            >
              Get Started →
            </Link>
            <p className="text-white/25 text-xs mt-5">From $79/month · No contract · Cancel anytime</p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-navy border-t border-white/10 py-8 px-6">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-white/35 text-xs">
            <span>© {new Date().getFullYear()} KyoriaOS. All rights reserved.</span>
            <div className="flex gap-6">
              <a href="/privacy" className="hover:text-white/65 transition-colors">Privacy Policy</a>
              <a href="/terms" className="hover:text-white/65 transition-colors">Terms of Service</a>
              <a href="/sms-consent" className="hover:text-white/65 transition-colors">SMS Consent</a>
              <a href="mailto:contact@kyoriaos.com" className="hover:text-white/65 transition-colors">Support</a>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}

// ─── DATA ───────────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    title: "Client books online",
    desc: "Package selection, property details, and deposit — all handled in one guided flow. No back-and-forth.",
  },
  {
    title: "You schedule in seconds",
    desc: "See your team's real-time availability, assign a photographer, and they're notified instantly.",
  },
  {
    title: "Shoot, upload, deliver",
    desc: "Upload the gallery and hit send. Balance is collected automatically before they can download.",
  },
  {
    title: "Everyone gets everything",
    desc: "Client portal, agent portal, and property website — all delivered automatically when photos go live.",
  },
];

const BENEFITS = [
  {
    title: "Save hours every week",
    desc: "Deposits, reminders, delivery, and follow-ups are all automated. Stop managing things the system handles for you.",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Get paid every time",
    desc: "Deposit at booking. Balance locked behind the gallery. No more unpaid invoices or awkward follow-ups.",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    title: "Look like the business you are",
    desc: "Branded booking pages, gallery links, and agent portals. Every client touchpoint looks polished and professional.",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: "Scale without the chaos",
    desc: "Handle twice the volume with the same team. Clear workflows mean nothing falls through the cracks.",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
];

const SCREENSHOTS = [
  {
    src: "/screenshots/customers.png",
    title: "Agent & Client CRM",
    desc: "All your agents and clients in one place. Track orders, contact history, and lifetime value per account.",
  },
  {
    src: "/screenshots/schedule.png",
    title: "Team Schedule & Calendar",
    desc: "Every photographer's week at a glance. Assign shoots, track availability, and manage your team from one view.",
  },
  {
    src: "/screenshots/service-areas.png",
    title: "Service Area Map",
    desc: "Define exactly where you work. Assign photographers per zone and auto-route bookings to the right person.",
  },
  {
    src: "/screenshots/zone-setup.png",
    title: "Booking Setup",
    desc: "Set up packages, zones, and team assignments in minutes. Your booking page is live the same day.",
  },
];

const TESTIMONIALS = [
  {
    name: "Marcus W.",
    role: "Real estate photographer, San Diego CA",
    quote:
      "I used to spend half my Friday chasing down payment requests. Now the balance just shows up in my account before I even think about it. The whole system runs itself.",
  },
  {
    name: "Devon T.",
    role: "Photography team owner, Phoenix AZ",
    quote:
      "Assigning shoots to my team used to be a group text. Now I open the booking, see who is available, tap their name, and they get notified. Game changer for us.",
  },
  {
    name: "Brooke S.",
    role: "Solo photographer, Nashville TN",
    quote:
      "I was nervous it would take forever to set up. I had my booking page live, Stripe connected, and my first real booking confirmed within the same afternoon.",
  },
];
