import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getTenantFromToken(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const decoded = await adminAuth.verifyIdToken(auth);
  if (!decoded.tenantId) return null;
  return { uid: decoded.uid, tenantId: decoded.tenantId, role: decoded.role || "owner" };
}

export async function PATCH(req) {
  try {
    const ctx = await getTenantFromToken(req);
    if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Only the owner/admin may change business/account settings. A team member
    // (photographer/manager/custom) must not be able to edit the business.
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      return Response.json({ error: "Only the account owner can change business settings." }, { status: 403 });
    }

    const body = await req.json();

    // Whitelist updatable fields
    const allowed = ["businessName", "phone", "ownerName", "fromZip", "country", "tempUnit", "currency", "locale", "branding", "pricingConfig", "bookingConfig", "emailTemplate", "emailTemplates", "smsTemplates", "travelFeeConfig", "costRates", "onboardingCompleted", "onboardingStep", "travelRadiusMiles", "travelRatePerMile", "starterGuideCompleted", "onboarding", "defaultCoords", "integrations", "ownerShoots", "gallerySettings", "customDomainCharge"];
    const update = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = body[key];
    }

    await adminDb.collection("tenants").doc(ctx.tenantId).update(update);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Tenant update error:", err);
    return Response.json({ error: "Failed to update" }, { status: 500 });
  }
}
