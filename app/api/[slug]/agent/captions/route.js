import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const AI_KEY   = DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
const AI_URL   = DEEPSEEK_API_KEY ? "https://api.deepseek.com/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
const AI_MODEL = DEEPSEEK_API_KEY ? "deepseek-chat" : "gpt-4o-mini";

export async function GET(req, { params }) {
  const { searchParams } = new URL(req.url);
  const token     = searchParams.get("token");
  const bookingId = searchParams.get("bookingId");

  if (!token || !bookingId) {
    return Response.json({ error: "token and bookingId required" }, { status: 400 });
  }

  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });

  // Verify agent token
  const agentsSnap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("agents")
    .where("accessToken", "==", token)
    .limit(1)
    .get();
  if (agentsSnap.empty) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const agent = agentsSnap.docs[0].data();

  // Fetch booking
  const bookingDoc = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("bookings").doc(bookingId)
    .get();
  if (!bookingDoc.exists) return Response.json({ error: "Not found" }, { status: 404 });

  const booking = bookingDoc.data();
  if (booking.clientEmail?.toLowerCase() !== agent.email?.toLowerCase()) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!AI_KEY) {
    return Response.json({ error: "AI not configured" }, { status: 503 });
  }

  const pw      = booking.propertyWebsite || {};
  const address = pw.customName || pw.address || booking.fullAddress || booking.address || "this property";
  const parts   = [
    `Address: ${address}`,
    pw.status       && `Status: ${pw.status}`,
    pw.price        && `Price: ${pw.price}`,
    pw.beds         && `Bedrooms: ${pw.beds}`,
    pw.baths        && `Bathrooms: ${pw.baths}`,
    pw.sqft         && `Square Feet: ${pw.sqft}`,
    pw.type         && `Property Type: ${pw.type}`,
    pw.description  && `Description: ${pw.description.slice(0, 400)}`,
    pw.features?.length && `Key Features: ${pw.features.slice(0, 6).join(", ")}`,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch(AI_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AI_KEY}` },
      body: JSON.stringify({
        model:       AI_MODEL,
        max_tokens:  700,
        temperature: 0.8,
        messages: [{
          role:    "user",
          content: `Generate real estate marketing copy for this listing:\n\n${parts}\n\nReturn ONLY valid JSON (no markdown):\n{"instagram":"150-200 char caption with emojis and #JustListed #RealEstate","facebook":"2-3 sentence warm post","emailSubject":"Email subject under 60 chars"}`,
        }],
      }),
    });

    const data  = await res.json();
    const raw   = data.choices?.[0]?.message?.content?.trim() || "{}";
    const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const captions = JSON.parse(clean);
    return Response.json({ captions });
  } catch {
    return Response.json({ error: "AI request failed" }, { status: 500 });
  }
}
