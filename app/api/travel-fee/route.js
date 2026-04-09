import { getTravelFee } from "@/lib/travelFee";

export async function POST(req) {
  try {
    const { address } = await req.json();

    if (!address) {
      return Response.json({ error: "Address required" }, { status: 400 });
    }

    const fee = await getTravelFee(address);
    return Response.json({ fee });
  } catch (err) {
    console.error("Travel fee error:", err);
    return Response.json({ fee: 0 });
  }
}
