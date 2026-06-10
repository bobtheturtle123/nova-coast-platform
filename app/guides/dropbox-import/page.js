import Link from "next/link";
import GuideShell, { Steps, GuideH2 } from "@/components/GuideShell";

export const metadata = {
  title: "How to Import Photos & Videos from Dropbox into KyoriaOS | KyoriaOS",
  description:
    "Connect your Dropbox account to KyoriaOS and import photos, videos, floor plans, and documents straight into a listing gallery. Step-by-step setup guide.",
  alternates: { canonical: "https://kyoriaos.com/guides/dropbox-import" },
};

const SETUP = [
  { title: "Open KyoriaOS integrations", body: <>Go to <strong>Settings → Integrations → Dropbox</strong> and expand the card.</> },
  { title: "Click Connect Dropbox", body: <>You&apos;ll be sent to Dropbox to sign in and approve access. KyoriaOS only requests permission to <strong>browse and download</strong> your files - nothing is changed in your Dropbox.</> },
  { title: "Approve and return", body: <>After you approve, Dropbox sends you back to KyoriaOS and the card shows <strong>Connected as your@email</strong>. Your access is stored encrypted and never shown to the browser.</> },
];

const IMPORT = [
  { title: "Open a listing gallery", body: <>Open the property gallery you want to add media to.</> },
  { title: "Add Media → Import from Dropbox", body: <>Click <strong>Import from Dropbox</strong> in the gallery&apos;s media area.</> },
  { title: "Browse and select files", body: <>Navigate your Dropbox folders and tick the photos, videos, floor plans (PDF), or documents you want. You can select many at once.</> },
  { title: "Import selected files", body: <>Click <strong>Import selected</strong>. KyoriaOS copies them into the gallery&apos;s own storage - they behave exactly like files you uploaded from your computer.</> },
];

export default function DropboxGuidePage() {
  return (
    <GuideShell
      eyebrow="Integrations Guide"
      title="Import photos & videos from Dropbox"
      intro="Connect your Dropbox account once, then pull photos, videos, floor plans, and documents straight into a listing gallery - no downloading and re-uploading."
      currentSlug="dropbox-import"
    >
      <GuideH2>Connect Dropbox (one time)</GuideH2>
      <Steps steps={SETUP} />

      <GuideH2>Import files</GuideH2>
      <Steps steps={IMPORT} />

      <GuideH2>Good to know</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3 text-[14px] text-gray-600">
        <p><strong>Supported files:</strong> photos (JPG, PNG, WebP, HEIC, TIFF), videos (MP4, MOV, WebM), and PDFs for floor plans/documents.</p>
        <p><strong>Large videos:</strong> very large files are best uploaded directly; imports are capped so a single huge file can&apos;t stall the gallery.</p>
        <p><strong>Files are copied, not linked.</strong> Once imported, the media lives in KyoriaOS - deleting it in Dropbox later won&apos;t affect the delivered gallery.</p>
        <p><strong>Only owners and admins</strong> can connect or disconnect Dropbox; anyone who can add media can import.</p>
      </div>

      <div className="mt-6">
        <Link href="/dashboard/settings#settings-dropbox" className="inline-block text-[13px] font-semibold text-[#3486cf] hover:underline">
          Open Dropbox in Settings →
        </Link>
      </div>
    </GuideShell>
  );
}
