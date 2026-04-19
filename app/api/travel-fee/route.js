import { getTravelFee } from "@/lib/travelFee";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req) {
  try {
    const rl = await rateLimit(req, "travel-fee-global", 30, 3600);
    if (rl.limited) return Response.json({ fee: 0 });

    const { address } = await req.json();

    if (!address) {
      return Response.json({ error: "Address required" }, { status: 400 });
    }

    const fromZip = process.env.NEXT_PUBLIC_FROM_ZIP || "92108";
    const fee = await getTravelFee(fromZip, address);
    return Response.json({ fee });
  } catch (err) {
    console.error("Travel fee error:", err);
    return Response.json({ fee: 0 });
  }
}
