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
  const description = decode(meta(html, "og:description") || meta(html, "description"));
  if (description) fields.description = description.slice(0, 1200);

  // JSON-LD often carries structured real-estate data.
  let beds, baths, price, sqft;
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const json = JSON.parse(m[1].trim());
      const nodes = Array.isArray(json) ? json : [json, ...(json["@graph"] || [])];
      for (const n of nodes) {
        if (!n || typeof n !== "object") continue;
        beds  = beds  ?? n.numberOfBedrooms ?? n.numberOfRooms;
        baths = baths ?? n.numberOfBathroomsTotal ?? n.numberOfBathrooms;
        price = price ?? n.offers?.price ?? n.price;
        const fs = n.floorSize?.value ?? n.floorSize;
        sqft = sqft ?? (typeof fs === "number" || /^\d/.test(String(fs || "")) ? fs : undefined);
      }
    } catch { /* skip bad block */ }
  }
  if (beds  != null && fields.beds  === undefined) fields.beds  = String(beds);
  if (baths != null && fields.baths === undefined) fields.baths = String(baths);
  if (price != null) fields.price = String(price);

  if (Object.keys(fields).length === 0) {
    return Response.json({ ok: true, fields: {}, message: "No structured details found on that page. Enter details manually." });
  }
  return Response.json({ ok: true, fields, message: "Imported what we could — review and save." });
}
