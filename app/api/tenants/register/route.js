import { adminAuth } from "@/lib/firebase-admin";
import { createTenant, toSlug, isSlugTaken } from "@/lib/tenants";
import { sendWelcomeEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { generateReferralCode, getTenantByReferralCode, createReferralRecord } from "@/lib/referral";
import { isSuperAdminEmail } from "@/lib/plans";

export async function POST(req) {
  try {
    const { uid, email, ownerName = "", businessName, phone = "", accessCode = "" } = await req.json();

    if (!uid || !email || !businessName) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Registrations per IP per hour — prevents account spam. Owner/super-admin
    // emails are exempt so they can freely create + test accounts.
    if (!isSuperAdminEmail(email)) {
      const rl = await rateLimit(req, "tenant-register", 8, 3600);
      if (rl.limited) {
        return Response.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
      }
    }

    // Verify the uid is a valid Firebase user
    const user = await adminAuth.getUser(uid);
    if (user.email !== email) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Resolve trial length — check access code against env var
    // Format: SIGNUP_ACCESS_CODES=FRIENDS2025:60,BETA2025:30  (code:days)
    // or simply FRIENDS2025,BETA2025  (defaults to 60 days)
    let trialDays = 3;
    if (accessCode) {
      const rawCodes = (process.env.SIGNUP_ACCESS_CODES || "").split(",").map((s) => s.trim()).filter(Boolean);
      const upper = accessCode.toUpperCase();
      for (const entry of rawCodes) {
        const [code, days] = entry.split(":");
        if (code.toUpperCase() === upper) {
          trialDays = days ? parseInt(days, 10) : 60;
          break;
        }
      }
    }

    // Generate slug
    let slug = toSlug(businessName);
    let attempt = 0;
    while (await isSlugTaken(slug)) {
      attempt++;
      slug = `${toSlug(businessName)}-${attempt}`;
    }

    // Referral attribution — read cookie set by /ref/[code]
    const refCode    = req.cookies.get("platform_ref")?.value || null;
    const referrer   = refCode ? await getTenantByReferralCode(refCode).catch(() => null) : null;
    const referredBy = referrer?.id || null;

    // Generate this new tenant's own referral code
    const referralCode = generateReferralCode(businessName);

    // Create tenant + seed subcollections + set custom claims
    const tenantId = await createTenant({ uid, email, ownerName, businessName, slug, phone, referralCode, referredBy, trialDays });

    // Record referral relationship (status: pending until first payment).
    // This MUST be awaited — on serverless the function can freeze right after
    // the response, dropping a fire-and-forget write. If the pending referral
    // record is never created, the referrer would never receive their credit.
    if (referredBy && referredBy !== tenantId) {
      try {
        await createReferralRecord({ referrerId: referredBy, refereeId: tenantId, refereeEmail: email });
      } catch (err) {
        console.error("Failed to create referral record:", err?.message);
      }
    }

    // Send welcome email (non-blocking)
    sendWelcomeEmail({ email, businessName, slug }).catch(console.error);

    return Response.json({ tenantId, slug });
  } catch (err) {
    console.error("Tenant register error:", err);
    return Response.json({ error: err.message || "Registration failed" }, { status: 500 });
  }
}
