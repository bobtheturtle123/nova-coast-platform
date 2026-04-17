import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { mergeSmsPrefs } from "@/lib/sms";

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

  const doc  = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const data = doc.data();
  return Response.json({ prefs: mergeSmsPrefs(data?.smsNotifications) });
}

export async function PUT(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body  = await req.json().catch(() => ({}));
  const prefs = mergeSmsPrefs(body);

  await adminDb.collection("tenants").doc(ctx.tenantId).update({ smsNotifications: prefs });
  return Response.json({ ok: true, prefs });
}
