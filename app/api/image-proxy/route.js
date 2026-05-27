export const dynamic = "force-dynamic";

// Proxy R2 images through the Next.js server so the browser can draw them
// to a canvas without hitting cross-origin restrictions.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) return new Response("Missing url", { status: 400 });

  // Only proxy URLs from our R2 bucket
  const r2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!r2Base || !url.startsWith(r2Base)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const upstream = await fetch(url, { next: { revalidate: 3600 } });
    if (!upstream.ok) return new Response("Not found", { status: 404 });

    const contentType = upstream.headers.get("Content-Type") || "image/jpeg";
    const data = await upstream.arrayBuffer();

    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600, immutable",
      },
    });
  } catch (err) {
    console.error("[image-proxy] fetch error:", err?.message);
    return new Response("Failed to fetch image", { status: 502 });
  }
}
