import { getTenantBySlug } from "@/lib/tenants";
import { notFound } from "next/navigation";
import TenantBookHeader from "@/components/booking/TenantBookHeader";

// Per-tenant booking pages are near-duplicate templates that Google flags as
// "Duplicate without user-selected canonical." Keep them out of the index but
// let Googlebot follow their links. They are NOT blocked in robots.txt (so the
// crawler can read this tag) and are NOT listed in the sitemap.
export const metadata = {
  robots: { index: false, follow: true },
};

export default async function TenantBookLayout({ children, params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  return (
    <div className="min-h-screen bg-cream">
      <TenantBookHeader tenant={tenant} />
      {children}
    </div>
  );
}
