"use client";

import { useState } from "react";
import Link from "next/link";

const PLANS = [
  {
    id: "solo", name: "Solo", monthlyPrice: 39, yearlyMonthly: 33,
    tagline: "Everything you need to start taking bookings today.",
    feePct: "2.0%",
    listings: 25, seats: "1 user", archive: "6-month archive",
    featured: false,
    features: [
      "25 active listings",
      "1 team member",
      "Branded booking page",
      "Stripe Connect payouts",
      "Media galleries + delivery",
      "Email notifications",
      "Agent portal",
    ],
  },
  {
    id: "studio", name: "Studio", monthlyPrice: 89, yearlyMonthly: 76,
    tagline: "Built for teams. Scales as you hire.",
    feePct: "1.5%",
    listings: 75, seats: "Up to 5 users", archive: "12-month archive",
    featured: true,
    features: [
      "75 active listings",
      "Up to 5 team members",
      "Branded booking page",
      "Stripe Connect payouts",
      "Media galleries + delivery",
      "Email + SMS notifications",
      "Agent portal + property websites",
      "Service areas + zone routing",
      "Custom booking form fields",
    ],
  },
  {
    id: "pro", name: "Pro", monthlyPrice: 179, yearlyMonthly: 152,
    tagline: "The full platform for serious studios.",
    feePct: "1.25%",
    listings: 150, seats: "Up to 15 users", archive: "18-month archive",
    featured: false,
    features: [
      "150 active listings",
      "Up to 15 team members",
      "Everything in Studio",
      "AI social captions + descriptions",
      "Promo / discount codes",
      "Contractor pay rate tracking",
      "Advanced reporting",
      "Custom domain",
    ],
  },
  {
    id: "scale", name: "Scale", monthlyPrice: 349, yearlyMonthly: 297,
    tagline: "Franchise-ready. No limits on growth.",
    feePct: "1.0%",
    listings: "300+", seats: "Unlimited users", archive: "24-month archive",
    featured: false,
    features: [
      "300+ active listings",
      "Unlimited team members",
      "Everything in Pro",
      "White-label (custom domain + branding)",
      "Priority support",
      "Franchise / multi-location ready",
    ],
  },
];

const ADDONS = [
  { name: "+25 active listings", price: "$49/mo", desc: "Need a few more slots during a busy quarter?" },
  { name: "+50 active listings", price: "$89/mo", desc: "Bulk expansion at a better rate than two +25 packs." },
  { name: "Additional team member", price: "$10/mo per seat", desc: "Add photographers or staff one at a time." },
  {
    name: "Bring Your Own Payments (BYOP)", price: "$79/mo",
    desc: "Remove the platform transaction fee. You handle payments manually outside ShootFlow, no automatic deposits, no 'Pay Now' buttons, no payment automation. For advanced users with existing external payment workflows.",
    warning: true,
  },
];

export default function PricingSection() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="py-32 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14">
          <h2 className="font-serif text-4xl text-navy mb-4 font-normal">Simple, transparent pricing</h2>
          <p className="text-gray-500 mb-6">All plans include a 14-day free trial. No credit card required to start.</p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-gray-100 rounded-full p-1">
            <button
              onClick={() => setYearly(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                !yearly ? "bg-white text-navy shadow-sm" : "text-gray-500"
              }`}>
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                yearly ? "bg-white text-navy shadow-sm" : "text-gray-500"
              }`}>
              Yearly
              <span className="ml-1.5 text-xs text-emerald-600 font-semibold">Save 15%</span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {PLANS.map((plan) => {
            const price = yearly ? plan.yearlyMonthly : plan.monthlyPrice;
            return (
              <div key={plan.id}
                className={`rounded-sm border p-7 flex flex-col ${
                  plan.featured ? "border-navy bg-navy text-white shadow-md" : "border-gray-100 bg-white hover:border-gray-200 transition-colors"
                }`}>
                {plan.featured && (
                  <span className="text-xs text-gold tracking-widest uppercase block mb-3">Most Popular</span>
                )}
                <h3 className={`font-serif text-2xl mb-1 font-normal ${plan.featured ? "text-white" : "text-navy"}`}>
                  {plan.name}
                </h3>
                <div className="flex items-end gap-1 my-3">
                  <span className={`text-3xl font-bold ${plan.featured ? "text-white" : "text-navy"}`}>
                    ${price}
                  </span>
                  <span className={`text-xs mb-1 ${plan.featured ? "text-white/60" : "text-gray-400"}`}>
                    /mo{yearly ? " · billed annually" : ""}
                  </span>
                </div>
                <p className={`text-xs mb-1 ${plan.featured ? "text-white/70" : "text-gray-500"}`}>
                  + {plan.feePct} platform fee per transaction
                </p>
                <p className={`text-xs mb-4 ${plan.featured ? "text-white/50" : "text-gray-400"}`}>
                  {plan.seats} · {plan.archive}
                </p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className={`text-xs flex items-start gap-1.5 ${plan.featured ? "text-white/80" : "text-gray-600"}`}>
                      <span className={`mt-0.5 ${plan.featured ? "text-gold" : "text-navy"}`}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/register"
                  className={`block text-center py-2.5 px-4 rounded-sm text-sm font-semibold transition-colors mt-auto ${
                    plan.featured ? "bg-gold text-navy hover:bg-gold/90" : "bg-navy text-white hover:bg-navy/90"
                  }`}>
                  Start free trial
                </Link>
              </div>
            );
          })}
        </div>

        <p className="text-center text-gray-400 text-xs mb-16">
          All fees displayed as "+ Stripe processing fees". Transaction fees do not change with annual billing.
        </p>

        {/* Add-ons */}
        <div className="border-t border-gray-100 pt-12">
          <div className="text-center mb-8">
            <h3 className="font-serif text-2xl text-navy mb-2 font-normal">Scale with your business</h3>
            <p className="text-gray-500 text-sm">Add capacity any time. Cancel or change add-ons as your needs shift.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
            {ADDONS.map((addon) => (
              <div key={addon.name}
                className={`p-6 rounded-sm border ${addon.warning ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-white"}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className={`font-semibold text-sm ${addon.warning ? "text-amber-900" : "text-navy"}`}>
                    {addon.name}
                  </p>
                  <span className={`text-sm font-bold whitespace-nowrap ${addon.warning ? "text-amber-700" : "text-navy"}`}>
                    {addon.price}
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${addon.warning ? "text-amber-700" : "text-gray-500"}`}>
                  {addon.desc}
                </p>
                {addon.warning && (
                  <p className="text-xs text-amber-600 font-medium mt-2">
                    Not recommended for most users, Stripe Connect is faster and fully automated.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
