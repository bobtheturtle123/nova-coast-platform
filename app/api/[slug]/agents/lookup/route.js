import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";

// Public endpoint — no auth required — used by booking form to prefill returning client info
export async function GET(req, { params }) {
  const email = new URL(req.url).searchParams.get("email")?.toLowerCase().trim();
  if (!email || !email.includes("@")) return Response.json({ agent: null });

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
