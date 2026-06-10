// In-app notifications. Writes to tenants/{tenantId}/notifications, surfaced by
// the bell in the dashboard. Best-effort: never throws into the caller.

import { adminDb } from "@/lib/firebase-admin";

export async function notifyTenant(tenantId, { type = "info", title, body = "", link = null } = {}) {
  if (!tenantId || !title) return;
  try {
    await adminDb.collection("tenants").doc(tenantId).collection("notifications").add({
      type,           // "referral" | "billing" | "info" | ...
      title,
      body,
      link,           // optional in-app path, e.g. "/dashboard/billing"
      read: false,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error("[notify] failed:", e?.message);
  }
}
