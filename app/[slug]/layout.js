import { getTenantBySlug } from "@/lib/tenants";
import { notFound } from "next/navigation";
import PoweredByKyoria from "@/components/PoweredByKyoria";

export async function generateMetadata({ params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return { title: "Not Found" };
  return {
    title: tenant.branding?.businessName || tenant.businessName,
    description: tenant.branding?.tagline || "Book your real estate photography shoot",
  };
}

export default async function TenantLayout({ children, params }) {
  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) notFound();

  const primary = tenant.branding?.primaryColor || "#3486cf";
  const accent  = tenant.branding?.accentColor  || "#c9a96e";
  // Hide attribution once the studio is live on their own verified custom domain.
  const onOwnDomain = !!tenant.customDomain?.verified;

  return (
    <div
      style={{
        "--color-primary": primary,
        "--color-accent":  accent,
      }}
    >
      {children}
      {!onOwnDomain && <PoweredByKyoria />}
    </div>
  );
}
