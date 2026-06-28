import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";
import { normalizeRole, defaultPermissions } from "@/lib/roles";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, role: decoded.role || (decoded.memberId ? "photographer" : "owner") };
  } catch { return null; }
}

export async function PATCH(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return Response.json({ error: "Insufficient permissions to manage team members" }, { status: 403 });
  }

  const body = await req.json();
  const VALID_PERM_KEYS = ["canViewListings","canCreateBookings","canViewRevenue","canViewReports","canManageTeam","canManageProducts","canEditSettings"];

  const update = {
    name:          (body.name || "").slice(0, 80),
    email:         (body.email || "").toLowerCase(),
    phone:         body.phone || "",
    homeZip:       (body.homeZip || "").slice(0, 10),
    role:          normalizeRole(body.role),
    customRoleTitle: (body.customRoleTitle || "").slice(0, 40),
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
    // Whether this member shows in the photographer picker on bookings.
    showInScheduling: body.showInScheduling !== undefined
      ? !!body.showInScheduling
      : normalizeRole(body.role) === "photographer",
    photoUrl:      typeof body.photoUrl === "string" ? body.photoUrl.slice(0, 500) : "",
  };

  // Only overwrite permissions when the caller explicitly sends them
  if (body.permissions && typeof body.permissions === "object") {
    update.permissions = Object.fromEntries(VALID_PERM_KEYS.map((k) => [k, !!body.permissions[k]]));
  }

  const memberRef = adminDb.collection("tenants").doc(ctx.tenantId).collection("team").doc(params.id);
  const memberDoc = await memberRef.get();

  // Safety net: promoting a non-shooting role (manager/admin) to photographer
  // must make them schedulable, even if a stale showInScheduling:false carried
  // over from their old role (otherwise they never appear in manual booking).
  const newRole  = normalizeRole(body.role);
  const prevRole = memberDoc.exists ? normalizeRole(memberDoc.data().role) : null;
  if (prevRole && newRole !== prevRole) {
    // Role changed — reset access to the new role's defaults so elevated
    // permissions never carry over (e.g. a manager promoted to photographer
    // must lose settings/team/revenue access). "custom" keeps the explicitly
    // chosen permissions sent by the client.
    if (newRole !== "custom") {
      update.permissions = defaultPermissions(newRole);
    }
    if (newRole === "photographer") {
      update.showInScheduling = true;
      update.active = true; // appears (and isn't "unavailable") in scheduling
    }
  }

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

  // Update the member's Firebase custom claims so the role change actually takes
  // effect (e.g. a manager promoted to photographer gets the photographer portal).
  // Members invited via different flows may not have `uid` on the doc, so fall
  // back to looking the account up by email. The dashboard force-refreshes the
  // token on load, so the new role applies on their next page load.
  try {
    let uid = memberDoc.exists ? memberDoc.data().uid : null;
    if (!uid && update.email) {
      try { uid = (await adminAuth.getUserByEmail(update.email)).uid; } catch { /* no account yet */ }
    }
    if (uid) {
      const existing = (await adminAuth.getUser(uid)).customClaims || {};
      await adminAuth.setCustomUserClaims(uid, {
        ...existing,
        role:     update.role,
        tenantId: ctx.tenantId,
        memberId: params.id,
      });
      // Backfill uid onto the member doc so future updates find it directly.
      if (!memberDoc.data()?.uid) { try { await memberRef.update({ uid }); } catch {} }
    }
  } catch { /* non-fatal */ }

  // Return the updated member so the client can refresh state without re-fetching
  const updatedDoc = await memberRef.get();
  const updatedData = updatedDoc.data() || {};
  return Response.json({
    ok: true,
    member: {
      id:           params.id,
      name:         updatedData.name,
      email:        updatedData.email,
      phone:        updatedData.phone,
      role:         updatedData.role,
      customRoleTitle: updatedData.customRoleTitle || "",
      showInScheduling: updatedData.showInScheduling,
      color:        updatedData.color,
      active:       updatedData.active,
      skills:       updatedData.skills        || [],
      payRate:      updatedData.payRate       ?? null,
      serviceRates: updatedData.serviceRates  || {},
      bufferMinutes:updatedData.bufferMinutes ?? 0,
      workingHours: updatedData.workingHours  || {},
      homeZip:      updatedData.homeZip       || "",
      permissions:  updatedData.permissions   || {},
      calendarToken:updatedData.calendarToken || null,
      googleCalendar:updatedData.googleCalendar || {},
      calendarPrefs: updatedData.calendarPrefs  || {},
    },
  });
}

export async function DELETE(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return Response.json({ error: "Insufficient permissions to manage team members" }, { status: 403 });
  }

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
      } catch (err) {
        console.error(`[team/delete] Failed to revoke tokens for uid=${data.uid}:`, err?.message);
        // Non-fatal: claims will expire naturally within 1 hour
      }
    }

    if (data.calendarToken) {
      batch.delete(adminDb.collection("calendarTokens").doc(data.calendarToken));
    }
  }

  await batch.commit();
  return Response.json({ ok: true });
}
