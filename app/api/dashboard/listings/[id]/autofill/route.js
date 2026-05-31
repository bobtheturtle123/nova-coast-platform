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

// POST { source: string } — stub for MLS/Redfin auto-fill
// Returns stubbed response; real scraping logic to be added per data-source agreement.
export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { source } = await req.json().catch(() => ({}));
  if (!source?.trim()) return Response.json({ error: "source required" }, { status: 400 });

  // TODO: implement real MLS/Redfin scraping when data-source is confirmed
  return Response.json({
    ok: true,
    source: source.trim(),
    fields: {},
    message: "Auto-fill from external sources coming soon. Enter details manually for now.",
  });
}
