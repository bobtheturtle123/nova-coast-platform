import { getTenantBySlug } from "@/lib/tenants";
import { getTravelFee } from "@/lib/travelFee";
import { getZoneTravelFee } from "@/lib/zoneFee";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req, { params }) {
  try {
    // 30 travel-fee lookups per IP per hour — enough for a booking session
    const rl = await rateLimit(req, `travel-fee:${params.slug}`, 30, 3600);
    if (rl.limited) return Response.json({ travelFee: 0, miles: 0, withinRange: true });

    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ travelFee: 0, miles: 0, withinRange: true });

    const { address, lat, lng } = await req.json();
    const fromZip = tenant.fromZip || process.env.NEXT_PUBLIC_FROM_ZIP || "90210";

    const config = tenant.travelFeeConfig || {};

    // Zone-based pricing: charge the matched service-area zone's travel fee
    // (per-photographer; lowest assigned fee when no photographer is chosen yet).
    if (config.enabled !== false && config.mode === "zones") {
      const zone = await getZoneTravelFee({ tenantId: tenant.id, lat, lng, address });
      return Response.json({ travelFee: zone.fee, miles: 0, withinRange: true, zoneName: zone.zoneName });
    }

    const result = await getTravelFee(fromZip, address, config);

    return Response.json({ travelFee: result.fee, miles: result.miles, withinRange: result.withinRange });
  } catch (err) {
    console.error("Travel fee error:", err);
    return Response.json({ travelFee: 0, miles: 0, withinRange: true });
  }
}
