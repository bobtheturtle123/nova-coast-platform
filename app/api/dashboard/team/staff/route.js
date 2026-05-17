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

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, uid: decoded.uid };
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

  const { email, role, permissions } = await req.json();
  if (!email?.trim()) return Response.json({ error: "Email is required" }, { status: 400 });

  const validRoles = ["admin", "manager", "photographer", "assistant"];
  const staffRole = validRoles.includes(role) ? role : "manager";
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
      tenantId:   ctx.tenantId,
      inviteToken: token,
      accepted:   false,
      expiresAt,
      createdAt:  new Date(),
    });

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

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("staffInvites").doc(id)
    .delete();

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
