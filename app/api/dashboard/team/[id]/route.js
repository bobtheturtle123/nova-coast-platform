import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const VALID_PERM_KEYS = ["canViewRevenue","canViewReports","canManageTeam","canManageProducts","canEditSettings","canCreateBookings"];

  const update = {
    name:          (body.name || "").slice(0, 80),
    email:         (body.email || "").toLowerCase(),
    phone:         body.phone || "",
    homeZip:       (body.homeZip || "").slice(0, 10),
    role:          ["photographer","manager","assistant","admin"].includes(body.role) ? body.role : "photographer",
    skills:        Array.isArray(body.skills) ? body.skills.map(String).slice(0, 50) : [],
    color:         body.color || "#3486cf",
    active:        body.active !== false,
    payRate:       body.payRate != null ? Number(body.payRate) || 0 : 0,
    serviceRates:  body.serviceRates && typeof body.serviceRates === "object"
      ? Object.fromEntries(
          Object.entries(body.serviceRates)
            .slice(0, 100)
            .map(([k, v]) => [
              String(k).slice(0, 64),
              typeof v === "object" && v !== null
                ? Object.fromEntries(Object.entries(v).map(([t, r]) => [String(t).slice(0, 20), Number(r) || 0]))
                : (Number(v) || 0),
            ])
        )
      : {},
    bufferMinutes: body.bufferMinutes != null ? Number(body.bufferMinutes) || 0 : 0,
    workingHours:  body.workingHours && typeof body.workingHours === "object" ? body.workingHours : {},
  };

  // Only overwrite permissions when the caller explicitly sends them
  if (body.permissions && typeof body.permissions === "object") {
    update.permissions = Object.fromEntries(VALID_PERM_KEYS.map((k) => [k, !!body.permissions[k]]));
  }

  const memberRef = adminDb.collection("tenants").doc(ctx.tenantId).collection("team").doc(params.id);
  const memberDoc = await memberRef.get();

  let newCalToken = null;

  // Generate token if member doesn't have one yet
  if (memberDoc.exists && !memberDoc.data().calendarToken) {
    newCalToken          = uuidv4().replace(/-/g, "");
    update.calendarToken = newCalToken;
    update.tenantId      = ctx.tenantId;
  }

  // Regenerate on explicit request
  if (body.regenerateCalendarToken) {
    newCalToken          = uuidv4().replace(/-/g, "");
    update.calendarToken = newCalToken;
    update.tenantId      = ctx.tenantId;
  }

  const batch = adminDb.batch();
  batch.update(memberRef, update);
  if (newCalToken) {
    batch.set(
      adminDb.collection("calendarTokens").doc(newCalToken),
      { tenantId: ctx.tenantId, memberId: params.id }
    );
  }
  await batch.commit();

  // If the member has an accepted Firebase account, update their custom claims
  // so the role change takes effect on their next token refresh (within 1 hour).
  if (memberDoc.exists && memberDoc.data().uid) {
    try {
      const uid = memberDoc.data().uid;
      const existing = (await adminAuth.getUser(uid)).customClaims || {};
      await adminAuth.setCustomUserClaims(uid, {
        ...existing,
        role:     update.role,
        tenantId: ctx.tenantId,
        memberId: params.id,
      });
    } catch { /* user may not exist in auth */ }
  }

  return Response.json({ ok: true });
}

export async function DELETE(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const memberRef = adminDb.collection("tenants").doc(ctx.tenantId).collection("team").doc(params.id);
  const memberDoc = await memberRef.get();

  const batch = adminDb.batch();
  batch.delete(memberRef);

  if (memberDoc.exists) {
    const data = memberDoc.data();

    // Revoke Firebase auth claims so the member loses portal access immediately
    if (data.uid) {
      try {
        await adminAuth.setCustomUserClaims(data.uid, {});
        await adminAuth.revokeRefreshTokens(data.uid);
      } catch { /* user may not exist */ }
    }

    if (data.calendarToken) {
      batch.delete(adminDb.collection("calendarTokens").doc(data.calendarToken));
    }
  }

  await batch.commit();
  return Response.json({ ok: true });
}
