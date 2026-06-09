import GuideShell, { Steps, GuideH2 } from "@/components/GuideShell";

export const metadata = {
  title: "Listings Explained — From Shoot to Delivered Media | KyoriaOS",
  description:
    "Understand listings in KyoriaOS: how a booking becomes a listing, the workflow stages, the gallery, property website, payments, revisions, and marketing materials.",
  alternates: { canonical: "https://kyoriaos.com/guides/listings" },
};

const STAGES = [
  { title: "Booked", body: "The agent has booked and (usually) paid a deposit. The job is on your calendar." },
  { title: "Confirmed & assigned", body: "You've locked the date/time and assigned a photographer." },
  { title: "Shot", body: "The shoot is done — time to upload the media." },
  { title: "Editing & QA", body: "Photos are edited; you review before sending." },
  { title: "Delivered", body: "The gallery goes to the client, the balance is requested, and marketing unlocks." },
];

const TABS = [
  { icon: "🖼️", t: "Gallery", d: "All the media for the property — photos, video, floor plans, 3D tour, documents. This is what you deliver." },
  { icon: "💳", t: "Payments", d: "The order, what's been paid, and buttons to collect the deposit, balance, or send an invoice." },
  { icon: "🌐", t: "Property Site", d: "A single-property website (template, colors, details) you can publish for the listing." },
  { icon: "📣", t: "Marketing", d: "Brochure, QR code, shareable link, and analytics — available once the client has paid." },
  { icon: "✏️", t: "Revisions", d: "Change requests from the agent, with the exact photos they flagged." },
  { icon: "📊", t: "Activity", d: "A log of views, downloads, and key events on the listing." },
];

export default function ListingsGuide() {
  return (
    <GuideShell
      eyebrow="Listings"
      title="Listings explained"
      intro="A listing is the home base for one property shoot — everything about that job lives in one place, from the booking and payments to the gallery, property website, and marketing."
      currentSlug="listings"
    >
      <GuideH2>Booking vs. listing</GuideH2>
      <p className="text-[15px] text-gray-600 leading-relaxed">
        Every paid job starts as a <strong>booking</strong>. Once it&apos;s active, it becomes a <strong>listing</strong> —
        which adds the gallery, a publishable property website, client portal access, and marketing tools. Think of the
        booking as the order, and the listing as the workspace where you fulfill it.
      </p>

      <GuideH2>The workflow stages</GuideH2>
      <p className="text-[14px] text-gray-500 mb-4">Each listing moves through a simple status line, updated automatically as you work:</p>
      <Steps steps={STAGES} />

      <GuideH2>What's inside a listing</GuideH2>
      <div className="grid sm:grid-cols-2 gap-3">
        {TABS.map((x) => (
          <div key={x.t} className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="text-2xl mb-2">{x.icon}</div>
            <p className="font-semibold text-[#0F172A] text-sm">{x.t}</p>
            <p className="text-[13px] text-gray-500 mt-1 leading-snug">{x.d}</p>
          </div>
        ))}
      </div>

      <GuideH2>Delivering media</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <ul className="space-y-2.5 text-[14px] text-gray-700">
          <li>📤 <strong>Deliver</strong> emails the client a branded gallery and unlocks downloads.</li>
          <li>💰 Any <strong>outstanding balance</strong> is requested at the same moment — you don&apos;t have to chase it.</li>
          <li>🌐 The <strong>property website</strong> and <strong>marketing materials</strong> (brochure, QR) become available once paid.</li>
          <li>⭐ You can automatically ask the client for a <strong>Google review</strong> on delivery.</li>
        </ul>
      </div>
    </GuideShell>
  );
}
