import { adminDb, adminAuth } from "@/lib/firebase-admin";

import { safeDate } from "@/lib/dateUtils";

export async function POST(req, { params }) {
  const { token } = params;

  // Extract the caller's UID from their Firebase ID token — never trust client-supplied UID
  const authHeader = req.headers.get("authorization") || "";
  const rawToken = authHeader.replace("Bearer ", "").trim();
  if (!rawToken) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let uid, email;
  try {
    const decoded = await adminAuth.verifyIdToken(rawToken);
    uid   = decoded.uid;
    email = decoded.email || "";
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  // O(1) lookup via top-level token index (written at invite creation time)
  let tenantId;
  try {
    const tokenDoc = await adminDb.collection("staffInviteTokens").doc(token).get();
    if (!tokenDoc.exists) return Response.json({ error: "Invite not found." }, { status: 404 });
    tenantId = tokenDoc.data().tenantId;
  } catch {
    return Response.json({ error: "Could not verify invite." }, { status: 500 });
  }

  const inviteRef  = adminDb.collection("tenants").doc(tenantId).collection("staffInvites").doc(token);
  let inviteData;
  try {
    const inviteDoc = await inviteRef.get();
    if (!inviteDoc.exists) return Response.json({ error: "Invite not found." }, { status: 404 });
    inviteData = inviteDoc.data();
  } catch {
    return Response.json({ error: "Could not verify invite." }, { status: 500 });
  }

  if (inviteData.accepted) {
    return Response.json({ error: "This invite has already been used." }, { status: 400 });
  }
  const expiresAt = safeDate(inviteData.expiresAt);
  if (!expiresAt || expiresAt < new Date()) {
    return Response.json({ error: "This invite has expired." }, { status: 400 });
  }

  const role = inviteData.role || "manager";

  // The team member doc was created with the same ID as the invite token
  const memberId = token;

  await adminAuth.setCustomUserClaims(uid, {
    role,
    tenantId,
    memberId,
  });

  await Promise.all([
    inviteRef.update({ accepted: true, acceptedAt: new Date(), uid, email: email || inviteData.email }),
    adminDb.collection("tenants").doc(tenantId).collection("team").doc(memberId).update({
      uid,
      status: "active",
      acceptedAt: new Date(),
    }).catch(() => {}),
  ]);

  // Notify the tenant owner (fire-and-forget).
  (async () => {
    try {
      const key = process.env.RESEND_API_KEY;
      if (!key) return;
      const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();
      const tenant    = tenantDoc.data() || {};
      const ownerEmail = tenant.email;
      if (!ownerEmail) return;
      const bizName  = tenant.branding?.businessName || tenant.businessName || "your team";
      const appUrl   = (await import("@/lib/appUrl")).getAppUrl();
      const who      = inviteData.name || email || inviteData.email || "A new teammate";
      const { Resend } = await import("resend");
      await new Resend(key).emails.send({
        from:    `KyoriaOS <${process.env.RESEND_FROM_EMAIL || "noreply@mail.kyoriaos.com"}>`,
        to:      ownerEmail,
        subject: `${who} joined ${bizName}`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
          <h2 style="color:#3486cf;margin:0 0 12px">New team member joined</h2>
          <p style="color:#555;margin:0 0 16px"><strong>${who}</strong> accepted your invitation and joined as <strong>${role}</strong>.</p>
          <a href="${appUrl}/dashboard/team" style="display:inline-block;background:#3486cf;color:#fff;padding:11px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View Team</a>
        </div>`,
      });
    } catch (e) { console.error("[staff-invite/accept] owner notification failed:", e?.message || e); }
  })();

  return Response.json({ ok: true, tenantId, role, memberId });
}
