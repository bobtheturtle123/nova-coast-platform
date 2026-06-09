import GuideShell, { Steps, GuideH2 } from "@/components/GuideShell";

export const metadata = {
  title: "Setting Up Your Services, Packages & Add-ons | KyoriaOS",
  description:
    "Learn how to build the services, packages, and add-ons clients book on KyoriaOS — including tiered pricing by square footage and how it all appears on your booking page.",
  alternates: { canonical: "https://kyoriaos.com/guides/products" },
};

const TYPES = [
  { icon: "📦", t: "Packages", d: "Bundles you sell as one price — e.g. “Listing Premium: 30 photos + drone + floor plan.” The main thing most agents pick." },
  { icon: "🧩", t: "Services", d: "Individual offerings — photography, video, twilight, 3D tour. Sold alone or grouped inside packages." },
  { icon: "➕", t: "Add-ons", d: "Optional extras a client tacks on at checkout — extra photos, rush delivery, virtual staging." },
];

const STEPS = [
  { title: "Go to Products in your dashboard", body: <>Open <strong>Dashboard → Products</strong>. You&apos;ll see tabs for Packages, Services, and Add-ons.</> },
  { title: "Add a service or package", body: <>Click <strong>+ New</strong>, give it a name, a short description, and a price. For packages, choose which services are included.</> },
  { title: "Choose how it's priced", body: <>Flat price for everything, or <strong>tiered by square footage</strong> (e.g. under 2,500 sq ft = $200, 2,500–4,000 = $275). Tiered pricing auto-adjusts the quote based on what the client enters.</> },
  { title: "Set a photographer pay rate (optional)", body: <>If you have a team, enter what the shooter earns for this item. KyoriaOS uses it to suggest pay on each booking.</> },
  { title: "Mark it active", body: <>Active items show on your public booking page immediately. Toggle anything off to hide it without deleting it.</> },
];

export default function ProductsGuide() {
  return (
    <GuideShell
      eyebrow="Services & Pricing"
      title="Setting up what clients can book"
      intro="Your services are the menu clients order from. Set them up once and they appear on your booking page, flow into every quote, and drive your reports."
      currentSlug="products"
    >
      <GuideH2>Three building blocks</GuideH2>
      <div className="grid sm:grid-cols-3 gap-3">
        {TYPES.map((x) => (
          <div key={x.t} className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="text-2xl mb-2">{x.icon}</div>
            <p className="font-semibold text-[#0F172A] text-sm">{x.t}</p>
            <p className="text-[13px] text-gray-500 mt-1 leading-snug">{x.d}</p>
          </div>
        ))}
      </div>

      <GuideH2>How to add one</GuideH2>
      <Steps steps={STEPS} />

      <GuideH2>Tips for a clean menu</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <ul className="space-y-2.5 text-[14px] text-gray-700">
          <li>🎯 <strong>Lead with packages.</strong> Most agents want one clear choice, not a long à la carte list.</li>
          <li>💬 <strong>Write benefit-focused descriptions.</strong> “Same-day delivery” beats “25 images.”</li>
          <li>📐 <strong>Use tiered pricing</strong> if bigger homes take more time — it keeps quotes fair automatically.</li>
          <li>➕ <strong>Keep add-ons short.</strong> 3–5 high-value extras convert better than twenty.</li>
        </ul>
      </div>
    </GuideShell>
  );
}
