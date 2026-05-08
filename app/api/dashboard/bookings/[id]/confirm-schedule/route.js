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
    finalTime = booking.preferredTime || booking.shootTime;
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

  return Response.json({ ok: true, shootDate: finalDate, shootTime: finalTime });
}
