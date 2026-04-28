"use client";

import Link from "next/link";

const PLANS = [
  {
    id: "solo",
    name: "Solo",
    monthlyPrice: 79,
    tagline: "For solo photographers ready to run a real business.",
    credits: "120 listing credits / year",
    seats: "1 owner account",
    featured: false,
    features: [
      "Booking page + payment requests",
      "Invoicing",
      "Secure hosted gallery delivery",
      "Client portal",
      "CRM basics",
      "Email notifications",
      "Basic AI assistance",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    monthlyPrice: 159,
    tagline: "The complete operating system for your media business.",
    credits: "300 listing credits / year",
    seats: "5 included team seats",
    featured: true,
    features: [
      "Everything in Solo",
      "Office admin + manager seats",
      "Photographer + videographer seats",
      "Shooter calendar syncing",
      "Assignment + QA workflows",
      "Scheduled gallery releases",
      "SMS + email automations",
      "Property websites",
      "Agent portal",
      "Service area routing",
      "Promo tools",
      "AI pricing import assistant",
      "AI support chatbot",
      "AI caption + description tools",
    ],
  },
  {
    id: "pro",
    name: "Pro Team",
    monthlyPrice: 279,
    tagline: "Built for fast-growing teams that need full control.",
    credits: "600 listing credits / year",
    seats: "12 included team seats",
    featured: false,
    features: [
      "Everything in Studio",
      "Contractor pay management",
      "Advanced team permissions",
      "Lead routing",
      "Custom domain",
      "Advanced analytics dashboard",
      "Priority support",
      "Expanded AI assistance",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    monthlyPrice: 449,
    tagline: "Enterprise-ready. Built for multi-location operations.",
    credits: "1,200 listing credits / year",
    seats: "Unlimited seats",
    featured: false,
    features: [
      "Everything in Pro Team",
      "Multi-location + franchise readiness",
      "Enterprise assistance",
      "Highest AI assistance tier",
    ],
  },
];

const ADDONS = [
  {
    name: "Additional internal team member",
    price: "$19/mo",
    billing: "per active seat",
    desc: "Add photographers, videographers, admins, or managers one at a time. Agents and clients are never charged as seats.",
  },
  {
    name: "+25 Listing Credits",
    price: "$175",
    billing: "one-time",
    desc: "Permanently adds 25 credits to your current annual cycle. Stacks with additional packs. Non-refundable after purchase.",
    oneTime: true,
  },
  {
    name: "+50 Listing Credits",
    price: "$325",
    billing: "one-time",
    desc: "Permanently adds 50 credits to your current annual cycle. Best value for a single busy season. Non-refundable after purchase.",
    oneTime: true,
  },
  {
    name: "+100 Listing Credits",
    price: "$600",
    billing: "one-time",
    desc: "Permanently adds 100 credits to your current annual cycle. Ideal for high-volume periods. Non-refundable after purchase.",
    oneTime: true,
  },
];

const PERSONAS = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
    title: "Built for Admin Teams",
    desc: "Manage bookings, assign jobs, track delivery, and handle invoicing — all from one dashboard.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
      </svg>
    ),
    title: "Built for Photographers",
    desc: "View your schedule, sync your calendar, receive job assignments, and deliver media — from anywhere.",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
    title: "Built for Agents",
    desc: "Access a permanent branded portal for all your listings, photos, property websites, and social captions.",
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="py-32 px-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="font-serif text-4xl text-navy mb-5 font-normal">
            Pricing built to grow your media business
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
            From office admins to field photographers to agent delivery, KyoriaOS keeps your entire operation running in one place.
          </p>
        </div>

        {/* 3-persona trust strip */}
        <div className="grid md:grid-cols-3 gap-5 mb-16">
          {PERSONAS.map((p) => (
            <div key={p.title} className="text-center p-7 rounded-xl border border-gray-100 bg-white">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-navy/5 text-navy mb-4">
                {p.icon}
              </div>
              <h3 className="font-semibold text-navy text-sm mb-2">{p.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-5">
          {PLANS.map((plan) => (
            <div key={plan.id}
              className={`rounded-xl border p-7 flex flex-col ${
                plan.featured
                  ? "border-navy bg-navy text-white shadow-xl ring-2 ring-navy/10"
                  : "border-gray-100 bg-white hover:border-gray-200 transition-colors"
              }`}>
              {plan.featured && (
                <span className="text-xs text-gold tracking-widest uppercase block mb-3 font-semibold">
                  Most Popular
                </span>
              )}
              <h3 className={`font-serif text-2xl mb-2 font-normal ${plan.featured ? "text-white" : "text-navy"}`}>
                {plan.name}
              </h3>
              <p className={`text-xs leading-relaxed mb-5 ${plan.featured ? "text-white/60" : "text-gray-500"}`}>
                {plan.tagline}
              </p>
              <div className="flex items-end gap-1 mb-2">
                <span className={`text-4xl font-bold tracking-tight ${plan.featured ? "text-white" : "text-navy"}`}>
                  ${plan.monthlyPrice}
                </span>
                <span className={`text-xs mb-1.5 ${plan.featured ? "text-white/50" : "text-gray-400"}`}>/mo</span>
              </div>
              <p className={`text-xs font-semibold mb-1 ${plan.featured ? "text-gold" : "text-navy"}`}>
                {plan.credits}
              </p>
              <p className={`text-xs mb-6 ${plan.featured ? "text-white/40" : "text-gray-400"}`}>
                {plan.seats}
              </p>
              <ul className="space-y-2.5 mb-7 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className={`text-xs flex items-start gap-2 ${plan.featured ? "text-white/80" : "text-gray-600"}`}>
                    <span className={`mt-0.5 shrink-0 font-bold ${plan.featured ? "text-gold" : "text-navy"}`}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register"
                className={`block text-center py-3 px-4 rounded-xl text-sm font-semibold transition-colors mt-auto ${
                  plan.featured
                    ? "bg-gold text-navy hover:bg-gold/90"
                    : "bg-navy text-white hover:bg-navy/90"
                }`}>
                Start free trial
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-400 text-xs mb-16">
          All plans include a 14-day free trial. No credit card required to start.
        </p>

        {/* Add-ons */}
        <div className="border-t border-gray-100 pt-14">
          <div className="text-center mb-10">
            <h3 className="font-serif text-2xl text-navy mb-2 font-normal">Add capacity as you grow</h3>
            <p className="text-gray-500 text-sm">Expand any plan with add-ons. Adjust or cancel at any time.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {ADDONS.map((addon) => (
              <div key={addon.name}
                className={`p-6 rounded-xl border ${addon.oneTime ? "border-navy/10 bg-navy/[0.02]" : "border-gray-100 bg-white"}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="font-semibold text-sm leading-snug text-navy">{addon.name}</p>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold block whitespace-nowrap text-navy">{addon.price}</span>
                    <span className={`text-xs whitespace-nowrap ${addon.oneTime ? "text-navy/50 font-medium" : "text-gray-400"}`}>
                      {addon.billing}
                    </span>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-gray-500">{addon.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
