import { adminDb } from "@/lib/firebase-admin";
import JoinClient from "./JoinClient";

export default async function JoinPage({ params }) {
  const { token } = params;
  if (!token || token.length < 30) {
    return <InviteError message="This invite link is invalid." />;
  }

  // Direct document lookup — no collectionGroup, no cross-tenant traversal
  let invite = null;
  let tenantId = null;
  try {
    const doc = await adminDb.collection("photographerInvites").doc(token).get();
    if (doc.exists) {
      invite   = { id: doc.id, ...doc.data() };
      tenantId = invite.tenantId;
    }
  } catch { /* Firestore error */ }

  if (!invite || !tenantId) return <InviteError message="This invite link may have expired or already been used." />;
  if (invite.accepted)      return <InviteError icon="✅" title="Already accepted" message="This invite has already been used." />;

  const expiresAt = invite.expiresAt?.toDate?.() || new Date(invite.expiresAt);
  if (expiresAt < new Date()) return <InviteError icon="⏰" title="Invite expired" message="Ask your company to send a new invite." />;

  const tenantDoc  = await adminDb.collection("tenants").doc(tenantId).get();
  const tenant     = tenantDoc.exists ? tenantDoc.data() : {};

  return (
    <JoinClient
      token={token}
      tenantId={tenantId}
      companyName={tenant.businessName || "Your Company"}
      inviteEmail={invite.email}
    />
  );
}

function InviteError({ icon = "🔗", title = "Invite not found", message }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
        <p className="text-4xl mb-4">{icon}</p>
        <h1 className="text-xl font-bold text-[#0F172A] mb-2">{title}</h1>
        <p className="text-gray-500 text-sm">{message}</p>
      </div>
    </div>
  );
}
