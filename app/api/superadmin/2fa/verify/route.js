import crypto from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { getSuperAdminCtx } from "@/lib/superadmin";

export const dynamic = "force-dynamic";

// How long a successful verification stays valid before re-prompting.
const SESSION_HOURS = 12;
const MAX_ATTEMPTS  = 5;

const hashCode = (code, uid) =>
  crypto.createHash("sha256").update(`${code}:${uid}:${process.env.CRON_SECRET || "kyoria"}`).digest("hex");

export async function POST(req) {
  const ctx = await getSuperAdminCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await req.json().catch(() => ({}));
  if (!code || !/^\d{6}$/.test(String(code))) {
    return Response.json({ error: "Enter the 6-digit code." }, { status: 400 });
  }

  const ref  = adminDb.collection("superadminMfa").doc(ctx.uid);
  const snap = await ref.get();
  const d = snap.data();
  if (!d?.codeHash) return Response.json({ error: "Request a new code." }, { status: 400 });
  if (new Date(d.expiresAt).getTime() < Date.now()) {
    return Response.json({ error: "Code expired. Request a new one." }, { status: 400 });
  }
  if ((d.attempts || 0) >= MAX_ATTEMPTS) {
    return Response.json({ error: "Too many attempts. Request a new code." }, { status: 429 });
  }

  if (hashCode(String(code), ctx.uid) !== d.codeHash) {
    await ref.set({ attempts: (d.attempts || 0) + 1 }, { merge: true });
    return Response.json({ error: "Incorrect code." }, { status: 400 });
  }

  // Success — start a verified session and clear the one-time code.
  await ref.set({
    codeHash:      null,
    attempts:      0,
    verifiedUntil: new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString(),
    verifiedAt:    new Date().toISOString(),
  }, { merge: true });

  return Response.json({ ok: true, verifiedHours: SESSION_HOURS });
}
