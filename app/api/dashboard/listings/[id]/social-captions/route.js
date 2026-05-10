import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { rateLimitTenant } from "@/lib/rateLimit";
import { callAI, aiAvailable } from "@/lib/ai";

// POST /api/dashboard/listings/[id]/social-captions
export async function POST(req, { params }) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!aiAvailable()) {
      return Response.json(
        { error: "AI not configured. Add DEEPSEEK_API_KEY or OPENAI_API_KEY to enable." },
        { status: 503 }
      );
    }

    // 10 caption generations per tenant per hour
    const rl = await rateLimitTenant(decoded.tenantId, "social-captions", 10, 3600);
    if (rl.limited) {
      return Response.json({ error: "Caption generation limit reached. Try again in an hour." }, { status: 429 });
    }

    const bookingDoc = await adminDb
      .collection("tenants").doc(decoded.tenantId)
      .collection("bookings").doc(params.id)
      .get();
    if (!bookingDoc.exists) return Response.json({ error: "Not found" }, { status: 404 });

    const booking = bookingDoc.data();
    const pw = booking.propertyWebsite || {};
    const address = pw.customName || pw.address || booking.fullAddress || booking.address || "this property";

    const parts = [
      `Address: ${address}`,
      pw.status        && `Status: ${pw.status}`,
      pw.price         && `Price: ${pw.price}`,
      pw.beds          && `Bedrooms: ${pw.beds}`,
      pw.baths         && `Bathrooms: ${pw.baths}`,
      pw.sqft          && `Square Feet: ${pw.sqft}`,
      pw.type          && `Property Type: ${pw.type}`,
      pw.description   && `Description: ${pw.description.slice(0, 400)}`,
      pw.features?.length && `Key Features: ${pw.features.slice(0, 6).join(", ")}`,
      pw.agentName     && `Listing Agent: ${pw.agentName}`,
      pw.agentBrokerage && `Brokerage: ${pw.agentBrokerage}`,
    ].filter(Boolean).join("\n");

    const raw = await callAI(
      [{
        role:    "user",
        content: `Generate real estate marketing copy for this listing:\n\n${parts}\n\nReturn ONLY valid JSON (no markdown, no extra text):\n{\n  "instagram": "Engaging caption 150-200 chars with relevant emojis, end with #JustListed #RealEstate hashtags",\n  "facebook": "2-3 sentence post that's warm and informative, good for sharing",\n  "emailSubject": "Attention-grabbing email subject under 60 characters"\n}`,
      }],
      { max_tokens: 700, temperature: 0.8 },
      "social-captions"
    );

    const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const captions = JSON.parse(clean);
    return Response.json({ captions });
  } catch (err) {
    console.error("[social-captions] Error:", err.message);
    return Response.json({ error: "AI request failed" }, { status: 500 });
  }
}
