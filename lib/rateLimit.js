/**
 * Lightweight Firestore-based rate limiter.
 * No Redis or external services required.
 *
 * Usage:
 *   const { limited, remaining } = await rateLimit(req, "bookings-create", 5, 3600);
 *   if (limited) return Response.json({ error: "Too many requests" }, { status: 429 });
 */

import { adminDb } from "@/lib/firebase-admin";

/**
 * @param {Request}  req       - Incoming Next.js request (used to extract IP)
 * @param {string}   key       - Unique key for this endpoint (e.g. "bookings-create")
 * @param {number}   limit     - Max requests allowed in the window
 * @param {number}   windowSec - Window duration in seconds
 * @returns {{ limited: boolean, remaining: number }}
 */
export async function rateLimit(req, key, limit, windowSec = 3600) {
  const ip = getIp(req);
  const docKey = `${key}:${ip}`;
  const now = Date.now();

  try {
    const ref = adminDb.collection("rateLimits").doc(docKey);
    const doc = await ref.get();

    if (!doc.exists) {
      // First request from this IP for this key
      await ref.set({ count: 1, windowEnd: now + windowSec * 1000 }, { merge: false });
      return { limited: false, remaining: limit - 1 };
    }

    const { count, windowEnd } = doc.data();

    if (now > windowEnd) {
      // Window expired — reset
      await ref.set({ count: 1, windowEnd: now + windowSec * 1000 });
      return { limited: false, remaining: limit - 1 };
    }

    if (count >= limit) {
      return { limited: true, remaining: 0 };
    }

    // Increment (fire-and-forget to avoid blocking the response)
    ref.update({ count: count + 1 }).catch(() => {});
    return { limited: false, remaining: limit - count - 1 };
  } catch {
    // On Firestore error, fail open (don't block real users)
    return { limited: false, remaining: limit };
  }
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
