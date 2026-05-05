import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { getAppUrl } from "@/lib/appUrl";

async function getAgent(slug, token) {
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { error: "Not found." };

  const snap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("agents")
    .where("accessToken", "==", token)
    .limit(1)
    .get();

  if (snap.empty) return { error: "Unauthorized." };
  return { tenant, agentRef: snap.docs[0].ref, agentData: snap.docs[0].data() };
}

// GET — list team members
export async function GET(req, { params }) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return Response.json({ error: "token required." }, { status: 400 });

  const ctx = await getAgent(params.slug, token);
  if (ctx.error) return Response.json({ error: ctx.error }, { status: 401 });

  const members = (ctx.agentData.teamMembers || []).map((m) => ({
    email:     m.email,
    name:      m.name     || "",
    invitedAt: m.invitedAt ? (typeof m.invitedAt === "string" ? m.invitedAt : m.invitedAt.toDate?.()?.toISOString?.() ?? null) : null,
    status:    m.status   || "pending",
  }));

  return Response.json({ members });
}

// POST — invite a team member
export async function POST(req, { params }) {
  const { token, email, name } = await req.json();
  if (!token || !email) return Response.json({ error: "token and email required." }, { status: 400 });

  const emailLc = email.trim().toLowerCase();
  if (!emailLc.includes("@")) return Response.json({ error: "Invalid email." }, { status: 400 });

  const ctx = await getAgent(params.slug, token);
  if (ctx.error) return Response.json({ error: ctx.error }, { status: 401 });

  const existing = (ctx.agentData.teamMembers || []);
  if (existing.some((m) => m.email === emailLc)) {
    return Response.json({ error: "This email has already been invited." }, { status: 409 });
  }

  const portalUrl = `${getAppUrl()}/${params.slug}/agent?token=${token}`;

  const newMember = {
    email:     emailLc,
    name:      (name || "").trim().slice(0, 80),
    invitedAt: new Date().toISOString(),
    status:    "pending",
  };

  await ctx.agentRef.update({
    teamMembers: [...existing, newMember],
    updatedAt:   new Date(),
  });

  // Best-effort email — fire and forget
  try {
    const { sendEmail } = await import("@/lib/email");
    await sendEmail({
      to:      emailLc,
      subject: `${ctx.agentData.name || "Your agent"} invited you to their media portal`,
      html:    `
        <p>Hi${newMember.name ? " " + newMember.name : ""},</p>
        <p><strong>${ctx.agentData.name || "Your agent"}</strong> has invited you to collaborate on their real estate media portal.</p>
        <p><a href="${portalUrl}" style="background:#3486cf;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin-top:8px;">Access Portal</a></p>
        <p style="color:#9CA3AF;font-size:12px;margin-top:16px;">This link grants read access to all listings in the portal.</p>
      `,
    });
  } catch { /* email not critical */ }

  return Response.json({ ok: true, member: newMember });
}

// DELETE — remove a team member
export async function DELETE(req, { params }) {
  const { token, email } = await req.json();
  if (!token || !email) return Response.json({ error: "token and email required." }, { status: 400 });

  const ctx = await getAgent(params.slug, token);
  if (ctx.error) return Response.json({ error: ctx.error }, { status: 401 });

  const updated = (ctx.agentData.teamMembers || []).filter((m) => m.email !== email.toLowerCase());
  await ctx.agentRef.update({ teamMembers: updated, updatedAt: new Date() });

  return Response.json({ ok: true });
}
