import GuideShell, { Steps, GuideH2 } from "@/components/GuideShell";

export const metadata = {
  title: "How KyoriaOS Works - From Booking to Delivery | KyoriaOS",
  description:
    "A simple end-to-end overview of how KyoriaOS runs your real estate photography business: set up services, take bookings, schedule shoots, deliver galleries, and get paid.",
  alternates: { canonical: "https://kyoriaos.com/guides/getting-started" },
};

const FLOW = [
  { title: "Set up your services once", body: <>Add the packages, services, and add-ons you offer (photos, video, drone, floor plans, etc.) with prices. Clients book from this list. See the <a href="/guides/products" className="text-[#3486cf] underline">services guide</a>.</> },
  { title: "Share your booking link", body: <>You get a personal booking page at <span className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">kyoriaos.com/your-studio/book</span>. Put it in your email signature, website, and Instagram bio. Agents book and pay there.</> },
  { title: "A booking comes in", body: <>When an agent books, KyoriaOS collects their deposit (or full payment) via Stripe, creates the job, and notifies you. The agent gets a confirmation automatically.</> },
  { title: "Schedule & assign the shoot", body: <>Pick the date/time and assign a photographer. Connected calendars prevent double-booking. See the <a href="/guides/team-schedule" className="text-[#3486cf] underline">team &amp; scheduling guide</a>.</> },
  { title: "Shoot, then upload the media", body: <>After the shoot, upload photos, videos, floor plans, and a 3D tour into the listing&apos;s gallery. Everything stays organized per property.</> },
  { title: "Deliver the gallery", body: <>Hit deliver - the client gets a branded gallery to view and download, the remaining balance is requested automatically, and a property website + marketing materials become available. See the <a href="/guides/listings" className="text-[#3486cf] underline">listings guide</a>.</> },
  { title: "Get paid & keep clients coming back", body: <>Payments land in your Stripe account. Repeat clients are saved to your customer list, and you can ask for a Google review automatically on delivery.</> },
];

export default function GettingStartedGuide() {
  return (
    <GuideShell
      eyebrow="Getting Started"
      title="How KyoriaOS works"
      intro="KyoriaOS replaces the patchwork of tools real estate photographers juggle - booking, scheduling, payments, galleries, and marketing - with one connected system. Here's the whole flow."
      currentSlug="getting-started"
    >
      <GuideH2>The big picture</GuideH2>
      <p className="text-[15px] text-gray-600 leading-relaxed mb-2">
        Think of KyoriaOS as an assembly line for every shoot: a client books and pays, the job is scheduled and shot,
        the media is delivered, and the money is collected - each step flows into the next automatically, so nothing
        falls through the cracks.
      </p>

      <GuideH2>From booking to delivery, step by step</GuideH2>
      <Steps steps={FLOW} />

      <GuideH2>What you set up first</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <ul className="space-y-2.5 text-[14px] text-gray-700">
          <li>✅ <strong>Branding</strong> - your name, logo, and colors (used on galleries, the booking page, and emails).</li>
          <li>✅ <strong>Stripe</strong> - connect your account so payments go straight to you.</li>
          <li>✅ <strong>Services &amp; pricing</strong> - what clients can book and for how much.</li>
          <li>✅ <strong>Service area</strong> - where you work, so you only get bookable requests.</li>
          <li>✅ <strong>Team</strong> - add photographers if you&apos;re not solo.</li>
        </ul>
        <p className="text-[13px] text-gray-400 mt-4">The onboarding wizard walks you through all of this the first time you sign in.</p>
      </div>
    </GuideShell>
  );
}
