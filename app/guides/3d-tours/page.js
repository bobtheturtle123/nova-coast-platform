import Link from "next/link";
import GuideShell, { Steps, GuideH2 } from "@/components/GuideShell";

export const metadata = {
  title: "How to Add a 3D Tour (iGuide, Matterport) to a Gallery | KyoriaOS",
  description:
    "Embed an iGuide, Matterport, or Zillow 3D Home tour into your KyoriaOS client gallery in seconds. Step-by-step guide - no API or extra account needed.",
  alternates: { canonical: "https://kyoriaos.com/guides/3d-tours" },
};

const STEPS = [
  { title: "Get your tour link", body: <>From iGuide, Matterport, Zillow 3D Home, or another provider, copy the public tour URL (for example <span className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">youriguide.com/...</span> or <span className="font-mono text-sm bg-gray-100 px-1.5 py-0.5 rounded">my.matterport.com/show/?m=...</span>).</> },
  { title: "Open the gallery's 3D Tour section", body: <>In the listing gallery, expand the <strong>3D Tour</strong> section under Property Extras.</> },
  { title: "Paste the link", body: <>Paste the URL into the field. KyoriaOS recognizes the provider (you&apos;ll see an <strong>iGuide detected</strong> badge for iGuide links) and saves it.</> },
  { title: "Delivered automatically", body: <>The tour is embedded right in the client gallery alongside the photos - the agent can open the interactive walk-through without leaving the page.</> },
];

export default function ThreeDToursGuidePage() {
  return (
    <GuideShell
      eyebrow="Guide"
      title="Add a 3D tour (iGuide, Matterport) to a gallery"
      intro="3D tours are interactive links, so adding one takes seconds - paste the tour URL and it embeds directly in the client gallery. No API or extra account required."
      currentSlug="3d-tours"
    >
      <GuideH2>Add a tour in 4 steps</GuideH2>
      <Steps steps={STEPS} />

      <GuideH2>Which providers work?</GuideH2>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3 text-[14px] text-gray-600">
        <p>Any provider that gives you a shareable/embeddable tour link works, including <strong>iGuide</strong>, <strong>Matterport</strong>, <strong>Zillow 3D Home</strong>, CloudPano, Kuula, and similar.</p>
        <p><strong>iGuide</strong> tours work today with no setup - they&apos;re embed links, not files, so there&apos;s nothing to connect or pay for in KyoriaOS.</p>
        <p><strong>Floor plans are separate.</strong> A flat floor-plan image/PDF is added under the gallery&apos;s Floor Plans (and can be imported from <Link href="/guides/cubicasa-import" className="text-[#3486cf] underline">CubiCasa</Link>). The 3D Tour section is for the interactive walk-through link.</p>
        <p><strong>Hide it any time:</strong> each tour link has a show/hide toggle so you can control what the client sees.</p>
      </div>
    </GuideShell>
  );
}
