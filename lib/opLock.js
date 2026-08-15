/**
 * Per-tenant concurrency lock for heavy operations (imports, bulk writes,
 * outbound-API fan-out). This is the lightweight "queue for heavy resource
 * calls" — instead of running unbounded work in parallel, we serialize the
 * expensive ops so a single tenant can never have two running at once. Combined
 * with the client disabling its own buttons in-flight, this stops a
 * double-click (or a script hammering the endpoint) from spawning N concurrent
 * batch writes + N concurrent Aryeo fetches and taking the site down.
 *
 * It is deliberately Firestore-transaction based (no Redis / extra infra) so it
 * works on serverless the same way the existing rateLimit helper does. The lock
 * self-expires after ttlSec so a crashed request can never wedge a tenant out
 * of importing forever.
 *
 * Usage:
 *   const lock = await acquireLock(tenantId, "aryeo-import", 120);
 *   if (!lock.ok) return Response.json({ error: lock.error }, { status: 429 });
 *   try {  ...heavy work...  } finally { await lock.release(); }
 */

import { adminDb } from "@/lib/firebase-admin";

const BUSY_MESSAGE =
  "This import is already running. Please wait for it to finish before starting another.";

export async function acquireLock(tenantId, op, ttlSec = 120) {
  const now = Date.now();
  const ref = adminDb.collection("opLocks").doc(`${op}:t:${tenantId}`);

  try {
    let acquired = false;

    await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const held = doc.exists && Number(doc.data().expiresAt) > now;
      if (held) { acquired = false; return; }
      tx.set(ref, { op, tenantId, acquiredAt: now, expiresAt: now + ttlSec * 1000 });
      acquired = true;
    });

    if (!acquired) return { ok: false, error: BUSY_MESSAGE };

    return {
      ok: true,
      release: async () => {
        try { await ref.delete(); }
        catch (e) { console.warn("[opLock] release failed for", ref.id, e?.message || e); }
      },
    };
  } catch (err) {
    // Fail open — a Firestore hiccup must never block a legitimate import.
    // We still return a no-op release so callers can use it unconditionally.
    console.warn("[opLock] acquire error — failing open for", `${op}:t:${tenantId}`, err?.message || err);
    return { ok: true, release: async () => {} };
  }
}
