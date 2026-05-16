import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { stripTags } from "@/lib/rateLimit";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (decoded.role !== "photographer" || !decoded.tenantId) return null;
    return { uid: decoded.uid, tenantId: decoded.tenantId, memberId: decoded.memberId || null, email: decoded.email || null };
  } catch { return null; }
}

async function findMemberDoc(ctx) {
  const teamRef = adminDb.collection("tenants").doc(ctx.tenantId).collection("team");
  if (ctx.memberId) {
    const doc = await teamRef.doc(ctx.memberId).get();
    if (doc.exists) return doc;
  }
  if (ctx.uid) {
    const snap = await teamRef.where("uid", "==", ctx.uid).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  if (ctx.email) {
    const snap = await teamRef.where("email", "==", ctx.email.toLowerCase()).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }
  return null;
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [memberDoc, tenantDoc] = await Promise.all([
    findMemberDoc(ctx),
    adminDb.collection("tenants").doc(ctx.tenantId).get(),
  ]);

  if (!memberDoc || !memberDoc.exists) return Response.json({ error: "Member not found" }, { status: 404 });

  const raw = memberDoc.data();
  // Strip sensitive fields before sending to photographer
  const member = {
    id:            raw.id,
    name:          raw.name,
    email:         raw.email,
    phone:         raw.phone,
    skills:        raw.skills || [],
    color:         raw.color,
    payRate:       raw.payRate ?? null,
    calendarToken: raw.calendarToken,
    permissions:   raw.permissions || {},
    calendarPrefs: raw.calendarPrefs || { readAvailability: true, writeBookings: true, syncBlocks: false },
    googleCalendar: raw.googleCalendar?.refreshToken
      ? {
          connected:  true,
          lastSynced: raw.googleCalendar.lastSynced || null,
        }
      : { connected: false },
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
  if (body.calendarPrefs && typeof body.calendarPrefs === "object") {
    allowed.calendarPrefs = {
      readAvailability: !!body.calendarPrefs.readAvailability,
      writeBookings:    !!body.calendarPrefs.writeBookings,
      syncBlocks:       !!body.calendarPrefs.syncBlocks,
    };
  }

  if (Object.keys(allowed).length === 0) return Response.json({ error: "No valid fields" }, { status: 400 });

  const memberDoc = await findMemberDoc(ctx);
  if (!memberDoc) return Response.json({ error: "Member not found" }, { status: 404 });
  await memberDoc.ref.update(allowed);
  return Response.json({ ok: true });
}
