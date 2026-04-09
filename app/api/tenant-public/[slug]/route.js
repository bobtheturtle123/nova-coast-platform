import { getTenantBySlug } from "@/lib/tenants";

export async function GET(req, { params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });

  // Return only public fields
  return Response.json({
    tenant: {
      id:           tenant.id,
      slug:         tenant.slug,
      businessName: tenant.businessName,
      branding:     tenant.branding,
      subscriptionStatus: tenant.subscriptionStatus,
    },
  });
}
