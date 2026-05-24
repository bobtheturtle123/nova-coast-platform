import Link from "next/link";

export const metadata = {
  title: "KyoriaOS vs HoneyBook — Real Estate Photography Software Comparison",
  description:
    "Comparing KyoriaOS vs HoneyBook for real estate photographers. See why photographers switch from HoneyBook to KyoriaOS for payment-gated gallery delivery, service area routing, team dispatch, and the agent marketing portal.",
};

const COMPARISON_ROWS = [
  {
    feature: "Built specifically for real estate photographers",
    kyoria: { value: "Yes", positive: true },
    competitor: { value: "No — general creative businesses", positive: false },
  },
  {
    feature: "Payment-gated gallery delivery",
    kyoria: { value: "Yes — balance collected before downloads unlock", positive: true },
    competitor: { value: "No — separate invoicing and delivery", positive: false },
  },
  {
    feature: "Service area zone routing",
    kyoria: { value: "Yes — map polygon zones with photographer assignment", positive: true },
    competitor: { value: "No", positive: false },
  },
  {
    feature: "Team photographer dispatch",
    kyoria: { value: "Yes — availability grid, one-click assign, instant notification", positive: true },
    competitor: { value: "Limited — no multi-photographer dispatch flow", positive: false },
  },
  {
    feature: "Agent marketing portal (website + brochure + QR)",
    kyoria: { value: "Yes — auto-generated at every delivery", positive: true },
    competitor: { value: "No", positive: false },
  },
  {
    feature: "Stripe Connect (photographers keep earnings directly)",
    kyoria: { value: "Yes — direct Stripe Connect integration", positive: true },
    competitor: { value: "Yes — Stripe payments supported", positive: true },
  },
  {
    feature: "Deposit + balance split payment flow",
    kyoria: { value: "Yes — deposit at booking, balance at delivery automatically", positive: true },
    competitor: { value: "Partial — requires manual invoice sequencing", positive: false },
  },
];

const SWITCH_REASONS = [
  {
    title: "HoneyBook was built for general creatives — not real estate photographers.",
    desc: "HoneyBook is an excellent tool for wedding photographers, designers, and consultants. But real estate photography has a different workflow: high volume, repeat agent clients, team dispatch, and same-day turnaround. KyoriaOS is built around that exact workflow from the ground up.",
  },
  {
    title: "There's no payment-gated delivery in HoneyBook.",
    desc: "With HoneyBook, you send an invoice and a Dropbox link separately, then hope the client pays before they download. KyoriaOS locks the gallery until the Stripe payment clears — automatically. No chasing, no trust-based file sharing.",
  },
  {
    title: "HoneyBook has no team dispatch or service area management.",
    desc: "If you have more than one photographer, HoneyBook doesn't help you assign jobs based on coverage zones or see your team's availability in one view. KyoriaOS's dispatch and service area features are built for photography companies that operate as a team.",
  },
  {
    title: "Agents get nothing from a HoneyBook delivery.",
    desc: "When you deliver through KyoriaOS, every listing agent automatically receives a branded property website, a print-ready PDF brochure, and a QR code for their yard sign. HoneyBook delivers files — KyoriaOS delivers a marketing kit that makes agents book you again.",
  },
];

const CheckIcon = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-emerald-600 flex-shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="text-gray-400 flex-shrink-0">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function VsHoneybookPage() {
  return (
    <div>
      {/* HERO */}
      <section className="bg-navy text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Software Comparison</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5">
            KyoriaOS vs HoneyBook: Which is Built for Real Estate Photographers?
          </h1>
          <p className="text-white/55 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            HoneyBook is great for general creative businesses. But if you run a real estate photography operation — with a team, recurring agent clients, and gallery delivery — there&apos;s a platform built specifically for your workflow.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-colors text-sm"
          >
            Try KyoriaOS free — no credit card needed
          </Link>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Feature comparison</p>
            <h2 className="font-serif text-3xl text-navy font-normal">
              Side by side, feature by feature.
            </h2>
          </div>
          <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-card">
            {/* Table header */}
            <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-100">
              <div className="p-4 text-xs text-gray-400 font-semibold uppercase tracking-widest">Feature</div>
              <div className="p-4 bg-navy/5 border-x border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-navy flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">K</span>
                  </div>
                  <span className="text-xs font-semibold text-navy">KyoriaOS</span>
                </div>
              </div>
              <div className="p-4">
                <span className="text-xs font-semibold text-gray-500">HoneyBook</span>
              </div>
            </div>
            {/* Table rows */}
            {COMPARISON_ROWS.map((row, i) => (
              <div
                key={row.feature}
                className={`grid grid-cols-3 border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
              >
                <div className="p-4 text-sm text-gray-700 font-medium flex items-center">{row.feature}</div>
                <div className="p-4 bg-navy/[0.02] border-x border-gray-100 flex items-start gap-2">
                  {row.kyoria.positive ? <CheckIcon /> : <XIcon />}
                  <span className={`text-sm leading-relaxed ${row.kyoria.positive ? "text-gray-700" : "text-gray-400"}`}>
                    {row.kyoria.value}
                  </span>
                </div>
                <div className="p-4 flex items-start gap-2">
                  {row.competitor.positive ? <CheckIcon /> : <XIcon />}
                  <span className={`text-sm leading-relaxed ${row.competitor.positive ? "text-gray-700" : "text-gray-400"}`}>
                    {row.competitor.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY PHOTOGRAPHERS SWITCH */}
      <section className="py-20 px-6 bg-cream">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Why photographers switch</p>
            <h2 className="font-serif text-3xl text-navy font-normal">
              Why real estate photographers leave HoneyBook for KyoriaOS.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {SWITCH_REASONS.map((r) => (
              <div key={r.title} className="bg-white border border-gray-100 rounded-2xl p-7">
                <h3 className="font-semibold text-navy text-base mb-3 leading-snug">{r.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING CALLOUT */}
      <section className="py-14 px-6 bg-white border-y border-gray-100">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-serif text-2xl text-navy font-normal mb-3">
            KyoriaOS starts at $79/mo for solo photographers.
          </h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            Solo, Studio, Pro, and Scale plans available. No seat fees for your basic team. No surprise charges per form or project.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/register"
              className="inline-block bg-navy text-white font-semibold px-8 py-4 rounded-xl hover:bg-navy/90 transition-colors text-sm"
            >
              Start your free trial
            </Link>
            <Link
              href="/#pricing"
              className="inline-block border border-gray-200 text-gray-600 font-semibold px-8 py-4 rounded-xl hover:border-navy/30 hover:text-navy transition-colors text-sm"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Ready to switch?</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Built for real estate photographers. Not general creatives.
          </h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Get set up in under an hour. Booking page live, Stripe connected, first order confirmed — same day.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-10 py-4 rounded-xl hover:bg-gold/90 transition-colors"
          >
            Start for free &rarr;
          </Link>
          <p className="text-white/25 text-xs mt-4">No credit card &middot; No contract &middot; Cancel anytime</p>
        </div>
      </section>
    </div>
  );
}
