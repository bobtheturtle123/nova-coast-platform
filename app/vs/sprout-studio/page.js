import Link from "next/link";

export const metadata = {
  title: "KyoriaOS vs Sprout Studio — Real Estate Photography Software Comparison",
  description:
    "Comparing KyoriaOS vs Sprout Studio for real estate photographers. See why KyoriaOS wins on payment-gated gallery delivery, service area management, agent marketing portal, and team photographer dispatch.",
};

const COMPARISON_ROWS = [
  {
    feature: "Built specifically for real estate photographers",
    kyoria: { value: "Yes", positive: true },
    competitor: { value: "No — general photography studios", positive: false },
  },
  {
    feature: "Payment-gated gallery delivery",
    kyoria: { value: "Yes — gallery locks until Stripe payment clears", positive: true },
    competitor: { value: "No — gallery and invoicing are separate", positive: false },
  },
  {
    feature: "Service area zone routing (map polygons)",
    kyoria: { value: "Yes — draw zones, assign photographers, auto-route bookings", positive: true },
    competitor: { value: "No", positive: false },
  },
  {
    feature: "Team photographer dispatch",
    kyoria: { value: "Yes — availability grid, one-click assign, Google Calendar sync", positive: true },
    competitor: { value: "Limited — basic scheduling, no dispatch flow", positive: false },
  },
  {
    feature: "Agent marketing portal (website + brochure + QR code)",
    kyoria: { value: "Yes — auto-generated at every delivery, zero extra work", positive: true },
    competitor: { value: "No", positive: false },
  },
  {
    feature: "Deposit + balance split payment flow",
    kyoria: { value: "Yes — deposit at booking, balance auto-collected at delivery", positive: true },
    competitor: { value: "Partial — requires manual invoice workflow", positive: false },
  },
  {
    feature: "Travel fee auto-calculation by address",
    kyoria: { value: "Yes — calculated automatically at checkout", positive: true },
    competitor: { value: "No", positive: false },
  },
];

const SWITCH_REASONS = [
  {
    title: "Sprout Studio is built for portrait and wedding photographers — not real estate.",
    desc: "Sprout Studio does a lot of things well for studio-based photographers. But real estate photography runs on different rails: high volume repeat clients, team dispatch, quick turnaround, and agent-specific deliverables. KyoriaOS was designed from scratch for that model.",
  },
  {
    title: "Sprout Studio doesn't lock galleries until payment.",
    desc: "With Sprout Studio, file delivery and payment are separate processes. With KyoriaOS, the gallery link stays locked until the Stripe balance clears — automatically. No manual follow-up, no good-faith file sharing, no chasing anyone.",
  },
  {
    title: "There's no service area management in Sprout Studio.",
    desc: "If you cover multiple cities or have photographers in different neighborhoods, KyoriaOS's map-based zone system automatically surfaces the right photographer for each booking address. Sprout Studio has no equivalent — you're back to manually checking who covers what.",
  },
  {
    title: "Every KyoriaOS delivery generates an agent marketing kit — automatically.",
    desc: "When you deliver via KyoriaOS, the listing agent gets a branded property website, a print-ready brochure, and a QR code for their sign. It happens automatically, requires no extra work from you, and gives every agent a reason to keep booking you instead of someone else.",
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

export default function VsSproutStudioPage() {
  return (
    <div>
      {/* HERO */}
      <section className="bg-navy text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Software Comparison</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5">
            KyoriaOS vs Sprout Studio: Which is Right for Real Estate Photography?
          </h1>
          <p className="text-white/55 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
            Sprout Studio is a solid platform for portrait and wedding studios. But real estate photography has its own workflow — and KyoriaOS is the only platform built around it.
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
                <span className="text-xs font-semibold text-gray-500">Sprout Studio</span>
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
              Why real estate photographers choose KyoriaOS over Sprout Studio.
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
            Solo, Studio, Pro, and Scale plans available. Built for photographers running one-person operations all the way up to multi-photographer companies.
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
            Built for real estate photographers. Not general studios.
          </h2>
          <p className="text-white/50 mb-8 leading-relaxed">
            Get set up in under an hour. Booking page, Stripe, team, and your first delivery — all live today.
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
