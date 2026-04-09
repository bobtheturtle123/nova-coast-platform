import { getTenantBySlug, getTenantCatalog } from "@/lib/tenants";

export async function GET(req, { params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });

  const catalog = await getTenantCatalog(tenant.id);
  return Response.json(catalog);
}
