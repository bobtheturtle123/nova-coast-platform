import Link from "next/link";

export const metadata = {
  title: "Aryeo vs Kyoria OS — Real Estate Photography Software Comparison",
  description:
    "See how Aryeo (Beam) compares to Kyoria OS for real estate photography business management. Team dispatch, service areas, payment-gated delivery, and all-in-one pricing.",
  alternates: { canonical: "https://kyoriaos.com/compare/aryeo-vs-kyoria-os" },
};

const ROWS = [
  {
    feature: "Built for real estate photography",
    kyoria: { value: "Yes", positive: true },
    competitor: { value: "Yes", positive: true },
  },
  {
    feature: "Online booking with deposit collection",
    kyoria: { value: "Yes", positive: true },
    competitor: { value: "Limited", positive: false },
  },
  {
    feature: "Service area routing and zone management",
    kyoria: { value: "Yes", positive: true },
    competitor: { value: "No", positive: false },
  },
  {
    feature: "Built-in team dispatch and photographer assignment",
    kyoria: { value: "Yes", positive: true },
    competitor: { value: "No", positive: false },
  },
  {
    feature: "Payment-gated gallery delivery",
    kyoria: { value: "Yes, automatic via Stripe", positive: true },
    competitor: { value: "No", positive: false },
  },
  {
    feature: "Gallery delivery for photos, video, floor plans, 3D tours",
    kyoria: { value: "Yes", positive: true },
    competitor: { value: "Yes", positive: true },
  },
  {
    feature: "Property websites",
    kyoria: { value: "In development", positive: false },
    competitor: { value: "Yes", positive: true },
  },
  {
    feature: "MLS integrations",
    kyoria: { value: "In development", positive: false },
    competitor: { value: "Yes", positive: true },
  },
  {
    feature: "Agent portal with order history",
    kyoria: { value: "Yes", positive: true },
    competitor: { value: "Limited", positive: false },
  },
  {
    feature: "Payments automation (deposit + balance collection)",
    kyoria: { value: "Yes, fully automated", positive: true },
    competitor: { value: "Partial", positive: false },
  },
  {
    feature: "All-in-one pricing (no per-feature add-ons)",
    kyoria: { value: "Yes", positive: true },
    competitor: { value: "No", positive: false },
  },
];

function CellValue({ value, positive }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm ${
        positive ? "text-navy font-medium" : "text-gray-400"
      }`}
    >
      {positive ? (
        <svg
          className="w-4 h-4 text-green-600 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 text-gray-300 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {value}
    </span>
  );
}

export default function AryeoCompare() {
  return (
    <div>
      {/* HERO */}
      <section className="bg-navy text-white py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-4">
            <Link href="/compare" className="text-white/40 text-xs hover:text-white/65 transition-colors">
              &larr; Compare
            </Link>
          </div>
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Software Comparison</p>
          <h1 className="font-serif text-4xl md:text-5xl font-normal leading-tight mb-5 max-w-3xl">
            Aryeo vs Kyoria OS
          </h1>
          <p className="text-white/55 text-lg max-w-2xl leading-relaxed">
            Aryeo (now also known as Beam) is an established real estate media platform with strong property website and MLS integration features. Kyoria OS focuses on the operational side of running a real estate photography business, with built-in team dispatch, service area routing, and payment-gated delivery.
          </p>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream border-b border-gray-100">
                  <th className="text-left px-6 py-4 font-semibold text-gray-500 text-xs uppercase tracking-widest w-1/2">
                    Feature
                  </th>
                  <th className="text-left px-6 py-4 font-semibold text-gray-500 text-xs uppercase tracking-widest w-1/4">
                    Aryeo
                  </th>
                  <th className="text-left px-6 py-4 font-semibold text-navy text-xs uppercase tracking-widest w-1/4">
                    Kyoria OS
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                  >
                    <td className="px-6 py-4 text-gray-700 font-medium">{row.feature}</td>
                    <td className="px-6 py-4">
                      <CellValue {...row.competitor} />
                    </td>
                    <td className="px-6 py-4">
                      <CellValue {...row.kyoria} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* DETAIL SECTION */}
      <section className="py-16 px-6 bg-cream border-y border-gray-100">
        <div className="max-w-2xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-3">Where Kyoria OS leads</p>
          <h2 className="font-serif text-2xl text-navy font-normal mb-4">Built for operational management</h2>
          <p className="text-gray-600 leading-relaxed text-sm">
            Kyoria OS is focused on the internal operations of your business. Team dispatch, photographer assignment, service area configuration, and payment-gated delivery are core features rather than afterthoughts. If you are managing a team of photographers across multiple zones, Kyoria OS handles that directly. The payment automation means you never release a gallery before you are paid, which changes how cash flow works for growing businesses.
          </p>
        </div>
      </section>

      {/* CALLOUT CARDS */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Service area routing",
              desc: "Define zones, assign pricing by area, and route bookings to the right photographers automatically.",
              href: "/features/service-areas",
            },
            {
              title: "Team dispatch",
              desc: "Assign jobs to photographers, track availability, and manage your full team from one view.",
              href: "/features/team-management",
            },
            {
              title: "Payment-gated delivery",
              desc: "Galleries unlock automatically when Stripe confirms payment. No follow-up, no manual release.",
              href: "/features/gallery-delivery",
            },
          ].map((c) => (
            <Link
              key={c.title}
              href={c.href}
              className="border border-gray-100 rounded-2xl p-6 hover:border-navy/20 hover:shadow-sm transition-all block"
            >
              <h3 className="font-semibold text-navy text-sm mb-2">{c.title}</h3>
              <p className="text-gray-500 text-xs leading-relaxed mb-3">{c.desc}</p>
              <span className="text-xs text-navy font-medium">Learn more &rarr;</span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-16 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <p className="text-gold text-xs tracking-[0.2em] uppercase mb-4">Kyoria OS</p>
          <h2 className="font-serif text-3xl text-white font-normal mb-4">
            Ready to see how Kyoria OS works for your business?
          </h2>
          <p className="text-white/50 text-sm mb-7 leading-relaxed">
            Set up your booking page, connect Stripe, and take your first booking today.
          </p>
          <Link
            href="/auth/register"
            className="inline-block bg-gold text-navy font-semibold px-8 py-4 rounded-xl hover:bg-gold/90 transition-colors text-sm"
          >
            Get Started &rarr;
          </Link>
        </div>
      </section>
    </div>
  );
}
