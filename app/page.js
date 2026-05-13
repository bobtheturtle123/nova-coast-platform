import Link from "next/link";
import PricingSection from "@/components/PricingSection";

export const metadata = {
  title: "KyoriaOS: The operating system for real estate media businesses",
  description:
    "Booking, scheduling, media delivery, and agent marketing. The complete operating system for real estate photography businesses.",
};

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-white font-body">

      {/* NAV */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <img src="/kyoriaos-logo.png" alt="KyoriaOS" className="h-8 w-auto object-contain" />
          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#how-it-works" className="hover:text-navy transition-colors">How it works</a>
            <a href="#features" className="hover:text-navy transition-colors">Features</a>
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
              <h1 className="font-serif text-5xl md:text-[3.4rem] leading-[1.1] mb-6 font-normal text-white">
                The operating system<br />for real estate media<br />businesses.
              </h1>
              <p className="text-white/60 text-lg max-w-lg leading-relaxed mb-10">
                From the first booking to the final download, KyoriaOS handles scheduling, delivery, payments, and agent marketing so you can focus on shooting.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/auth/register"
                  className="bg-gold text-navy font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-colors text-center text-sm"
                >
                  Start for free
                </Link>
                <a
                  href="#how-it-works"
                  className="border border-white/20 text-white/75 px-8 py-4 rounded-xl hover:bg-white/5 transition-colors text-center text-sm"
                >
                  See how it works
                </a>
              </div>
              <p className="text-white/30 text-xs mt-4">No credit card required · Live in under an hour · Cancel anytime</p>
            </div>

            {/* Dashboard mockup */}
            <div className="relative pb-0 hidden md:block">
              <div className="bg-white/5 border border-white/10 rounded-t-2xl overflow-hidden shadow-2xl">
                <div className="bg-white/8 px-4 py-2.5 flex items-center gap-2 border-b border-white/10">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
                    <div className="w-2.5 h-2.5 rounded-full bg-white/15" />
                  </div>
                  <div className="flex-1 bg-white/10 rounded text-white/25 text-[10px] px-3 py-1 text-center">
                    app.kyoriaos.com/dashboard
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Active Jobs", value: "8",    cls: "bg-white/8 border-white/10",              val: "text-white" },
                      { label: "Pending",     value: "3",    cls: "bg-amber-500/20 border-amber-400/20",     val: "text-amber-300" },
                      { label: "Delivered",   value: "31",   cls: "bg-emerald-500/15 border-emerald-400/15", val: "text-emerald-300" },
                      { label: "Revenue",     value: "$14k", cls: "bg-yellow-500/15 border-yellow-400/20",   val: "text-yellow-300" },
                    ].map((s) => (
                      <div key={s.label} className={`rounded-lg p-2.5 border ${s.cls}`}>
                        <p className="text-white/35 text-[9px] uppercase tracking-wide mb-1">{s.label}</p>
                        <p className={`font-semibold text-sm ${s.val}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white/8 rounded-xl border border-white/10 overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
                      <p className="text-white/45 text-[10px] font-semibold uppercase tracking-wide">Today&apos;s Shoots</p>
                      <span className="text-[9px] text-white/25">2 scheduled</span>
                    </div>
                    {[
                      { addr: "1842 Ocean View Dr, Coronado", time: "9:00 AM", photographer: "Marcus",  badge: "text-blue-300 bg-blue-500/20" },
                      { addr: "3310 Maple Ave, La Jolla",     time: "2:30 PM", photographer: "Devon",   badge: "text-purple-300 bg-purple-500/20" },
                    ].map((l) => (
                      <div key={l.addr} className="px-3 py-2.5 flex items-center justify-between border-b border-white/5 last:border-0">
                        <div>
                          <p className="text-white/65 text-[11px] truncate max-w-[135px]">{l.addr}</p>
                          <p className="text-white/25 text-[9px] mt-0.5">{l.time} · {l.photographer}</p>
                        </div>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${l.badge}`}>Confirmed</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-emerald-500/15 border border-emerald-400/20 rounded-xl px-3 py-2 flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-emerald-400/30 flex items-center justify-center flex-shrink-0">
                      <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-emerald-300"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <p className="text-emerald-300/75 text-[10px]">Gallery delivered · Balance collected automatically</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div className="bg-cream border-y border-gray-100 py-4 px-6">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-x-8 gap-y-2">
          {[
            "Online booking & deposits",
            "Automated shoot scheduling",
            "Media gallery delivery",
            "Payment-gated downloads",
            "Agent marketing portal",
            "Team dispatch & tracking",
          ].map((f) => (
            <span key={f} className="flex items-center gap-2 text-xs text-gray-500">
              <span className="text-gold">✓</span>{f}
            </span>
          ))}
        </div>
      </div>

      {/* PAIN POINTS */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Sound familiar?</p>
            <h2 className="font-serif text-4xl text-navy mb-4 font-normal">
              You&apos;re running a media business<br />out of a group chat.
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-base leading-relaxed">
              Fragmented tools, manual follow-ups, and chasing payments after the fact. There&apos;s a better way.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PAIN_POINTS.map((p) => (
              <div key={p.title} className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
                <div className="w-9 h-9 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center mb-4 text-red-400 flex-shrink-0">
                  {p.icon}
                </div>
                <h3 className="font-semibold text-sm text-gray-900 mb-2">{p.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW LIFECYCLE */}
      <section id="how-it-works" className="py-24 px-6 bg-navy text-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">How it works</p>
            <h2 className="font-serif text-4xl text-white mb-4 font-normal">
              Every step of your workflow,<br />handled for you.
            </h2>
            <p className="text-white/45 max-w-xl mx-auto">
              KyoriaOS is built around the natural lifecycle of every job, from the first inquiry to the final payment collected.
            </p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute top-8 left-12 right-12 h-px bg-white/10" style={{ top: "2rem" }} />
            <div className="grid grid-cols-2 md:grid-cols-7 gap-4 md:gap-3">
              {WORKFLOW_STEPS.map((step, i) => (
                <div key={step.label} className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl border border-white/12 bg-white/6 flex items-center justify-center mb-3 relative z-10 flex-shrink-0">
                    {step.icon}
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-gold text-navy text-[8px] font-bold flex items-center justify-center leading-none">
                      {i + 1}
                    </span>
                  </div>
                  <p className="text-white/75 text-xs font-semibold">{step.label}</p>
                  <p className="text-white/30 text-[10px] mt-1 leading-relaxed">{step.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE SECTIONS */}
      <div id="features">

        {/* F1: Booking & Scheduling */}
        <section className="py-24 px-6 bg-white border-b border-gray-100">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Booking & Scheduling</p>
              <h2 className="font-serif text-3xl text-navy mb-4 font-normal">
                From inquiry to confirmed shoot in minutes.
              </h2>
              <p className="text-gray-500 leading-relaxed mb-7">
                Your branded booking page handles the entire intake: package selection, property details, availability, and deposit. All in one guided flow, no back-and-forth texts.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Multi-step guided booking with upsells",
                  "Deposit collected at time of booking",
                  "Auto travel fee calculation by address",
                  "Real-time availability calendar",
                  "Shoot reminders sent to clients and team",
                  "Embeddable on your existing website",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="w-4 h-4 rounded-full bg-navy/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" className="text-navy">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Booking page mockup */}
            <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="bg-navy px-4 py-3 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                  <div className="w-2 h-2 rounded-full bg-white/20" />
                </div>
                <div className="flex-1 bg-white/10 rounded text-white/25 text-[9px] px-2 py-0.5 text-center">
                  book.kyoriaos.com/your-business
                </div>
              </div>
              <div className="p-5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-3 font-semibold">Select your package</p>
                {[
                  { name: "Essential",  price: "$199", desc: "25 MLS photos · Same-day delivery",             active: false },
                  { name: "Premier",    price: "$299", desc: "50 photos + aerial · Priority editing",          active: true },
                  { name: "Elite",      price: "$449", desc: "Photos + video + 3D tour + twilight",            active: false },
                ].map((pkg) => (
                  <div
                    key={pkg.name}
                    className={`rounded-xl border p-3 mb-2 flex items-center gap-3 ${
                      pkg.active ? "border-navy bg-navy/5" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${pkg.active ? "border-navy" : "border-gray-300"}`}>
                      {pkg.active && <div className="w-1.5 h-1.5 rounded-full bg-navy" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${pkg.active ? "text-navy" : "text-gray-700"}`}>{pkg.name}</p>
                      <p className="text-[10px] text-gray-400 truncate">{pkg.desc}</p>
                    </div>
                    <p className={`text-sm font-bold flex-shrink-0 ${pkg.active ? "text-navy" : "text-gray-400"}`}>{pkg.price}</p>
                  </div>
                ))}
                <div className="mt-4 bg-navy text-white text-xs font-semibold py-2.5 rounded-xl text-center">
                  Continue to scheduling →
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* F2: Delivery & Client Experience */}
        <section className="py-24 px-6 bg-cream border-b border-gray-100">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            {/* Gallery delivery mockup */}
            <div className="order-2 md:order-1 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gray-900 px-4 py-2.5 flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-white/15" />
                  <div className="w-2 h-2 rounded-full bg-white/15" />
                  <div className="w-2 h-2 rounded-full bg-white/15" />
                </div>
                <div className="flex-1 bg-white/10 rounded text-white/25 text-[9px] px-2 py-0.5 text-center">
                  gallery.kyoriaos.com/abc123
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-900">1842 Ocean View Dr, Coronado</p>
                    <p className="text-[10px] text-gray-400">48 photos · 1 video · Floor plan</p>
                  </div>
                  <span className="text-[9px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                    Unlocked
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-gray-200 to-gray-300" />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="bg-navy text-white text-[10px] font-semibold py-2 rounded-lg">
                    Download Photos
                  </button>
                  <button className="border border-gray-200 text-gray-600 text-[10px] font-semibold py-2 rounded-lg">
                    Full Package
                  </button>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Delivery & Client Experience</p>
              <h2 className="font-serif text-3xl text-navy mb-4 font-normal">
                A gallery your clients will actually remember.
              </h2>
              <p className="text-gray-500 leading-relaxed mb-7">
                Upload your work, hit send. The gallery stays locked until the balance clears. No chasing payments. Clients get everything in one beautiful, branded link.
              </p>
              <ul className="space-y-3">
                {[
                  "Photos, video, floor plans, and 3D tours in one link",
                  "Balance collected before downloads unlock",
                  "Print + Web/MLS download packages",
                  "Scheduled delivery that drops at the right time",
                  "Revision request flow built in",
                  "Activity tracking: views, downloads, shares",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="w-4 h-4 rounded-full bg-navy/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" className="text-navy">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* F3: Team Operations */}
        <section className="py-24 px-6 bg-white border-b border-gray-100">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Team Operations</p>
              <h2 className="font-serif text-3xl text-navy mb-4 font-normal">
                Run your crew without the group chat chaos.
              </h2>
              <p className="text-gray-500 leading-relaxed mb-7">
                See every photographer&apos;s availability at a glance. Assign jobs with one click. Track costs per shoot. Everyone stays in sync, without a single text message.
              </p>
              <ul className="space-y-3">
                {[
                  "Photographer availability and zone management",
                  "One-click assignment with instant notification",
                  "Contractor pay rate tracking per job",
                  "Service area routing (zip codes and radius)",
                  "Multi-photographer calendar view",
                  "Agent Pro seats for referring agents",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="w-4 h-4 rounded-full bg-navy/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" className="text-navy">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* Team dispatch mockup */}
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5 shadow-sm">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-3 font-semibold">Assign photographer</p>
              <div className="bg-navy/5 border border-navy/10 rounded-xl p-3 mb-4">
                <p className="text-xs font-semibold text-navy">3310 Maple Ave, La Jolla</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Tomorrow · 10:00 AM · Elite Package</p>
              </div>
              {[
                { name: "Marcus W.",  zone: "Coronado, La Jolla",      available: true,  jobs: "2 today" },
                { name: "Devon T.",   zone: "San Diego, Chula Vista",   available: true,  jobs: "1 today" },
                { name: "Brooke S.",  zone: "Del Mar, Encinitas",       available: false, jobs: "3 today" },
              ].map((p) => (
                <div key={p.name} className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-navy flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px] font-bold">{p.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900">{p.name}</p>
                    <p className="text-[9px] text-gray-400 truncate">{p.zone} · {p.jobs}</p>
                  </div>
                  <button
                    className={`text-[9px] font-semibold px-2.5 py-1 rounded-lg border flex-shrink-0 ${
                      p.available
                        ? "bg-navy text-white border-navy"
                        : "bg-gray-100 text-gray-400 border-gray-100"
                    }`}
                  >
                    {p.available ? "Assign" : "Busy"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* F4: Business Growth & Automation */}
        <section className="py-24 px-6 bg-cream">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
            {/* Revenue tracking mockup */}
            <div className="order-2 md:order-1 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">This Month</p>
                <span className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full font-semibold">
                  +18% vs last month
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Revenue",  value: "$8,240", color: "text-navy" },
                  { label: "Jobs",     value: "34",     color: "text-gray-700" },
                  { label: "Pending",  value: "$1,180", color: "text-amber-500" },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-1">{s.label}</p>
                    <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { addr: "1842 Ocean View Dr",      amount: "$299", status: "Paid",    badge: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                  { addr: "905 Harbor Blvd, Del Mar", amount: "$449", status: "Pending", badge: "text-amber-600 bg-amber-50 border-amber-100" },
                  { addr: "221 Coast Hwy, Encinitas", amount: "$199", status: "Paid",    badge: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                ].map((r) => (
                  <div key={r.addr} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                    <p className="flex-1 text-xs text-gray-600 truncate">{r.addr}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold border flex-shrink-0 ${r.badge}`}>{r.status}</span>
                    <p className="text-xs font-bold text-gray-900 w-10 text-right flex-shrink-0">{r.amount}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="order-1 md:order-2">
              <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Business Growth</p>
              <h2 className="font-serif text-3xl text-navy mb-4 font-normal">
                Your business, running on autopilot.
              </h2>
              <p className="text-gray-500 leading-relaxed mb-7">
                Automated reminders, smart delivery scheduling, and full revenue tracking per listing. Stop managing the busywork. Start building the business.
              </p>
              <ul className="space-y-3">
                {[
                  "Revenue tracking per listing and photographer",
                  "Automated shoot reminders and follow-ups",
                  "Scheduled gallery delivery, morning-of drops",
                  "Promo codes and seasonal offers",
                  "Service agreement e-capture",
                  "Full booking and payment history",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="w-4 h-4 rounded-full bg-navy/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" className="text-navy">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* CLIENT / AGENT PORTAL SPOTLIGHT */}
      <section className="py-24 px-6 bg-navy text-white">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Agent marketing portal</p>
              <h2 className="font-serif text-4xl text-white mb-5 font-normal">
                Every agent gets a professional listing kit. Automatically.
              </h2>
              <p className="text-white/50 leading-relaxed mb-7">
                When you deliver a gallery, the agent gets everything they need to market the listing with no extra work on your end. It&apos;s a reason for them to keep booking you.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Branded property website with full listing details",
                  "Print-ready brochure (PDF) for open houses",
                  "QR code for print and signage",
                  "3D Matterport and video tour embedded",
                  "Private link, no agent account required",
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
                  { icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, label: "Gallery",  sub: "48 photos" },
                  { icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>, label: "Website", sub: "Share link" },
                  { icon: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, label: "Brochure", sub: "Print ready" },
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

      {/* BEFORE / AFTER */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-serif text-4xl text-navy mb-4 font-normal">
              Stop running your business in a mess of texts.
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              KyoriaOS replaces the stack of tools you&apos;re duct-taping together right now.
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
                  "Build pricing tables in Google Docs",
                  "Coordinate photographers in group texts",
                  "No record of what each shoot actually made",
                  "Clients lose the gallery link and text you",
                  "No marketing tools for agents to share",
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
                  "Gallery delivered with one click, locked until paid",
                  "Balance auto-collected before downloads unlock",
                  "Guided booking flow upsells for you",
                  "Assign photographers from the dashboard",
                  "Full revenue breakdown per listing",
                  "Private gallery link re-sent on demand",
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

      {/* PRICING */}
      <PricingSection />

      {/* FINAL CTA */}
      <section className="bg-navy py-28 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Get started today</p>
          <h2 className="font-serif text-4xl text-white mb-4 font-normal">
            Your business deserves better than a group chat.
          </h2>
          <p className="text-white/50 mb-8 text-lg leading-relaxed max-w-xl mx-auto">
            Booking, scheduling, delivery, and payments: all automated, all in one place. Live in under an hour.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-10 py-4 rounded-xl hover:bg-gold/90 transition-colors text-base"
          >
            Get started — no credit card needed
          </Link>
          <p className="text-white/25 text-xs mt-5">No contract · Cancel anytime</p>
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
  );
}

const PAIN_POINTS = [
  {
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: "Scheduling over texts",
    desc: "Back-and-forth messages to confirm dates, addresses, and shoot times. No single source of truth.",
  },
  {
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    title: "Chasing payments",
    desc: "Following up on invoices days after delivery. Some clients take weeks. Others never pay.",
  },
  {
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    title: "Dropbox and Google Drive",
    desc: "Sending folder links manually. No payment gate. No branding. No way to know if they downloaded.",
  },
  {
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
    title: "Scattered tools",
    desc: "Calendly, Stripe, Google Docs, Dropbox, iMessage. None of it connected, none of it automated.",
  },
];

const WORKFLOW_STEPS = [
  {
    label: "Booking",
    sub: "Client books online and pays deposit",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-white/70">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "Scheduling",
    sub: "Calendar confirmed, reminders sent",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-white/70">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: "Shoot",
    sub: "Photographer assigned and dispatched",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-white/70">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: "Editing",
    sub: "Photos uploaded to gallery",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-white/70">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: "Delivery",
    sub: "Gallery sent to client and agent",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-white/70">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  },
  {
    label: "Revisions",
    sub: "Requests tracked in-platform",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-white/70">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    label: "Payment",
    sub: "Balance collected, job closed",
    icon: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" className="text-white/70">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
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
