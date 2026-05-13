import { adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  if (!url) return Response.json({ error: "url is required" }, { status: 400 });

  // Only allow cubicasa.com origin to prevent SSRF
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("cubicasa.com") && !parsed.hostname.endsWith("cubicasa.net")) {
      return Response.json({ error: "Only CubiCasa URLs are allowed" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return Response.json({ error: `Upstream returned ${res.status}` }, { status: res.status });
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
