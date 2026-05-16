import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { getTenantById } from "@/lib/tenants";
import { sendScheduleConfirmed, sendScheduleProposed } from "@/lib/email";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, uid: decoded.uid };
  } catch { return null; }
}

// POST { action: "confirm" } — confirms the agent's requested date/time
// POST { action: "propose", shootDate: "YYYY-MM-DD", shootTime: "HH:MM" } — sets a different time
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, shootDate: proposedDate, shootTime: proposedTime } = body;

  if (!["confirm", "propose"].includes(action)) {
    return Response.json({ error: "action must be confirm or propose" }, { status: 400 });
  }

  const bookingRef = adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id);
  const doc = await bookingRef.get();
  if (!doc.exists) return Response.json({ error: "Not found" }, { status: 404 });

  const booking = doc.data();
  const tenant  = await getTenantById(ctx.tenantId);

  let finalDate, finalTime;

  if (action === "confirm") {
    finalDate = booking.preferredDate || booking.shootDate;
    // Only use preferredTime if it is a specific HH:MM value — not "morning" / "afternoon" presets
    const rawPreferred = booking.preferredTimeSpecific || booking.preferredTime || booking.shootTime || "";
    finalTime = /^\d{1,2}:\d{2}$/.test(rawPreferred) ? rawPreferred : (booking.shootTime || null);
  } else {
    if (!proposedDate || !proposedTime) {
      return Response.json({ error: "shootDate and shootTime required for propose" }, { status: 400 });
    }
    finalDate = proposedDate;
    finalTime = proposedTime;
  }

  await bookingRef.update({
    shootDate:              finalDate,
    shootTime:              finalTime,
    scheduleApprovalStatus: "confirmed",
    scheduleConfirmedAt:    new Date(),
    scheduleConfirmedBy:    ctx.uid,
  });

  // Send email notification to client
  try {
    if (action === "confirm") {
      await sendScheduleConfirmed({ booking: { ...booking, ...doc.data() }, tenant, shootDate: finalDate, shootTime: finalTime });
    } else {
      await sendScheduleProposed({ booking: { ...booking, ...doc.data() }, tenant, newDate: finalDate, newTime: finalTime });
    }
  } catch (e) {
    console.error("[confirm-schedule] email failed:", e.message);
  }

  // Push to photographer's Google Calendar if connected (fire-and-forget)
  if (action === "confirm" && booking.photographerId && finalDate) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.kyoriaos.com";
      const token  = req.headers.get("Authorization")?.replace("Bearer ", "");
      fetch(`${appUrl}/api/dashboard/bookings/${params.id}/push-gcal`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({}),
      }).catch((e) => console.error("[confirm-schedule] gcal push failed:", e.message));
    } catch {}
  }

  return Response.json({ ok: true, shootDate: finalDate, shootTime: finalTime });
}
