import { getTenantBySlug } from "@/lib/tenants";
import { getTravelFee } from "@/lib/travelFee";

export async function POST(req, { params }) {
  try {
    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ travelFee: 0, miles: 0, withinRange: true });

    const { address } = await req.json();
    const fromZip = tenant.fromZip || process.env.NEXT_PUBLIC_FROM_ZIP || "90210";

    const config = tenant.travelFeeConfig || {};
    const result = await getTravelFee(fromZip, address, config);

    return Response.json({ travelFee: result.fee, miles: result.miles, withinRange: result.withinRange });
  } catch (err) {
    console.error("Travel fee error:", err);
    return Response.json({ travelFee: 0, miles: 0, withinRange: true });
  }
}
