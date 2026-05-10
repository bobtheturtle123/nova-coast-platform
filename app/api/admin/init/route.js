import { adminDb, adminAuth } from "@/lib/firebase-admin";

// ⚠️  TEMPORARY ONE-TIME ROUTE — DELETE THIS FILE AFTER USE
// Grants superadmin claim + permanent Scale plan to the SUPERADMIN_EMAIL account.
// Protected by GRANT_INIT_SECRET env var. Safe to deploy — does nothing without the secret.

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const secret = searchParams.get("secret");
  const expectedSecret = process.env.ADMIN_SECRET;

  if (!expectedSecret || !secret || secret !== expectedSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = searchParams.get("email") || process.env.SUPERADMIN_EMAIL;
  if (!email) {
    return Response.json({ error: "Pass ?email= or set SUPERADMIN_EMAIL env var" }, { status: 400 });
  }

  try {
    const user = await adminAuth.getUserByEmail(email);

    // Set superadmin claim
    await adminAuth.setCustomUserClaims(user.uid, { role: "superadmin" });

    // Find tenant by ownerUid
    const snap = await adminDb
      .collection("tenants")
      .where("ownerUid", "==", user.uid)
      .limit(1)
      .get();

    let tenantId = null;
    if (!snap.empty) {
      await snap.docs[0].ref.update({
        permanentPlan:        "scale",
        subscriptionPlan:     "scale",
        subscriptionStatus:   "active",
        stripeSubscriptionId: "manual_override",
        trialEndsAt:          null,
      });
      tenantId = snap.docs[0].id;
    }

    return Response.json({
      ok:        true,
      uid:       user.uid,
      email,
      tenantId,
      message:   tenantId
        ? "Superadmin claim set + Scale plan granted. Sign out and back in."
        : "Superadmin claim set. No tenant found yet — re-run after completing onboarding.",
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
