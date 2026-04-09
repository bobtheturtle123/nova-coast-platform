import sharp from "sharp";

export const dynamic = "force-dynamic";

// Web/MLS spec: max 2048px wide, JPEG quality 85
const WEB_MAX_PX = 2048;
const WEB_QUALITY = 85;

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const key    = searchParams.get("key");
  const format = searchParams.get("format") || "web"; // "web" | "print"
  const name   = searchParams.get("name") || "image";

  if (!key) {
    return new Response("Missing key", { status: 400 });
  }

  const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!r2PublicUrl) {
    return new Response("R2 not configured", { status: 500 });
  }

  const sourceUrl = `${r2PublicUrl}/${key}`;

  // Print quality — redirect directly to R2 public URL
  if (format === "print") {
    return Response.redirect(sourceUrl, 302);
  }

  // Web/MLS quality — fetch full-res, resize with Sharp, stream back
  try {
    const r2Res = await fetch(sourceUrl);
    if (!r2Res.ok) {
      return new Response("Source image not found", { status: 404 });
    }

    const arrayBuffer = await r2Res.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    const webBuffer = await sharp(inputBuffer)
      .resize({ width: WEB_MAX_PX, withoutEnlargement: true })
      .jpeg({ quality: WEB_QUALITY, progressive: true })
      .toBuffer();

    const baseName = name.replace(/\.[^.]+$/, "");
    const fileName = `${baseName}-MLS.jpg`;

    return new Response(webBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "image/jpeg",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length":      String(webBuffer.length),
        "Cache-Control":       "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Image download/resize error:", err);
    return new Response("Failed to process image", { status: 500 });
  }
}
