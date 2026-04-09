import { getTenantBySlug } from "@/lib/tenants";
import { notFound } from "next/navigation";
import TenantBookHeader from "@/components/booking/TenantBookHeader";

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
