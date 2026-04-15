import { getTenantBySlug } from "@/lib/tenants";
import { adminDb } from "@/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/[slug]/property-chat
// AI chatbot for the public property website
export async function POST(req, { params }) {
  try {
    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });

    const { messages, bookingId, pw } = await req.json();
    if (!messages?.length) return Response.json({ error: "No messages" }, { status: 400 });

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ reply: "AI chat is not configured yet. Please contact the listing agent directly." });
    }

    // Build system prompt from property data
    const address     = pw.customName || pw.address || "this property";
    const details = [
      pw.price     && `Price: ${pw.price}`,
      pw.beds      && `Bedrooms: ${pw.beds}`,
      pw.baths     && `Bathrooms: ${pw.baths}`,
      pw.sqft      && `Square footage: ${pw.sqft} sq ft`,
      pw.type      && `Property type: ${pw.type}`,
      pw.yearBuilt && `Year built: ${pw.yearBuilt}`,
      pw.mlsNumber && `MLS #: ${pw.mlsNumber}`,
      pw.lotAcres  && `Lot size: ${pw.lotAcres} acres`,
      pw.parking   && `Parking: ${pw.parking}`,
      pw.status    && `Status: ${pw.status}`,
      pw.description && `Description: ${pw.description}`,
      pw.features?.length && `Features: ${pw.features.join(", ")}`,
      pw.agentName  && `Listing agent: ${pw.agentName}`,
      pw.agentPhone && `Agent phone: ${pw.agentPhone}`,
      pw.agentEmail && `Agent email: ${pw.agentEmail}`,
      pw.agentBrokerage && `Brokerage: ${pw.agentBrokerage}`,
    ].filter(Boolean).join("\n");

    const systemPrompt = `You are a helpful property assistant for a real estate listing at ${address}.
Answer questions about the property based on the details below. Be friendly, concise, and informative.
If asked something you don't know, politely say so and direct them to contact the listing agent.
Do NOT make up information not listed. Keep responses to 2-3 sentences max.

PROPERTY DETAILS:
${details || "Details not provided."}

Photographer / Media: ${tenant.businessName || "Professional photography services"}`;

    // Convert messages to Anthropic format (skip system messages)
    const anthropicMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:     systemPrompt,
      messages:   anthropicMessages,
    });

    const reply = response.content[0]?.text || "I'm not sure about that. Please contact the listing agent directly.";
    return Response.json({ reply });
  } catch (err) {
    console.error("Property chat error:", err);
    return Response.json({ reply: "I'm having trouble responding right now. Please contact the listing agent directly." });
  }
}
