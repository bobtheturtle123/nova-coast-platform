import Link from "next/link";
import GuideShell, { Steps, GuideH2 } from "@/components/GuideShell";

export const metadata = {
  title: "Connect KyoriaOS to Your Other Apps with Zapier | KyoriaOS",
  description:
    "Step-by-step guide to automatically send your KyoriaOS bookings to Google Sheets, Slack, your CRM, and 6,000+ other apps using Zapier - no coding required.",
  alternates: { canonical: "https://kyoriaos.com/guides/zapier" },
};

const EXAMPLES = [
  { icon: "📊", t: "Log bookings to Google Sheets", d: "Every new booking becomes a row in a spreadsheet - great for accounting or tracking." },
  { icon: "💬", t: "Get a Slack or text alert when paid", d: "Know the moment a client pays, without checking the dashboard." },
  { icon: "📇", t: "Add clients to your CRM or mailing list", d: "New agents flow straight into HubSpot, Mailchimp, etc." },
  { icon: "📅", t: "Block time on another calendar", d: "Mirror confirmed shoots into a shared team calendar." },
];

const STEPS = [
  { title: "Create a free Zapier account", body: <>Go to <a href="https://zapier.com" target="_blank" rel="noopener noreferrer" className="text-[#3486cf] underline">zapier.com</a> and sign up. <strong>Zapier is a separate service</strong> (free to start) that acts as the middle-man connecting KyoriaOS to thousands of other apps - you don&apos;t install anything.</> },
  { title: 'Create a new "Zap"', body: <>A “Zap” is just an automation: <em>“When this happens in KyoriaOS, do that in another app.”</em> Click <strong>Create → Zap</strong>.</> },
  { title: 'Choose "Webhooks by Zapier" as the trigger', body: <>For the first step, search <strong>Webhooks by Zapier</strong> and select <strong>“Catch Hook”</strong>. This gives KyoriaOS a private address to send your bookings to.</> },
  { title: "Copy the web address Zapier shows you", body: <>Zapier displays a <strong>Custom Webhook URL</strong> starting with <span className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">https://hooks.zapier.com/…</span>. Click to copy it.</> },
  { title: "Paste it into KyoriaOS", body: <>In KyoriaOS go to <strong>Settings → Connect to your other apps</strong>, paste the address, click <strong>Add</strong>, then <strong>Save</strong>.</> },
  { title: "Tell Zapier what to do next", body: <>Back in Zapier, add the action - e.g. <strong>“Create Spreadsheet Row”</strong> in Google Sheets or <strong>“Send Channel Message”</strong> in Slack - then turn the Zap on.</> },
];

export default function ZapierGuidePage() {
  return (
    <GuideShell
      eyebrow="Integrations Guide"
      title="Connect KyoriaOS to your other apps"
      intro="Automatically send your bookings to the tools you already use - Google Sheets, Slack, your CRM, and 6,000+ more - through Zapier. No coding, about 5 minutes to set up."
      currentSlug="zapier"
    >
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {EXAMPLES.map((x) => (
          <div key={x.t} className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="text-2xl mb-2">{x.icon}</div>
            <p className="font-semibold text-[#0F172A] text-sm">{x.t}</p>
            <p className="text-[13px] text-gray-500 mt-1 leading-snug">{x.d}</p>
          </div>
        ))}
      </div>

      <GuideH2>Set it up in 6 steps</GuideH2>
      <Steps steps={STEPS} />

      <GuideH2>What KyoriaOS sends</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <p className="text-[14px] text-gray-600 mb-3">Your connected app is notified automatically when a booking is:</p>
        <ul className="space-y-2">
          {[
            ["Created", "A new booking comes in - client name, property address, services, and price."],
            ["Paid", "A deposit or full payment succeeds."],
            ["Delivered", "You deliver the gallery to the client."],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-3 text-[14px]">
              <span className="font-semibold text-[#3486cf] w-20 flex-shrink-0">{t}</span>
              <span className="text-gray-600">{d}</span>
            </li>
          ))}
        </ul>
        <Link href="/dashboard/settings#settings-zapier" className="inline-block text-[13px] font-semibold text-[#3486cf] mt-4 hover:underline">
          Open this in Settings →
        </Link>
      </div>
    </GuideShell>
  );
}
