import { adminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

const meta = (html, prop) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i");
  return (html.match(re) || html.match(re2) || [])[1] || null;
};

const decode = (s) => (s || "")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ").trim();

// POST { source: url } — best-effort auto-fill from a public listing URL.
// Reads OpenGraph + JSON-LD. Many MLS/portal pages block bots; when that
// happens we say so honestly rather than failing silently.
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { source } = await req.json().catch(() => ({}));
  const url = (source || "").trim();
  if (!url) return Response.json({ error: "source required" }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) {
    return Response.json({ ok: true, fields: {}, message: "Enter a full listing URL (https://…)." });
  }

  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KyoriaOS/1.0; +https://kyoriaos.com)", Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) {
      return Response.json({ ok: true, fields: {}, message: `That site returned ${res.status}. It may block automatic import — enter details manually.` });
    }
    html = await res.text();
  } catch {
    return Response.json({ ok: true, fields: {}, message: "Couldn't reach that URL. Enter details manually." });
  }

  const fields = {};
  const ogDesc = decode(meta(html, "og:description") || meta(html, "twitter:description") || meta(html, "description"));
  const ogTitle = decode(meta(html, "og:title") || meta(html, "twitter:title"));

  let beds, baths, price, sqft, jsonDesc, yearBuilt, lotSqft, lotAcres, parking;

  // Deep-walk every JSON-LD block for real-estate fields, wherever they're nested.
  const num = (v) => {
    if (v == null) return undefined;
    if (typeof v === "object") v = v.value ?? v.price ?? v["@value"];
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  };
  function walk(n, depth = 0) {
    if (!n || typeof n !== "object" || depth > 6) return;
    if (Array.isArray(n)) { n.forEach((x) => walk(x, depth + 1)); return; }
    for (const [k, v] of Object.entries(n)) {
      const key = k.toLowerCase();
      if (beds  === undefined && /(numberofbedrooms|bedrooms|beds)/.test(key))            beds  = num(v);
      if (baths === undefined && /(numberofbathrooms|bathroomstotal|bathrooms|baths)/.test(key)) baths = num(v);
      if (price === undefined && /(^price$|listprice|offers)/.test(key))                  price = num(v?.price ?? v);
      if (sqft  === undefined && /(floorsize|livingarea|sqft|squarefeet)/.test(key) && !/lot/.test(key)) sqft = num(v);
      if (yearBuilt === undefined && /(yearbuilt|yearconstructed)/.test(key))             yearBuilt = num(v);
      if (lotSqft === undefined && /lotsize/.test(key))                                   lotSqft = num(v);
      if (parking === undefined && /(parking|garage)/.test(key))                          parking = num(v);
      if (!jsonDesc && key === "description" && typeof v === "string" && v.length > 30)    jsonDesc = decode(v);
      if (v && typeof v === "object") walk(v, depth + 1);
    }
  }
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim())); } catch { /* skip bad block */ }
  }

  // Regex fallbacks — Redfin/Zillow put "3 beds, 2 baths, 1,500 sq ft" in the
  // og:title/description, and stats like year built / acres / garage in the body.
  const hay  = `${ogTitle} ${ogDesc}`;
  const body = html.replace(/<[^>]+>/g, " ").slice(0, 200000); // strip tags for text search
  if (beds  === undefined) beds  = num((hay.match(/([\d.]+)\s*(?:beds?|bd|bedrooms?)/i) || [])[1]);
  if (baths === undefined) baths = num((hay.match(/([\d.]+)\s*(?:baths?|ba|bathrooms?)/i) || [])[1]);
  if (sqft  === undefined) sqft  = num((hay.match(/([\d,]+)\s*(?:sq\.?\s*ft|square\s*feet|sqft)/i) || [])[1]);
  if (price === undefined) price = num((hay.match(/\$\s?([\d,]+)/) || [])[1]);
  if (yearBuilt === undefined) yearBuilt = num((body.match(/(?:built in|year built[:\s]+|yr built[:\s]+)\s*(\d{4})/i) || [])[1]);
  if (lotAcres === undefined)  lotAcres  = num((body.match(/([\d.]+)\s*acres?\b/i) || [])[1]);
  if (lotAcres === undefined && lotSqft) lotAcres = Math.round((lotSqft / 43560) * 100) / 100;
  if (lotSqft  && !lotAcres && lotSqft > 5) lotAcres = Math.round((lotSqft / 43560) * 100) / 100;
  if (parking === undefined) parking = num((body.match(/(\d+)\s*(?:-|\s)?car\s*garage/i) || body.match(/(\d+)\s*(?:garage|parking)\s*spaces?/i) || [])[1]);

  // Prefer a real marketing description over the short meta string.
  const description = (jsonDesc && jsonDesc.length > (ogDesc?.length || 0)) ? jsonDesc : ogDesc;
  if (description) fields.description = description.slice(0, 1200);
  if (beds  != null) fields.beds  = String(beds);
  if (baths != null) fields.baths = String(baths);
  if (price != null) fields.price = String(price);
  if (sqft  != null) fields.sqft = Math.round(sqft).toLocaleString();
  if (yearBuilt != null && yearBuilt > 1700 && yearBuilt < 2100) fields.yearBuilt = String(Math.round(yearBuilt));
  if (lotAcres != null && lotAcres > 0) fields.lotAcres = String(lotAcres);
  if (parking != null && parking > 0) fields.parking = String(Math.round(parking));

  if (Object.keys(fields).length === 0) {
    return Response.json({ ok: true, fields: {}, message: "Couldn't read details from that page (some sites block automatic import). Enter details manually." });
  }
  return Response.json({ ok: true, fields, message: "Imported what we could — review and save." });
}
