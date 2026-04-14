import { adminAuth } from "@/lib/firebase-admin";
import { createTenant, toSlug, isSlugTaken } from "@/lib/tenants";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(req) {
  try {
    const { uid, email, businessName } = await req.json();

    if (!uid || !email || !businessName) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify the uid is a valid Firebase user
    const user = await adminAuth.getUser(uid);
    if (user.email !== email) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Generate slug
    let slug = toSlug(businessName);
    let attempt = 0;
    while (await isSlugTaken(slug)) {
      attempt++;
      slug = `${toSlug(businessName)}-${attempt}`;
    }

    // Create tenant + seed subcollections + set custom claims
    const tenantId = await createTenant({ uid, email, businessName, slug });

    // Send welcome email (non-blocking)
    sendWelcomeEmail({ email, businessName, slug }).catch(console.error);

    return Response.json({ tenantId, slug });
  } catch (err) {
    console.error("Tenant register error:", err);
    return Response.json({ error: err.message || "Registration failed" }, { status: 500 });
  }
}
