import { adminAuth, adminDb } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// POST /api/dashboard/listings/[id]/social-captions
// AI-generated Instagram, Facebook, and email subject for a listing
export async function POST(req, { params }) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!anthropic) {
      return Response.json(
        { error: "AI not configured. Add ANTHROPIC_API_KEY to enable." },
        { status: 503 }
      );
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

    const response = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 700,
      messages: [{
        role: "user",
        content: `Generate real estate marketing copy for this listing:\n\n${parts}\n\nReturn ONLY valid JSON (no markdown, no extra text):\n{\n  "instagram": "Engaging caption 150-200 chars with relevant emojis, end with #JustListed #RealEstate hashtags",\n  "facebook": "2-3 sentence post that's warm and informative, good for sharing",\n  "emailSubject": "Attention-grabbing email subject under 60 characters"\n}`,
      }],
    });

    const raw = response.content[0]?.type === "text" ? response.content[0].text.trim() : "{}";
    // Strip markdown fences if model wraps it anyway
    const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();

    try {
      const captions = JSON.parse(clean);
      return Response.json({ captions });
    } catch {
      return Response.json({ error: "Could not parse AI response" }, { status: 500 });
    }
  } catch (err) {
    console.error("Social captions error:", err);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
