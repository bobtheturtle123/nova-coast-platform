import Link from "next/link";
import GuideShell, { Steps, GuideH2 } from "@/components/GuideShell";

export const metadata = {
  title: "How to Import CubiCasa Floor Plans into KyoriaOS | KyoriaOS",
  description:
    "Connect your CubiCasa company account to KyoriaOS with your API key and import finished floor plans straight into a listing gallery. Step-by-step setup guide.",
  alternates: { canonical: "https://kyoriaos.com/guides/cubicasa-import" },
};

const SETUP = [
  { title: "Open your CubiCasa company account", body: <>Sign in at <a href="https://app.cubi.casa" target="_blank" rel="noopener noreferrer" className="text-[#3486cf] underline">app.cubi.casa</a> with the account your company uses to order floor plans.</> },
  { title: "Generate an API key", body: <>Go to your CubiCasa <strong>company / developer settings</strong> and create an <strong>API key</strong>. CubiCasa lets every company generate its own key - you do not need a special partnership. Copy the key.</> },
  { title: "Open KyoriaOS integrations", body: <>In KyoriaOS go to <strong>Settings → Integrations → CubiCasa</strong> and expand the card.</> },
  { title: "Enter your email + API key", body: <>Type the <strong>CubiCasa account email</strong> and paste the <strong>API key</strong>, then click <strong>Connect CubiCasa</strong>. We verify the key with CubiCasa before saving, and store it encrypted - it is never shown again.</> },
  { title: "Confirm it connected", body: <>The card flips to <strong>Connected</strong> and shows your company name. Use <strong>Test connection</strong> any time to re-check.</> },
];

const IMPORT = [
  { title: "Open a listing gallery", body: <>Go to <strong>Listings</strong> (or Galleries) and open the property you are working on.</> },
  { title: "Add Media → Import from CubiCasa", body: <>In the gallery&apos;s media area, click <strong>Import from CubiCasa</strong>.</> },
  { title: "Pick the finished floor plan", body: <>Your completed CubiCasa orders appear with the property address. Select the floor plan file you want (PDF or image).</> },
  { title: "Import", body: <>Click <strong>Import floor plan</strong>. KyoriaOS downloads it from CubiCasa and saves it into the gallery&apos;s <strong>Floor Plans</strong>, just like a manual upload - delivered to the client automatically.</> },
];

export default function CubiCasaGuidePage() {
  return (
    <GuideShell
      eyebrow="Integrations Guide"
      title="Import CubiCasa floor plans into KyoriaOS"
      intro="Connect your own CubiCasa company account with an API key, then pull finished floor plans straight into a listing gallery - no downloading and re-uploading."
      currentSlug="cubicasa-import"
    >
      <GuideH2>Connect CubiCasa (one time)</GuideH2>
      <Steps steps={SETUP} />

      <GuideH2>Import a floor plan</GuideH2>
      <Steps steps={IMPORT} />

      <GuideH2>Good to know</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3 text-[14px] text-gray-600">
        <p><strong>Your key, your account.</strong> Each company connects its own CubiCasa account. We never share keys between businesses, and the key is encrypted at rest.</p>
        <p><strong>Only owners and admins</strong> can connect or disconnect integrations. Anyone who can add media to a gallery can import a connected floor plan.</p>
        <p><strong>Don&apos;t see your orders?</strong> Make sure the order is <em>completed/delivered</em> in CubiCasa and that the API key belongs to the same company account. Re-run <strong>Test connection</strong> in Settings.</p>
        <p><strong>3D / floor-plan tours</strong> (an interactive walk-through link) are added separately in the gallery&apos;s <Link href="/guides/3d-tours" className="text-[#3486cf] underline">3D Tour</Link> section.</p>
      </div>

      <div className="mt-6">
        <Link href="/dashboard/settings#settings-cubicasa" className="inline-block text-[13px] font-semibold text-[#3486cf] hover:underline">
          Open CubiCasa in Settings →
        </Link>
      </div>
    </GuideShell>
  );
}
