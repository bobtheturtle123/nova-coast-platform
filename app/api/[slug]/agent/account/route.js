import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantBySlug } from "@/lib/tenants";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function cookieName(slug) { return `agt_${slug}`; }

// DELETE — deactivate agent account
// Body: { confirmation: "DELETE" }
export async function DELETE(req, { params }) {
  const cookieStore = cookies();
  const token       = cookieStore.get(cookieName(params.slug))?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { confirmation } = await req.json().catch(() => ({}));
  if (confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
  }

  const tenant = await getTenantBySlug(params.slug);
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const snap = await adminDb
    .collection("tenants").doc(tenant.id)
    .collection("agents")
    .where("accessToken", "==", token)
    .limit(1)
    .get();

  if (snap.empty) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const agentDoc  = snap.docs[0];
  const agentData = agentDoc.data();

  // Deactivate: clear access token + mark deactivated (booking data preserved)
  await agentDoc.ref.update({
    accessToken:  null,
    deactivated:  true,
    deactivatedAt: new Date(),
  });

  // Delete Firebase Auth user if one exists for this email
  if (agentData.email) {
    try {
      const firebaseUser = await adminAuth.getUserByEmail(agentData.email);
      await adminAuth.deleteUser(firebaseUser.uid);
    } catch {
      // User may not have a Firebase Auth account (legacy token-only agent) — ignore
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(cookieName(params.slug));
  return res;
}
