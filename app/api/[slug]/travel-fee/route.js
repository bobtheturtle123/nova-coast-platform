import { getTenantBySlug } from "@/lib/tenants";
import { getTravelFee } from "@/lib/travelFee";

export async function POST(req, { params }) {
  try {
    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ travelFee: 0 });

    const { address } = await req.json();
    const fromZip = tenant.fromZip || process.env.NEXT_PUBLIC_FROM_ZIP || "90210";

    const travelFee = await getTravelFee(fromZip, address);
    return Response.json({ travelFee });
  } catch (err) {
    console.error("Travel fee error:", err);
    return Response.json({ travelFee: 0 });
  }
}
