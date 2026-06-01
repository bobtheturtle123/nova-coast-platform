import Link from "next/link";

export const metadata = {
  title: "Kyoria OS vs Other Real Estate Photography Software",
  description:
    "See how Kyoria OS compares to Aryeo, Spiro, HoneyBook, and other platforms for real estate photographers. Compare features, pricing, and which tool is right for your business.",
  alternates: { canonical: "https://kyoriaos.com/compare" },
};

const COMPARISONS = [
  {
    href: "/compare/aryeo-vs-kyoria-os",
    competitor: "Aryeo",
    summary: "Aryeo (Beam) is strong on property websites and MLS integrations. Kyoria OS is focused on team dispatch, service area routing, and payment-gated delivery.",
    tag: "Industry-specific",
  },
  {
    href: "/compare/spiro-vs-kyoria-os",
    competitor: "Spiro",
    summary: "Spiro covers booking fundamentals for real estate photographers. Kyoria OS adds service area routing, SMS automation, and full payment automation on top.",
    tag: "Industry-specific",
  },
  {
    href: "/compare/honeybook-vs-kyoria-os",
    competitor: "HoneyBook",
    summary: "HoneyBook is a general-purpose CRM for freelancers. Kyoria OS is built specifically for real estate photography: zones, dispatch, gallery delivery, and agent portals are native features.",
    tag: "General CRM",
  },
];

export default function ComparePage() {
  return (
    <div>
      {/* HERO */}
      <section className="bg-navy text-white py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Compare</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5">
            How Kyoria OS Compares
          </h1>
          <p className="text-white/55 text-lg max-w-2xl mx-auto leading-relaxed">
            Built from the ground up for real estate photography businesses. See how Kyoria OS stacks up against the other tools photographers are using today.
          </p>
        </div>
      </section>

      {/* COMPARISON CARDS */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto space-y-5">
          {COMPARISONS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="block border border-gray-100 rounded-2xl p-7 hover:border-navy/20 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-semibold text-navy text-base">{c.competitor} vs Kyoria OS</h2>
                    <span className="text-[10px] text-gray-400 border border-gray-200 rounded-full px-2 py-0.5 bg-gray-50">
                      {c.tag}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">{c.summary}</p>
                </div>
                <span className="text-navy text-lg flex-shrink-0 mt-1">&rarr;</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* WHY KYORIA OS */}
      <section className="py-16 px-6 bg-cream border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Why Kyoria OS</p>
            <h2 className="font-serif text-3xl text-navy font-normal">
              The only platform built for this specific workflow.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Real estate photography first",
                desc: "Every feature was designed around the real estate photography workflow. Not adapted from a generic CRM.",
              },
              {
                title: "Operations built in",
                desc: "Team dispatch, service area routing, travel fee calculation. The operational layer most platforms skip.",
              },
              {
                title: "Payments that protect you",
                desc: "Deposits at booking. Gallery locked until balance clears. You never deliver work before you are paid.",
              },
            ].map((c) => (
              <div key={c.title} className="bg-white border border-gray-100 rounded-2xl p-6">
                <h3 className="font-semibold text-navy text-sm mb-2">{c.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-16 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Ready to switch?</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            See Kyoria OS in action.
          </h2>
          <p className="text-white/50 text-sm mb-7 leading-relaxed">
            Set up your booking page, connect Stripe, and take your first booking today.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-colors text-sm"
          >
            Get Started
          </Link>
          <p className="text-white/25 text-xs mt-4">From $79/month &middot; No contracts &middot; Cancel anytime</p>
        </div>
      </section>
    </div>
  );
}
