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

  // Atomically claim the invite so two simultaneous accepts (or replays) can't
  // both succeed, and enforce email binding + expiry INSIDE the transaction so
  // the checks and the state change can't be separated by a race.
  let inviteData;
  try {
    inviteData = await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(inviteRef);
      if (!doc.exists) throw new Error("not_found");
      const data = doc.data();
      if (data.accepted) throw new Error("already_used");
      const exp = safeDate(data.expiresAt);
      if (!exp || exp < new Date()) throw new Error("expired");
      // Email binding: the invite is for a specific address — only that account
      // may accept it. Prevents a different logged-in user from claiming it.
      if (data.email && data.email.toLowerCase() !== String(email || "").toLowerCase()) {
        throw new Error("wrong_email");
      }
      tx.update(inviteRef, { accepted: true, acceptedAt: new Date(), uid, email: email || data.email });
      return data;
    });
  } catch (e) {
    const map = {
      not_found:    ["Invite not found.", 404],
      already_used: ["This invite has already been used.", 400],
      expired:      ["This invite has expired.", 400],
      wrong_email:  ["This invitation was sent to a different email address. Sign in with that email to accept.", 403],
    };
    const [msg, status] = map[e.message] || ["Could not verify invite.", 500];
    return Response.json({ error: msg }, { status });
  }

  const role = inviteData.role || "manager";

  // The team member doc was created with the same ID as the invite token
  const memberId = token;

  await adminAuth.setCustomUserClaims(uid, {
    role,
    tenantId,
    memberId,
  });

  await adminDb.collection("tenants").doc(tenantId).collection("team").doc(memberId).update({
    uid,
    status: "active",
    acceptedAt: new Date(),
  }).catch(() => {});

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
