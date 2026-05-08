import sharp from "sharp";
import { rateLimit } from "@/lib/rateLimit";

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

  // 100 individual image downloads per IP per hour — allows normal browsing and MLS exports
  // but blocks automated bulk scraping. Print format redirects to R2 directly so allow more.
  const dlLimit = format === "print" ? 200 : 100;
  const rl = await rateLimit(req, "img-dl", dlLimit, 3600);
  if (rl.limited) return new Response("Too many download requests. Please try again later.", { status: 429 });

  const r2PublicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
  if (!r2PublicUrl) {
    return new Response("R2 not configured", { status: 500 });
  }

  const sourceUrl = `${r2PublicUrl}/${key}`;

  try {
    const r2Res = await fetch(sourceUrl);
    if (!r2Res.ok) {
      return new Response("Source file not found", { status: 404 });
    }

    const arrayBuffer = await r2Res.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Raw pass-through for PDFs and non-image files (floor plans, attachments)
    if (format === "raw") {
      const contentType = r2Res.headers.get("Content-Type") || "application/octet-stream";
      return new Response(inputBuffer, {
        status: 200,
        headers: {
          "Content-Type":        contentType,
          "Content-Disposition": `attachment; filename="${name}"`,
          "Content-Length":      String(inputBuffer.length),
          "Cache-Control":       "private, max-age=3600",
        },
      });
    }

    if (format === "print") {
      // Stream original bytes with attachment header so browser downloads instead of opening
      const baseName = name.replace(/\.[^.]+$/, "");
      const ext = (key.match(/\.([^.]+)$/) || [])[1] || "jpg";
      const fileName = `${baseName}.${ext}`;
      return new Response(inputBuffer, {
        status: 200,
        headers: {
          "Content-Type":        r2Res.headers.get("Content-Type") || "image/jpeg",
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Content-Length":      String(inputBuffer.length),
          "Cache-Control":       "private, max-age=3600",
        },
      });
    }

    // Web/MLS quality — resize with Sharp
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
