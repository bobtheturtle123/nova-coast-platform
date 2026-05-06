import { adminDb, adminAuth } from "@/lib/firebase-admin";

// POST /api/admin/set-plan
// Body: { email, plan, adminSecret }
// Sets subscriptionPlan + subscriptionStatus on the tenant owned by email.
// Protected by ADMIN_SECRET env var.
export async function POST(req) {
  const { email, plan, adminSecret } = await req.json();

  const secret = process.env.ADMIN_SECRET;
  if (!secret || adminSecret !== secret) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!email || !plan) {
    return Response.json({ error: "email and plan are required" }, { status: 400 });
  }

  let user;
  try {
    user = await adminAuth.getUserByEmail(email);
  } catch {
    return Response.json({ error: `No Firebase user found for ${email}` }, { status: 404 });
  }

  const snap = await adminDb
    .collection("tenants")
    .where("ownerUid", "==", user.uid)
    .limit(1)
    .get();

  if (snap.empty) {
    return Response.json({ error: `No tenant found for ${email} (uid: ${user.uid})` }, { status: 404 });
  }

  const doc = snap.docs[0];
  await doc.ref.update({
    subscriptionPlan:   plan,
    subscriptionStatus: "active",
  });

  console.log(`[admin/set-plan] ${email} → plan=${plan} (tenantId=${doc.id})`);

  return Response.json({
    ok: true,
    tenantId:     doc.id,
    businessName: doc.data().businessName || email,
    plan,
    status: "active",
  });
}
