import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { rateLimitTenant } from "@/lib/rateLimit";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const AI_KEY           = DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
const AI_URL           = DEEPSEEK_API_KEY
  ? "https://api.deepseek.com/v1/chat/completions"
  : "https://api.openai.com/v1/chat/completions";
const AI_MODEL         = DEEPSEEK_API_KEY ? "deepseek-chat" : "gpt-4o-mini";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// POST /api/dashboard/products/import
// Parses pricing text (or fetches URL) using AI and creates draft products
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!AI_KEY) {
    return Response.json({ error: "AI not configured. Set DEEPSEEK_API_KEY or OPENAI_API_KEY to enable pricing import." }, { status: 503 });
  }

  // 5 AI import runs per tenant per hour — this endpoint fetches external URLs + calls AI
  const rl = await rateLimitTenant(ctx.tenantId, "products-import", 5, 3600);
  if (rl.limited) {
    return Response.json({ error: "Import limit reached. Please wait before running another import." }, { status: 429 });
  }

  const { mode, content, targetType = "services" } = await req.json();
  if (!content) return Response.json({ error: "content required" }, { status: 400 });

  let text = content;

  function stripHtml(html) {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
      .replace(/<\/(?:p|div|li|h[1-6]|section|article|tr|td|th|br)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#\d+;/g, " ")
      .replace(/[ \t]{3,}/g, "  ")
      .replace(/\n{4,}/g, "\n\n")
      .trim();
  }

  // If URL mode, fetch the page content
  if (mode === "url") {
    try {
      const fetchRes = await fetch(content, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });
      if (!fetchRes.ok) {
        return Response.json({ error: `Could not fetch URL (HTTP ${fetchRes.status}). Try pasting the pricing text instead.` }, { status: 400 });
      }
      const html = await fetchRes.text();
      text = stripHtml(html).slice(0, 8000);
      if (text.trim().length < 50) {
        return Response.json({ error: "Page content too short to parse. Try pasting the pricing text instead." }, { status: 400 });
      }
    } catch (err) {
      return Response.json({ error: "Could not fetch URL. Try pasting the pricing text instead." }, { status: 400 });
    }
  }

  // If text mode contains HTML (user pasted HTML source), strip tags
  if (mode !== "url" && (text.includes("</") || text.trimStart().startsWith("<"))) {
    text = stripHtml(text);
  }

  const prompt = `You are parsing real estate photography pricing from a website or document.
Extract ALL packages, services, and add-ons you can find. Be generous — include everything.

TEXT TO PARSE:
${text.slice(0, 5000)}

Return ONLY valid JSON array (no markdown). Each item:
{
  "name": "Service name",
  "type": "packages|services|addons",
  "price": 299,
  "description": "Brief description or empty string",
  "deliverables": ["25 edited photos", "24hr delivery"]
}

Rules:
- type must be "packages" for bundles, "services" for individual services, "addons" for extras
- price is a number (no $ sign)
- deliverables is array of strings describing what's included
- If unsure of type, use "services"
- Return at least 1 item if you find any pricing at all`;

  try {
    const aiRes = await fetch(AI_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${AI_KEY}` },
      body: JSON.stringify({
        model:       AI_MODEL,
        max_tokens:  1500,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const aiData = await aiRes.json();
    const raw    = aiData.choices?.[0]?.message?.content?.trim() || "[]";
    const clean  = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(clean);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return Response.json({ error: "No pricing items found. Try pasting the text directly." }, { status: 422 });
    }

    // Save as active:false (draft) products
    const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);
    const batch     = adminDb.batch();
    const created   = { packages: [], services: [], addons: [] };

    for (const item of parsed.slice(0, 20)) {
      const type = ["packages", "services", "addons"].includes(item.type) ? item.type : "services";
      const ref  = tenantRef.collection(type).doc();
      const doc  = {
        id:           ref.id,
        type,
        name:         String(item.name || "Unnamed Service").slice(0, 100),
        description:  String(item.description || "").slice(0, 500),
        price:        Number(item.price) || 0,
        deliverables: Array.isArray(item.deliverables) ? item.deliverables.map(String).slice(0, 10) : [],
        active:       false, // draft — admin reviews before publishing
        importedAt:   new Date(),
        createdAt:    new Date(),
      };
      batch.set(ref, doc);
      created[type].push(doc);
    }

    await batch.commit();
    const total = Object.values(created).flat().length;
    return Response.json({ imported: total, items: created });
  } catch (err) {
    console.error("[products/import] Error:", err);
    return Response.json({ error: "Failed to parse pricing. Try pasting the text manually." }, { status: 500 });
  }
}
