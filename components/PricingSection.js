"use client";

import Link from "next/link";

const PLANS = [
  {
    id: "solo",
    name: "Solo",
    price: 49,
    tagline: "Best for solo real estate media photographers.",
    listings: "125 listings per year",
    seats: "1 team member",
    featured: false,
    includesLabel: "Everything you need to run your business:",
    features: [
      "Booking page + deposit collection",
      "Gallery delivery + payment gate",
      "Client portal",
      "Invoicing + payment tracking",
      "Email notifications",
      "Calendar sync",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    price: 99,
    tagline: "Best for small teams and growing media businesses.",
    listings: "300 listings per year",
    seats: "3 team members",
    featured: true,
    includesLabel: "Everything in Solo, plus:",
    features: [
      "Team scheduling + calendar sync",
      "Photographer assignment + dispatch",
      "SMS + email automations",
      "Service area routing",
      "Property websites + agent portal",
      "Promo codes + booking tools",
      "Scheduled gallery delivery",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 179,
    tagline: "Best for growing teams with higher listing volume.",
    listings: "600 listings per year",
    seats: "5 team members",
    featured: false,
    includesLabel: "Everything in Studio, plus:",
    features: [
      "Contractor pay management",
      "Advanced team permissions",
      "Custom domain",
      "Advanced analytics",
      "Priority support",
    ],
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="py-32 px-6 bg-white">
      <div className="max-w-5xl mx-auto">

        <div className="text-center mb-14">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Pricing</p>
          <h2 className="font-serif text-4xl text-navy mb-3 font-normal">
            Plans start at $49/month
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
            Every plan includes everything you need to run a professional media business. Pick the tier that matches your volume.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border p-8 flex flex-col ${
                plan.featured
                  ? "border-navy bg-navy text-white shadow-2xl md:scale-[1.03]"
                  : "border-gray-200 bg-white"
              }`}
            >
              {plan.featured && (
                <span className="text-xs text-gold tracking-widest uppercase block mb-3 font-semibold">
                  Most Popular
                </span>
              )}
              <h3 className={`font-serif text-2xl mb-1 font-normal ${plan.featured ? "text-white" : "text-navy"}`}>
                {plan.name}
              </h3>
              <p className={`text-xs leading-relaxed mb-6 ${plan.featured ? "text-white/55" : "text-gray-500"}`}>
                {plan.tagline}
              </p>

              <div className="flex items-end gap-1 mb-1">
                <span className={`text-4xl font-bold tracking-tight ${plan.featured ? "text-white" : "text-navy"}`}>
                  ${plan.price}
                </span>
                <span className={`text-xs mb-1.5 ${plan.featured ? "text-white/45" : "text-gray-400"}`}>/mo</span>
              </div>
              <p className={`text-xs font-semibold mb-0.5 ${plan.featured ? "text-gold" : "text-navy/70"}`}>
                {plan.listings}
              </p>
              <p className={`text-xs mb-7 ${plan.featured ? "text-white/40" : "text-gray-400"}`}>
                {plan.seats}
              </p>

              <p className={`text-xs font-semibold mb-3 ${plan.featured ? "text-white/65" : "text-gray-700"}`}>
                {plan.includesLabel}
              </p>
              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className={`text-xs flex items-start gap-2.5 ${plan.featured ? "text-white/75" : "text-gray-600"}`}>
                    <span className={`mt-0.5 shrink-0 ${plan.featured ? "text-gold" : "text-navy"}`}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/auth/register"
                className={`block text-center py-3.5 px-4 rounded-xl text-sm font-semibold transition-colors mt-auto ${
                  plan.featured
                    ? "bg-gold text-navy hover:bg-gold/90"
                    : "bg-navy text-white hover:bg-navy/90"
                }`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-400 text-xs mb-10">
          Need more capacity? Add listing credits anytime.
        </p>

        <div className="border border-gray-100 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/60">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-semibold text-navy text-sm">Scale: $349/month</h3>
              <span className="text-[10px] text-gray-400 border border-gray-200 rounded-full px-2 py-0.5 bg-white">
                For high-volume teams
              </span>
            </div>
            <p className="text-xs text-gray-500">
              1,000 listings/year · 10 team members · Multi-location readiness · Priority support
            </p>
          </div>
          <Link
            href="/auth/register"
            className="text-sm font-semibold text-navy border border-navy/20 px-5 py-2.5 rounded-xl hover:bg-navy/5 transition-colors whitespace-nowrap flex-shrink-0"
          >
            Get Started
          </Link>
        </div>

        <p className="text-center text-gray-400 text-xs mt-8">
          No contracts. Cancel anytime.
        </p>

      </div>
    </section>
  );
}
