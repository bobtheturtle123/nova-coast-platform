/**
 * Staff (Employee / VA) invite API
 *
 * POST /api/dashboard/team/staff  — send invite email
 * GET  /api/dashboard/team/staff  — list all staff invites + accepted staff
 * DELETE /api/dashboard/team/staff?id=  — revoke an invite or remove staff access
 */
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { Resend } from "resend";
import { v4 as uuidv4 } from "uuid";
import { getAppUrl } from "@/lib/appUrl";
import { normalizeRole } from "@/lib/roles";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, uid: decoded.uid, role: decoded.role || (decoded.memberId ? "photographer" : "owner") };
  } catch { return null; }
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("staffInvites")
    .orderBy("createdAt", "desc")
    .get();

  const invites = snap.docs.map((d) => {
    const data = d.data();
    return {
      id:        d.id,
      email:     data.email,
      role:      data.role,
      accepted:  data.accepted || false,
      acceptedAt: data.acceptedAt?.toDate?.()?.toISOString?.() ?? null,
      expiresAt:  data.expiresAt?.toDate?.()?.toISOString?.() ?? null,
      createdAt:  data.createdAt?.toDate?.()?.toISOString?.() ?? null,
    };
  });

  return Response.json({ invites });
}

export async function POST(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return Response.json({ error: "Insufficient permissions to invite staff" }, { status: 403 });
  }

  const tenantSnap = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const tenantData = tenantSnap.exists ? tenantSnap.data() : {};
  if (tenantData.subscriptionStatus === "canceled") {
    return Response.json({ error: "Your subscription has ended. Reactivate to invite team members." }, { status: 403 });
  }

  // Enforce the plan's seat limit SERVER-SIDE and ATOMICALLY. Pending/active
  // members and the owner each consume a seat. The UI gate is not enough — a
  // direct API call (or two simultaneous invites when one seat remains) could
  // otherwise exceed the plan. We compute the authoritative member count, then
  // reserve a seat inside a transaction using a short-lived reservation window
  // so concurrent requests can't both slip past the boundary. Reservations
  // auto-expire (the created member doc becomes the real count), so there is no
  // persistent counter to drift.
  const { getEffectivePlan, getSeatLimit } = await import("@/lib/plans");
  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);
  const seatLimit = getSeatLimit(getEffectivePlan(tenantData), tenantData.addonSeats || 0);
  if (seatLimit !== null) {
    const teamSnap = await tenantRef.collection("team").get();
    const activeMembers = teamSnap.docs.filter((d) => {
      const m = d.data();
      return m.status !== "removed" && m.active !== false;
    }).length;
    const RESERVE_TTL = 15000;
    const reserved = await adminDb.runTransaction(async (tx) => {
      const t = await tx.get(tenantRef);
      const now = Date.now();
      const inflight = (t.data()?.seatReservations || []).filter((ts) => now - ts < RESERVE_TTL);
      const used = activeMembers + 1 /* owner */ + inflight.length;
      if (used >= seatLimit) return false;
      tx.update(tenantRef, { seatReservations: [...inflight, now] });
      return true;
    });
    if (!reserved) {
      return Response.json({ error: `Your plan includes ${seatLimit} seat${seatLimit !== 1 ? "s" : ""}. Upgrade or add a seat to invite more team members.`, code: "SEAT_LIMIT" }, { status: 403 });
    }
  }

  const { email, role, permissions, customRoleTitle } = await req.json();
  if (!email?.trim()) return Response.json({ error: "Email is required" }, { status: 400 });

  let staffRole = normalizeRole(role);
  // Invites must never create an owner (ownership isn't transferred via the
  // invite flow). A crafted request sending role:"owner" is downgraded.
  if (staffRole === "owner") staffRole = "admin";
  const roleTitle = (customRoleTitle || "").slice(0, 40);
  const VALID_PERM_KEYS = ["canViewListings","canCreateBookings","canViewRevenue","canViewReports","canManageTeam","canManageProducts","canEditSettings"];
  const savedPerms = permissions && typeof permissions === "object"
    ? Object.fromEntries(VALID_PERM_KEYS.map((k) => [k, !!permissions[k]]))
    : {};

  // Get tenant info for email
  const tenantDoc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const tenant    = tenantDoc.exists ? tenantDoc.data() : {};

  const token     = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const APP_URL   = getAppUrl();
  const inviteUrl = `${APP_URL}/staff-invite/${token}`;

  const normalizedEmail = email.trim().toLowerCase();

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("staffInvites").doc(token)
    .set({
      email:      normalizedEmail,
      role:       staffRole,
      customRoleTitle: roleTitle,
      tenantId:   ctx.tenantId,
      inviteToken: token,
      accepted:   false,
      expiresAt,
      createdAt:  new Date(),
    });

  // Top-level token index — enables O(1) lookup at accept time without a full collectionGroup scan
  await adminDb.collection("staffInviteTokens").doc(token).set({ tenantId: ctx.tenantId, createdAt: new Date() });

  // Also create a minimal team member document so this person appears in the Team page
  // Check if a team member with this email already exists
  const existingSnap = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("team")
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();

  if (existingSnap.empty) {
    await adminDb
      .collection("tenants").doc(ctx.tenantId)
      .collection("team").doc(token)
      .set({
        id:          token,
        email:       normalizedEmail,
        role:        staffRole,
        customRoleTitle: roleTitle,
        name:        normalizedEmail.split("@")[0],
        status:      "invited",
        inviteToken: token,
        permissions: savedPerms,
        createdAt:   new Date(),
      });
  } else {
    // Update permissions on existing team doc
    await existingSnap.docs[0].ref.update({ permissions: savedPerms });
  }

  // Send email
  let emailFailed = !resend;
  if (resend) {
    try {
      await resend.emails.send({
        from:    `${tenant.businessName || "KyoriaOS"} <noreply@mail.kyoriaos.com>`,
        to:      email.trim(),
        subject: `You've been invited to manage ${tenant.businessName || "a photography studio"}`,
        html: `
          <p>Hi,</p>
          <p>You've been invited to join <strong>${tenant.businessName || "a photography studio"}</strong> as a <strong>${staffRole}</strong> on KyoriaOS.</p>
          <p><a href="${inviteUrl}" style="background:#3486cf;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;display:inline-block;font-weight:600;margin:16px 0;">Accept Invitation</a></p>
          <p>This invite expires in 7 days.</p>
        `,
      });
    } catch {
      emailFailed = true;
    }
  }

  return Response.json({ ok: true, inviteUrl, token, ...(emailFailed && { emailFailed: true }) });
}

export async function DELETE(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (ctx.role !== "owner" && ctx.role !== "admin") {
    return Response.json({ error: "Insufficient permissions to manage staff" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  // Also revoke Firebase claims if user accepted
  const inviteDoc = await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("staffInvites").doc(id)
    .get();

  if (inviteDoc.exists && inviteDoc.data().uid) {
    try {
      await adminAuth.setCustomUserClaims(inviteDoc.data().uid, {});
    } catch { /* user may not exist */ }
  }

  await Promise.all([
    adminDb.collection("tenants").doc(ctx.tenantId).collection("staffInvites").doc(id).delete(),
    adminDb.collection("staffInviteTokens").doc(id).delete().catch(() => {}),
  ]);

  // Also remove the mirrored team member doc if it was created from this invite (status: invited)
  const teamDocRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("team").doc(id);
  const teamDoc = await teamDocRef.get();
  if (teamDoc.exists && teamDoc.data().status === "invited") {
    await teamDocRef.delete();
  }

  return Response.json({ ok: true });
}
