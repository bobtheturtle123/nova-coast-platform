import { getTenantBySlug } from "@/lib/tenants";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function TenantTermsPage({ params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  const terms = tenant.bookingConfig?.terms || "";

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href={`/${params.slug}/book`}
            className="font-display text-navy text-lg tracking-wide hover:opacity-70 transition-opacity">
            {tenant.branding?.businessName || tenant.businessName}
          </Link>
          <Link href={`/${params.slug}/book`}
            className="text-sm text-gray-500 hover:text-navy underline underline-offset-2">
            ← Back to booking
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl text-navy mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-8">
          {tenant.branding?.businessName || tenant.businessName}
        </p>

        {terms ? (
          <div className="bg-white border border-gray-200 rounded-sm p-8">
            <pre className="whitespace-pre-wrap font-body text-sm text-gray-700 leading-relaxed">
              {terms}
            </pre>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-sm p-8 text-center text-gray-400">
            <p className="text-sm">No terms of service have been published yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
