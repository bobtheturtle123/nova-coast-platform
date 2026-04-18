import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { rateLimit } from "@/lib/rateLimit";

// Public endpoint — used by booking form to prefill returning client info
export async function GET(req, { params }) {
  // 30 lookups per hour per IP — prevents email enumeration attacks
  const rl = await rateLimit(req, `agent-lookup:${params.slug}`, 30, 3600);
  if (rl.limited) return Response.json({ agent: null }, { status: 429 });

  const email = new URL(req.url).searchParams.get("email")?.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) return Response.json({ agent: null });

  try {
    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ agent: null });

    const agentId = Buffer.from(email).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
    const doc = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("agents").doc(agentId)
      .get();

    if (!doc.exists) return Response.json({ agent: null });
    const data = doc.data();
    // Only return the fields needed to prefill — not order history
    return Response.json({ agent: { name: data.name, phone: data.phone, email: data.email } });
  } catch {
    return Response.json({ agent: null });
  }
}
