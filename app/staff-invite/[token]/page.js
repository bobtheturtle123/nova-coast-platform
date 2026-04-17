import { adminDb } from "@/lib/firebase-admin";
import StaffInviteClient from "./StaffInviteClient";

export default async function StaffInvitePage({ params }) {
  const { token } = params;

  let invite   = null;
  let tenantId = null;
  let tenant   = {};

  try {
    const snap = await adminDb.collectionGroup("staffInvites").get();
    for (const doc of snap.docs) {
      if (doc.id === token) {
        invite   = { id: doc.id, ...doc.data() };
        tenantId = doc.ref.parent.parent.id;
        break;
      }
    }
  } catch { /* Firestore error */ }

  if (!invite || !tenantId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <p className="text-4xl mb-4">🔗</p>
          <h1 className="text-xl font-bold text-charcoal mb-2">Invite not found</h1>
          <p className="text-gray-500 text-sm">This invite link may have expired or already been used.</p>
        </div>
      </div>
    );
  }

  if (invite.accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <p className="text-4xl mb-4">✅</p>
          <h1 className="text-xl font-bold text-charcoal mb-2">Already accepted</h1>
          <p className="text-gray-500 text-sm">This invite has already been used. You can log in at your dashboard.</p>
        </div>
      </div>
    );
  }

  const expiresAt = invite.expiresAt?.toDate?.() || new Date(invite.expiresAt);
  if (expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <p className="text-4xl mb-4">⏰</p>
          <h1 className="text-xl font-bold text-charcoal mb-2">Invite expired</h1>
          <p className="text-gray-500 text-sm">Ask your admin to send a new invite.</p>
        </div>
      </div>
    );
  }

  const tenantDoc = await adminDb.collection("tenants").doc(tenantId).get();
  tenant = tenantDoc.exists ? tenantDoc.data() : {};

  return (
    <StaffInviteClient
      token={token}
      tenantId={tenantId}
      companyName={tenant.businessName || "Your Company"}
      inviteEmail={invite.email}
      role={invite.role || "manager"}
    />
  );
}
