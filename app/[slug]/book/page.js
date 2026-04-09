import { getTenantBySlug, getTenantCatalog } from "@/lib/tenants";
import { notFound } from "next/navigation";
import TenantBookStep1Client from "./Step1Client";

export default async function TenantBookStep1({ params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  const catalog = await getTenantCatalog(tenant.id);

  return (
    <TenantBookStep1Client
      slug={params.slug}
      tenantId={tenant.id}
      tenantName={tenant.businessName}
      catalog={catalog}
    />
  );
}
