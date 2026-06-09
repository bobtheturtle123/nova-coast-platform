import GuideShell, { Steps, GuideH2 } from "@/components/GuideShell";

export const metadata = {
  title: "Import Your Clients from Aryeo, HD Photo Hub, or CSV | KyoriaOS",
  description:
    "Switching to KyoriaOS? Bring your existing clients with you. Export a CSV from Aryeo or HD Photo Hub and import them into your customer list in seconds.",
  alternates: { canonical: "https://kyoriaos.com/guides/importing-clients" },
};

const STEPS = [
  { title: "Export a CSV from your old tool", body: <>In Aryeo, HD Photo Hub, or any CRM, export your contacts/clients to a <strong>CSV file</strong>. Most tools have this under Contacts → Export.</> },
  { title: "Open the importer", body: <>In KyoriaOS go to <strong>Dashboard → Customers → Import</strong>.</> },
  { title: "Upload the file", body: <>Drop in the CSV. KyoriaOS automatically recognizes common columns (name, email, phone, brokerage) from Aryeo, HD Photo Hub, and generic exports.</> },
  { title: "Review and import", body: <>It shows how many contacts it found, skips duplicates by email, and adds the rest to your customer list. You&apos;ll get a confirmation email when it&apos;s done.</> },
];

export default function ImportingClientsGuide() {
  return (
    <GuideShell
      eyebrow="Migrating In"
      title="Importing your clients"
      intro="Moving from another platform? Don't leave your client list behind. Import everyone in a couple of minutes with a simple CSV."
      currentSlug="importing-clients"
    >
      <GuideH2>Import in 4 steps</GuideH2>
      <Steps steps={STEPS} />

      <GuideH2>What gets imported</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <ul className="space-y-2.5 text-[14px] text-gray-700">
          <li>👤 Client / agent name</li>
          <li>✉️ Email (used to match and de-duplicate)</li>
          <li>📞 Phone</li>
          <li>🏢 Brokerage / company</li>
          <li>📝 Notes (e.g. license number, if present)</li>
        </ul>
        <p className="text-[12px] text-gray-400 mt-4">
          Don&apos;t have a CSV? Download the template from inside the import window and fill it in. Up to 500 contacts per import.
        </p>
      </div>
    </GuideShell>
  );
}
