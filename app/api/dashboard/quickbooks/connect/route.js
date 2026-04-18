import { adminAuth } from "@/lib/firebase-admin";
import { getAuthUrl, isConfigured } from "@/lib/quickbooks";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// GET /api/dashboard/quickbooks/connect — returns the OAuth URL
export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!isConfigured()) {
    return Response.json({
      error: "QuickBooks is not configured. Add QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET to your Vercel environment variables. Get credentials at developer.intuit.com → Create an App → Production keys.",
      setupRequired: true,
    }, { status: 503 });
  }

  const url = getAuthUrl(ctx.tenantId);
  return Response.json({ url });
}
