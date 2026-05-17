import { adminDb, adminAuth } from "@/lib/firebase-admin";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId };
  } catch { return null; }
}

// GET — fetch notification prefs
export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await adminDb.collection("tenants").doc(ctx.tenantId).get();
  const prefs = doc.exists ? (doc.data().notificationPrefs || {}) : {};
  return Response.json({ prefs });
}

const BOOL_KEYS = [
  "newBookingEmail", "newBookingPhone", "confirmedEmail", "confirmedPhone",
  "reminderEmail", "reminderPhone", "balancePaidEmail", "balancePaidPhone",
  "clientNewBookingEmail", "clientConfirmedEmail", "clientReminderEmail",
];

function sanitizePrefs(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const key of BOOL_KEYS) {
    if (key in raw) out[key] = !!raw[key];
  }
  // Allow nested shootReminder object
  if (raw.shootReminder && typeof raw.shootReminder === "object") {
    out.shootReminder = {
      client:           !!raw.shootReminder.client,
      photographer:     !!raw.shootReminder.photographer,
      hoursBeforeShoot: Number(raw.shootReminder.hoursBeforeShoot) || 24,
    };
  }
  return out;
}

// PATCH — save notification prefs
export async function PATCH(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const prefs = sanitizePrefs(body.prefs);

  await adminDb.collection("tenants").doc(ctx.tenantId).update({
    notificationPrefs: prefs,
    updatedAt: new Date(),
  });
  return Response.json({ ok: true });
}
