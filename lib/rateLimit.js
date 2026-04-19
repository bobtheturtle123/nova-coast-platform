/**
 * Lightweight Firestore-based rate limiter.
 * No Redis or external services required.
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
  try {
    const ref = adminDb.collection("rateLimits").doc(docKey);
    const doc = await ref.get();

    if (!doc.exists) {
      await ref.set({ count: 1, windowEnd: now + windowSec * 1000 }, { merge: false });
      return { limited: false, remaining: limit - 1 };
    }

    const { count, windowEnd } = doc.data();

    if (now > windowEnd) {
      await ref.set({ count: 1, windowEnd: now + windowSec * 1000 });
      return { limited: false, remaining: limit - 1 };
    }

    if (count >= limit) {
      return { limited: true, remaining: 0 };
    }

    ref.update({ count: count + 1 }).catch(() => {});
    return { limited: false, remaining: limit - count - 1 };
  } catch {
    // Fail open — never block real users on Firestore errors
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
