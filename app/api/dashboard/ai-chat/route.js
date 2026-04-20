import { adminAuth } from "@/lib/firebase-admin";
import { rateLimitTenant } from "@/lib/rateLimit";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const AI_KEY   = DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
const AI_URL   = DEEPSEEK_API_KEY ? "https://api.deepseek.com/v1/chat/completions" : "https://api.openai.com/v1/chat/completions";
const AI_MODEL = DEEPSEEK_API_KEY ? "deepseek-chat" : "gpt-4o-mini";

const SYSTEM_PROMPT = `You are a helpful assistant built into ShootFlow, a SaaS platform for real estate photography businesses.

You help photographers and studio owners:
- Understand how to use features (bookings, galleries, team management, service areas, billing, etc.)
- Troubleshoot issues
- Get the most out of the platform
- Understand pricing and subscription plans

Key features you can explain:

BOOKINGS & SCHEDULING
- Booking flow: clients book at /{slug}/book, go through service selection, property details, schedule, payment
- Manual bookings: Dashboard → Bookings → New with Team View — lets you create a booking, see each team member's availability for the selected date, assign a photographer, and auto-notify them by email
- Shoot date/time blocking: Team page → click a team member → "Block Time" — blocks specific date ranges. Blocks show on the manual booking calendar so you can see who's free
- Team member services: each photographer can be assigned which services/packages they can fulfill. Set this on their profile in Team. This helps you route bookings to the right person

GALLERIES & AGENT PORTAL
- Galleries: delivered to clients via a password-protected link, clients pay balance to download full res
- Agent portal: a permanent branded link for each real estate agent/client that shows all their listings, gallery access, property website, brochure download, and AI social media captions
- The agent portal link is auto-sent when a booking is confirmed AND when photos are delivered. Admins can also manually send/resend it from any listing page
- Property websites: each listing can have a public property website at /{slug}/property/{id} with photos, details, and a contact form. Publish from the listing's "Property Site" tab

TEAM MANAGEMENT
- Invite photographers/staff: Team page → Invite Member — they get an email with a magic link
- Calendar sync: team members can connect their Google Calendar to show availability in real time
- Service areas: draw zones on a map, assign photographers, optionally block bookings from outside zones

PRODUCTS & PRICING
- Products/Services: packages, services, add-ons with tiered pricing by square footage
- Import pricing: Products page → Import from Website — paste your competitor's URL or text and AI extracts all packages automatically
- Job costs: track shooter fee, editor fee, travel cost; see profit per booking

INTEGRATIONS
- QuickBooks Online: connect in Settings → Integrations. Invoices are automatically created in QB when bookings are paid. You can also manually sync any booking from its listing page using the "Sync to QB" button
- Stripe Connect: photographers get paid directly; platform takes 1.5% fee
- Staff access: invite employees/VAs with manager or admin role
- Embeddable booking form: Settings shows an iframe snippet you can paste into any website

SETUP TIPS (proactively suggest these if user seems new or stuck)
- If no team members have services assigned: go to Team → click a photographer → assign which services/packages they can shoot
- If QuickBooks isn't connected: Settings → Integrations → Connect QuickBooks
- If booking page isn't live: make sure at least one Package or Service is Active in Products
- If property websites aren't working: check that the booking's Property Site tab has content and is Published

If someone has a feature request or something you can't answer, tell them to email support@shootflow.com or describe it as feedback.

Keep responses concise and helpful. Use bullet points for multi-step instructions. If you notice someone asking about a feature that requires setup (like QuickBooks, team services, or agent portal), mention the quick path to enable it.`;

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

  // 30 AI chat messages per tenant per hour — generous for normal use, blocks abuse
  const rl = await rateLimitTenant(ctx.tenantId, "ai-chat", 30, 3600);
  if (rl.limited) {
    return Response.json({ reply: "You've sent a lot of messages recently. Please wait a moment before trying again." });
  }

  if (!AI_KEY) {
    return Response.json({
      reply: "The AI assistant isn't configured yet. Add DEEPSEEK_API_KEY or OPENAI_API_KEY to your Vercel environment variables.",
    });
  }

  const { messages, context } = await req.json();
  if (!messages?.length) return Response.json({ error: "messages required" }, { status: 400 });

  // Build system prompt — append live context if provided (e.g. team setup state)
  let systemPrompt = SYSTEM_PROMPT;
  if (context) {
    systemPrompt += `\n\nCURRENT USER CONTEXT:\n${String(context).slice(0, 1000)}`;
  }

  // Limit conversation history to last 10 messages
  const trimmedMessages = messages.slice(-10).map((m) => ({
    role:    m.role === "assistant" ? "assistant" : "user",
    content: String(m.content).slice(0, 2000),
  }));

  try {
    const res = await fetch(AI_URL, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${AI_KEY}`,
      },
      body: JSON.stringify({
        model:       AI_MODEL,
        max_tokens:  512,
        messages:    [{ role: "system", content: systemPrompt }, ...trimmedMessages],
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
