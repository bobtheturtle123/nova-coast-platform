/**
 * Firestore-backed rate limiter with transaction-safe counter increments.
 * Transactions prevent the race condition where concurrent requests all read
 * count < limit before any of them write the increment.
 *
 * Usage:
 *   const { limited } = await rateLimit(req, "bookings-create", 5, 3600);
 *   if (limited) return Response.json({ error: "Too many requests" }, { status: 429 });
 *
 *   const { limited } = await rateLimitTenant(tenantId, "ai-chat", 20, 3600);
 */

import { adminDb } from "@/lib/firebase-admin";

async function _applyLimit(docKey, limit, windowSec) {
  const now = Date.now();
  const ref = adminDb.collection("rateLimits").doc(docKey);

  try {
    let limited = false;
    let remaining = 0;

    await adminDb.runTransaction(async (tx) => {
      const doc = await tx.get(ref);

      if (!doc.exists || now > doc.data().windowEnd) {
        // New window — first request is always allowed
        tx.set(ref, { count: 1, windowEnd: now + windowSec * 1000 });
        remaining = limit - 1;
        return;
      }

      const { count } = doc.data();
      if (count >= limit) {
        limited = true;
        remaining = 0;
        return;
      }

      tx.update(ref, { count: count + 1 });
      remaining = limit - count - 1;
    });

    return { limited, remaining };
  } catch (err) {
    // Fail open — never block real users on Firestore errors
    console.warn("[rateLimit] Firestore error — failing open for key:", docKey, err?.message || err);
    return { limited: false, remaining: limit };
  }
}

/**
 * IP-based rate limit — for public/unauthenticated endpoints.
 */
export async function rateLimit(req, key, limit, windowSec = 3600) {
  const ip = getIp(req);
  return _applyLimit(`${key}:${ip}`, limit, windowSec);
}

/**
 * Tenant-based rate limit — for authenticated dashboard endpoints.
 * Keyed by tenantId so one tenant can't burn API quotas regardless of IP rotation.
 */
export async function rateLimitTenant(tenantId, key, limit, windowSec = 3600) {
  return _applyLimit(`${key}:t:${tenantId}`, limit, windowSec);
}

function getIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Strip HTML tags from a string to prevent stored XSS */
export function stripTags(str) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim();
}
