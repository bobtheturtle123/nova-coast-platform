import { getTenantBySlug } from "@/lib/tenants";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function TenantPrivacyPage({ params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  const privacy = tenant.bookingConfig?.privacy || "";

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href={`/${params.slug}/book`}
            className="font-display text-[#3486cf] text-lg tracking-wide hover:opacity-70 transition-opacity">
            {tenant.branding?.businessName || tenant.businessName}
          </Link>
          <Link href={`/${params.slug}/book`}
            className="text-sm text-gray-500 hover:text-[#3486cf] underline underline-offset-2">
            ← Back to booking
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-[#3486cf] mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-8">
          {tenant.branding?.businessName || tenant.businessName}
        </p>

        {privacy ? (
          <div className="bg-white border border-gray-200 rounded-sm p-8">
            <pre className="whitespace-pre-wrap font-body text-sm text-gray-700 leading-relaxed">
              {privacy}
            </pre>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-sm p-8 text-center text-gray-400">
            <p className="text-sm">No privacy policy has been published yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
