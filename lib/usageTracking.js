import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// Increment a monthly platform-wide usage counter in Firestore.
// Fire-and-forget — never blocks the request path, never throws.
export function trackPlatformUsage(field, value = 1) {
  const now      = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  adminDb.collection("_platformStats").doc(monthKey)
    .set({ [field]: FieldValue.increment(value), updatedAt: now }, { merge: true })
    .catch(() => {});
}
