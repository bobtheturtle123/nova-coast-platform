import Link from "next/link";

export const metadata = {
  title: "Connect KyoriaOS to Your Other Apps (Zapier Guide) | KyoriaOS",
  description:
    "Step-by-step guide to automatically send your KyoriaOS bookings to Google Sheets, Slack, your CRM, and 6,000+ other apps using Zapier — no coding required.",
  alternates: { canonical: "https://kyoriaos.com/guides/zapier" },
};

const STEPS = [
  {
    n: 1,
    title: "Create a free Zapier account",
    body: (
      <>
        Go to <a href="https://zapier.com" target="_blank" rel="noopener noreferrer" className="text-[#3486cf] underline">zapier.com</a> and sign up.
        Zapier is the free middle-man that connects KyoriaOS to thousands of other apps — you don&apos;t install anything.
      </>
    ),
  },
  {
    n: 2,
    title: 'Create a new "Zap"',
    body: <>A “Zap” is just an automation: <em>“When this happens in KyoriaOS, do that in another app.”</em> Click <strong>Create → Zap</strong>.</>,
  },
  {
    n: 3,
    title: 'Choose "Webhooks by Zapier" as the trigger',
    body: <>For the first step (the trigger), search <strong>Webhooks by Zapier</strong> and select the event <strong>“Catch Hook”</strong>. This gives KyoriaOS a private address to send your bookings to.</>,
  },
  {
    n: 4,
    title: "Copy the web address Zapier shows you",
    body: <>Zapier will display a <strong>Custom Webhook URL</strong> that starts with <span className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">https://hooks.zapier.com/…</span>. Click to copy it.</>,
  },
  {
    n: 5,
    title: "Paste it into KyoriaOS",
    body: <>In KyoriaOS go to <strong>Settings → Connect to your other apps</strong>, paste the address, click <strong>Add</strong>, then <strong>Save</strong>. That&apos;s the connection made.</>,
  },
  {
    n: 6,
    title: "Tell Zapier what to do next",
    body: <>Back in Zapier, add the second step (the action) — for example <strong>“Create Spreadsheet Row”</strong> in Google Sheets, or <strong>“Send Channel Message”</strong> in Slack. Map the booking details Zapier received, then turn the Zap on.</>,
  },
];

const EXAMPLES = [
  { icon: "📊", t: "Log bookings to Google Sheets", d: "Every new booking becomes a row in a spreadsheet — great for accounting or tracking." },
  { icon: "💬", t: "Get a Slack or text alert when paid", d: "Know the moment a client pays, without checking the dashboard." },
  { icon: "📇", t: "Add clients to your CRM or mailing list", d: "New agents flow straight into HubSpot, Mailchimp, etc." },
  { icon: "📅", t: "Block time on another calendar", d: "Mirror confirmed shoots into a shared team calendar." },
];

export default function ZapierGuidePage() {
  return (
    <main style={{ background: "#F7F8FA", minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-[#3486cf] hover:underline">← Back to KyoriaOS</Link>

        <div className="mt-6 mb-10">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#3486cf]">Integrations Guide</span>
          <h1 className="font-display text-4xl text-[#0F172A] mt-2 leading-tight">
            Connect KyoriaOS to your other apps
          </h1>
          <p className="text-gray-500 mt-3 text-lg leading-relaxed">
            Automatically send your bookings to the tools you already use — Google Sheets, Slack, your CRM, and 6,000+ more.
            No coding, about 5 minutes to set up.
          </p>
        </div>

        {/* What you can do */}
        <div className="grid sm:grid-cols-2 gap-3 mb-12">
          {EXAMPLES.map((x) => (
            <div key={x.t} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="text-2xl mb-2">{x.icon}</div>
              <p className="font-semibold text-[#0F172A] text-sm">{x.t}</p>
              <p className="text-[13px] text-gray-500 mt-1 leading-snug">{x.d}</p>
            </div>
          ))}
        </div>

        {/* Steps */}
        <h2 className="font-display text-2xl text-[#0F172A] mb-6">Set it up in 6 steps</h2>
        <div className="space-y-4 mb-12">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-white border border-gray-200 rounded-2xl p-5 flex gap-4">
              <div className="w-9 h-9 rounded-full bg-[#3486cf] text-white font-bold flex items-center justify-center flex-shrink-0">{s.n}</div>
              <div>
                <p className="font-semibold text-[#0F172A]">{s.title}</p>
                <p className="text-[14px] text-gray-600 mt-1 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* What we send */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-12">
          <h2 className="font-semibold text-[#0F172A] mb-2">What KyoriaOS sends</h2>
          <p className="text-[14px] text-gray-600 mb-3">Your connected app is notified automatically when a booking is:</p>
          <ul className="space-y-2">
            {[
              ["Created", "A new booking comes in — the client name, property address, services, and price."],
              ["Paid", "A deposit or full payment succeeds."],
              ["Delivered", "You deliver the gallery to the client."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3 text-[14px]">
                <span className="font-semibold text-[#3486cf] w-20 flex-shrink-0">{t}</span>
                <span className="text-gray-600">{d}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="bg-[#0F172A] rounded-2xl p-8 text-center">
          <p className="text-white text-lg font-semibold mb-1">Ready to connect?</p>
          <p className="text-white/60 text-sm mb-5">Open Settings in your dashboard and look for “Connect to your other apps.”</p>
          <Link href="/dashboard/settings#settings-zapier"
            className="inline-block bg-white text-[#0F172A] font-semibold text-sm px-6 py-3 rounded-xl hover:opacity-90 transition-opacity">
            Go to Settings →
          </Link>
        </div>
      </div>
    </main>
  );
}
