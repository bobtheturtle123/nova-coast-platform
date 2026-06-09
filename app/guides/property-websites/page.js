import GuideShell, { Steps, GuideH2 } from "@/components/GuideShell";

export const metadata = {
  title: "Property Websites — Single-Property Sites for Your Listings | KyoriaOS",
  description:
    "Publish a beautiful single-property website for each listing in KyoriaOS: pick a template and colors, add property details and agents, and share the link or QR code.",
  alternates: { canonical: "https://kyoriaos.com/guides/property-websites" },
};

const STEPS = [
  { title: "Open the listing's Property Site tab", body: <>From any listing, go to the <strong>Property Site</strong> tab. This is where the public single-property website is built.</> },
  { title: "Pick a template & colors", body: <>Choose a layout (Modern, Classic, Luxury) and a color scheme. Changes preview instantly and apply the moment you save — no need to unpublish.</> },
  { title: "Add the property details", body: <>Fill in beds, baths, sq ft, price, description, and features. Use <strong>Auto-fill</strong> to pull details from an MLS/Redfin link, or type them in.</> },
  { title: "Add the agent(s)", body: <>Add the listing agent&apos;s name, photo, brokerage, and contact info. You can list a primary agent plus co-agents.</> },
  { title: "Publish & share", body: <>Hit <strong>Publish</strong>. The site goes live at <span className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">kyoriaos.com/your-studio/property/…</span>. Share the link, QR code, or print brochure from the Marketing tab.</> },
];

export default function PropertyWebsitesGuide() {
  return (
    <GuideShell
      eyebrow="Property Websites"
      title="Single-property websites"
      intro="Give every listing its own polished web page — photos, details, a map, and the agent's contact info — that agents love to share. No web design needed."
      currentSlug="property-websites"
    >
      <GuideH2>Build one in 5 steps</GuideH2>
      <Steps steps={STEPS} />

      <GuideH2>What's on a property site</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <ul className="space-y-2.5 text-[14px] text-gray-700">
          <li>🖼️ A full photo gallery (and video / 3D tour if you added them)</li>
          <li>📋 Property stats, description, and feature list</li>
          <li>📍 A map of the location</li>
          <li>👤 Agent card with headshot and contact details</li>
          <li>✉️ A contact / inquiry form that emails the agent</li>
          <li>🔗 A clean shareable URL, QR code, and printable brochure</li>
        </ul>
        <p className="text-[12px] text-gray-400 mt-4">Tip: the agent can even map their own custom domain to the property site from the same tab.</p>
      </div>
    </GuideShell>
  );
}
