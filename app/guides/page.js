import Link from "next/link";
import { ALL_GUIDES } from "@/components/GuideShell";

export const metadata = {
  title: "Guides — Learn KyoriaOS | Real Estate Photography Software",
  description:
    "Step-by-step guides for running your real estate photography business on KyoriaOS: bookings, listings, services, team scheduling, and app integrations.",
  alternates: { canonical: "https://kyoriaos.com/guides" },
};

export default function GuidesIndexPage() {
  return (
    <main style={{ background: "#F7F8FA", minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-[#3486cf] hover:underline">← Back to KyoriaOS</Link>

        <div className="mt-6 mb-10">
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#3486cf]">Help &amp; Guides</span>
          <h1 className="font-display text-4xl text-[#0F172A] mt-2 leading-tight">Learn KyoriaOS</h1>
          <p className="text-gray-500 mt-3 text-lg leading-relaxed">
            Everything you need to run your real estate photography business — explained simply.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {ALL_GUIDES.map((g) => (
            <Link key={g.slug} href={`/guides/${g.slug}`}
              className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-[#3486cf]/40 transition-colors block">
              <div className="text-3xl mb-3">{g.icon}</div>
              <p className="font-semibold text-[#0F172A]">{g.title}</p>
              <p className="text-[13px] text-gray-500 mt-1 leading-snug">{g.blurb}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
