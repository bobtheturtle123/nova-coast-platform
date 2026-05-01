import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripTags } from "@/lib/rateLimit";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (decoded.role !== "photographer" || !decoded.tenantId || !decoded.memberId) return null;
    return { uid: decoded.uid, tenantId: decoded.tenantId, memberId: decoded.memberId };
  } catch { return null; }
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [memberDoc, tenantDoc] = await Promise.all([
    adminDb.collection("tenants").doc(ctx.tenantId).collection("team").doc(ctx.memberId).get(),
    adminDb.collection("tenants").doc(ctx.tenantId).get(),
  ]);

  if (!memberDoc.exists) return Response.json({ error: "Member not found" }, { status: 404 });

  const raw = memberDoc.data();
  // Strip sensitive fields before sending to photographer
  const member = {
    id:        raw.id,
    name:      raw.name,
    email:     raw.email,
    phone:     raw.phone,
    skills:    raw.skills || [],
    color:     raw.color,
    payRate:   raw.payRate ?? null,
    calendarToken: raw.calendarToken,
    googleCalendar: raw.googleCalendar ? { connected: !!raw.googleCalendar.refreshToken } : null,
  };

  const tenantData = tenantDoc.exists ? tenantDoc.data() : {};
  const branding = {
    businessName: tenantData.businessName || "",
    logoUrl:      tenantData.branding?.logoUrl || null,
    primaryColor: tenantData.branding?.primaryColor || "#3486cf",
  };

  return Response.json({ member, branding });
}

// PATCH — photographer updates their own phone/name
export async function PATCH(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = {};
  if (body.name  !== undefined) allowed.name  = stripTags(String(body.name)).slice(0, 80);
  if (body.phone !== undefined) allowed.phone = String(body.phone).replace(/[^0-9+\-().x ]/g, "").slice(0, 30);

  await adminDb.collection("tenants").doc(ctx.tenantId).collection("team").doc(ctx.memberId).update(allowed);
  return Response.json({ ok: true });
}
