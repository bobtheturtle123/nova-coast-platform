import { getTenantBySlug } from "@/lib/tenants";
import { rateLimit } from "@/lib/rateLimit";
import { resolvePartnerDiscount, partnerDiscountAmount } from "@/lib/partnerDiscount";

// POST /api/[slug]/partner-discount
// Body: { email, subtotal }
// Returns the standing partner discount for this email so the booking form can
// show the savings before checkout. The booking route re-resolves this
// server-side — nothing here is trusted for the amount actually charged.
export async function POST(req, { params }) {
  // Rate limited so this can't be used to enumerate which emails are partners.
  const rl = await rateLimit(req, `partner-discount:${params.slug}`, 20, 3600);
  if (rl.limited) return Response.json({ partner: null }, { status: 429 });

  try {
    const { email, subtotal = 0 } = await req.json();
    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ partner: null }, { status: 404 });

    const discount = await resolvePartnerDiscount(tenant.id, email);
    if (!discount) return Response.json({ partner: null });

    const amount = partnerDiscountAmount(discount, subtotal);
    return Response.json({
      partner: {
        percent:    discount.percent,
        label:      discount.label,
        discount:   amount,
        finalTotal: Math.max(0, (Number(subtotal) || 0) - amount),
      },
    });
  } catch {
    return Response.json({ partner: null });
  }
}
