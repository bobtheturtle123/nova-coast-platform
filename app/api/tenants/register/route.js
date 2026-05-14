import { adminAuth } from "@/lib/firebase-admin";
import { createTenant, toSlug, isSlugTaken } from "@/lib/tenants";
import { sendWelcomeEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { generateReferralCode, getTenantByReferralCode, createReferralRecord } from "@/lib/referral";

export async function POST(req) {
  // 3 registrations per IP per hour — prevents account spam
  const rl = await rateLimit(req, "tenant-register", 3, 3600);
  if (rl.limited) {
    return Response.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
  }

  try {
    const { uid, email, businessName, phone = "", accessCode = "" } = await req.json();

    if (!uid || !email || !businessName) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify the uid is a valid Firebase user
    const user = await adminAuth.getUser(uid);
    if (user.email !== email) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Resolve trial length — check access code against env var
    // Format: SIGNUP_ACCESS_CODES=FRIENDS2025:60,BETA2025:30  (code:days)
    // or simply FRIENDS2025,BETA2025  (defaults to 60 days)
    let trialDays = 14;
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
    const tenantId = await createTenant({ uid, email, businessName, slug, phone, referralCode, referredBy, trialDays });

    // Record referral relationship (status: pending until first payment)
    if (referredBy && referredBy !== tenantId) {
      createReferralRecord({ referrerId: referredBy, refereeId: tenantId, refereeEmail: email })
        .catch(console.error);
    }

    // Send welcome email (non-blocking)
    sendWelcomeEmail({ email, businessName, slug }).catch(console.error);

    return Response.json({ tenantId, slug });
  } catch (err) {
    console.error("Tenant register error:", err);
    return Response.json({ error: err.message || "Registration failed" }, { status: 500 });
  }
}
