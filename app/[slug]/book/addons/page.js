import { getTenantBySlug, getTenantCatalog } from "@/lib/tenants";
import { notFound } from "next/navigation";
import TenantAddonsClient from "./AddonsClient";

export default async function TenantAddonsPage({ params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();
  const catalog = await getTenantCatalog(tenant.id);
  return <TenantAddonsClient slug={params.slug} addons={catalog.addons} catalog={catalog} />;
}
