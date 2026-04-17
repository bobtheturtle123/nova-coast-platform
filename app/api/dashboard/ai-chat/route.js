import { adminAuth } from "@/lib/firebase-admin";

// Uses Groq's free API tier (llama-3.1-8b-instant) — no per-token cost.
// Sign up free at console.groq.com and set GROQ_API_KEY in your env vars.
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL   = "llama-3.1-8b-instant"; // fast, free

const SYSTEM_PROMPT = `You are a helpful assistant built into ShootFlow, a SaaS platform for real estate photography businesses.

You help photographers and studio owners:
- Understand how to use features (bookings, galleries, team management, service areas, billing, etc.)
- Troubleshoot issues
- Get the most out of the platform
- Understand pricing and subscription plans

Key features you can explain:
- Booking flow: clients book at /{slug}/book, go through service selection, property details, schedule, payment
- Galleries: delivered to clients via a password-protected link, clients pay balance to download full res
- Team management: invite photographers, set up calendar sync, define service areas, block time off
- Service areas: draw zones on a map, assign photographers, optionally block bookings from outside zones
- Products/Services: packages, services, add-ons with tiered pricing by square footage
- Job costs: track shooter fee, editor fee, travel cost; see profit per booking
- Reports: revenue, P&L, upsell intelligence, client retention
- Stripe Connect: photographers get paid directly; platform takes 1.5% fee
- Staff access: invite employees/VAs with manager or admin role

If someone has a feature request or something you can't answer, tell them to email support@shootflow.com or describe it as feedback.

Keep responses concise and helpful. Use bullet points for multi-step instructions.`;

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!GROQ_API_KEY) {
    return Response.json({
      reply: "The AI assistant isn't configured yet. Add GROQ_API_KEY to your environment variables to enable it (free at console.groq.com). In the meantime, reach support at support@shootflow.com.",
    });
  }

  const { messages } = await req.json();
  if (!messages?.length) return Response.json({ error: "messages required" }, { status: 400 });

  // Limit conversation history to last 10 messages
  const trimmedMessages = messages.slice(-10).map((m) => ({
    role:    m.role === "assistant" ? "assistant" : "user",
    content: String(m.content).slice(0, 2000),
  }));

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model:       GROQ_MODEL,
        max_tokens:  512,
        messages:    [{ role: "system", content: SYSTEM_PROMPT }, ...trimmedMessages],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[ai-chat] Groq error:", err);
      return Response.json({ reply: "Something went wrong. Please try again or contact support@shootflow.com." });
    }

    const data  = await res.json();
    const reply = data.choices?.[0]?.message?.content || "I couldn't generate a response. Please try again.";
    return Response.json({ reply });
  } catch (err) {
    console.error("[ai-chat] Error:", err);
    return Response.json({
      reply: "Something went wrong. Please try again or contact support@shootflow.com.",
    });
  }
}
