export const dynamic = "force-dynamic";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { toSlug, isSlugTaken } from "@/lib/tenants";

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const rawToken = authHeader.replace("Bearer ", "").trim();
    if (!rawToken) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(rawToken);
    const uid     = decoded.uid;
    const email   = decoded.email || "";

    // Find tenant by ownerUid (works even when JWT claims are missing/stale)
    const snap = await adminDb.collection("tenants")
      .where("ownerUid", "==", uid)
      .limit(1)
      .get();

    let tenantId, businessName;

    if (!snap.empty) {
      // Tenant exists — just repair the missing claims
      tenantId     = snap.docs[0].id;
      businessName = snap.docs[0].data().businessName || "";
    } else {
      // No tenant at all (registration failed mid-way) — create a minimal one
      const defaultName = email
        .split("@")[0]
        .replace(/[._-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim() || "My Business";

      let slug    = toSlug(defaultName);
      let attempt = 0;
      while (await isSlugTaken(slug)) {
        slug = `${toSlug(defaultName)}-${++attempt}`;
      }

      tenantId = adminDb.collection("tenants").doc().id;

      await adminDb.collection("tenants").doc(tenantId).set({
        id:    tenantId,
        slug,
        businessName: defaultName,
        email,
        phone:   "",
        fromZip: "",
        ownerUid: uid,
        branding: {
          businessName: defaultName,
          tagline:      "Professional real estate photography",
          primaryColor: "#3486cf",
          accentColor:  "#c9a96e",
          logoUrl:      "",
        },
        subscriptionStatus:      "trialing",
        subscriptionPlan:        "starter",
        stripeCustomerId:        null,
        stripeSubscriptionId:    null,
        stripeConnectAccountId:  null,
        stripeConnectOnboarded:  false,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        createdAt:   new Date(),
        referralCode:  null,
        referredBy:    null,
        referralCredits: 0,
      });

      businessName = defaultName;
    }

    // Always re-set the custom claims
    await adminAuth.setCustomUserClaims(uid, { role: "owner", tenantId });

    return Response.json({ ok: true, tenantId, businessName });
  } catch (err) {
    console.error("repair-claims error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
