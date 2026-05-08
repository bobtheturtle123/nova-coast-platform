import { adminDb } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";

// PATCH /api/[slug]/agent/revision/[revisionId]
// Body: { token, status: "cancelled" }
// Agents can only cancel their own pending revisions.
export async function PATCH(req, { params }) {
  try {
    const { token, status } = await req.json();
    if (!token || status !== "cancelled") {
      return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const tenant = await getTenantBySlug(params.slug);
    if (!tenant) return Response.json({ error: "Not found" }, { status: 404 });

    // Verify agent token
    const agentsSnap = await adminDb
      .collection("tenants").doc(tenant.id)
      .collection("agents")
      .where("accessToken", "==", token)
      .limit(1)
      .get();

    if (agentsSnap.empty) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const agent = agentsSnap.docs[0].data();

    // Fetch the revision
    const revRef = adminDb
      .collection("tenants").doc(tenant.id)
      .collection("revisionRequests").doc(params.revisionId);

    const revDoc = await revRef.get();
    if (!revDoc.exists) return Response.json({ error: "Not found" }, { status: 404 });

    const rev = revDoc.data();
    // Only the submitting agent can cancel, and only if still pending
    if (rev.agentEmail?.toLowerCase() !== agent.email?.toLowerCase()) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (rev.status !== "pending") {
      return Response.json({ error: "Only pending requests can be cancelled" }, { status: 400 });
    }

    await revRef.update({ status: "cancelled", cancelledAt: new Date() });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Revision cancel error:", err);
    return Response.json({ error: "Failed to cancel revision" }, { status: 500 });
  }
}
