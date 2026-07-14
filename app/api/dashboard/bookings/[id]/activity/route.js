import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, uid: decoded.uid };
  } catch { return null; }
}

function tsMs(v) {
  if (!v) return 0;
  if (v.toMillis) return v.toMillis();
  if (v._seconds) return v._seconds * 1000;
  const t = new Date(v).getTime();
  return isNaN(t) ? 0 : t;
}

// GET — merged activity, newest first: status changes, manual notes, everything
// SENT from the platform (invoices/reminders/links/deliveries — with the actual
// message + any generated link), and the gallery's view/download/payment events.
export async function GET(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const bookingRef = adminDb.collection("tenants").doc(ctx.tenantId).collection("bookings").doc(params.id);
  const doc = await bookingRef.get();
  if (!doc.exists) return Response.json({ error: "Not found" }, { status: 404 });
  const data = doc.data();

  const all = [];

  for (const h of data.statusHistory || []) {
    all.push({ type: "status", status: h.status, changedAt: h.changedAt, changedBy: h.changedBy, note: h.note || null, _ms: tsMs(h.changedAt) });
  }
  for (const n of data.bookingNotes || []) {
    all.push({ type: "note", note: n.text, changedAt: n.createdAt, changedBy: n.createdBy, authorName: n.authorName || null, _ms: tsMs(n.createdAt) });
  }

  // Platform-sent notifications + logged payments (booking activityLog).
  let loggedDeposit = false, loggedBalance = false, loggedFull = false;
  try {
    const snap = await bookingRef.collection("activityLog").get();
    snap.forEach((d) => {
      const x = d.data();
      if (x.paymentType === "deposit") loggedDeposit = true;
      if (x.paymentType === "balance") loggedBalance = true;
      if (x.paymentType === "full")    loggedFull = true;
      all.push({ id: d.id, type: x.type || "sent", paymentType: x.paymentType || null, title: x.title || null, message: x.message || null, recipient: x.recipient || null, link: x.link || null, channel: x.channel || null, changedAt: x.timestamp, _ms: tsMs(x.timestamp) });
    });
  } catch {}

  // Backfill: payments collected BEFORE activity logging existed have no entry.
  // Synthesize from the booking's stored payment state so the deposit/balance
  // still shows (amount + best-available date). Skipped if already logged.
  const money = (n) => `$${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const paidAtMs = tsMs(data.updatedAt) || tsMs(data.createdAt) || 0;
  const who = data.clientName || data.clientEmail || "The client";
  if (data.paidInFull && !loggedFull && !loggedBalance && !loggedDeposit) {
    const amt = Number(data.totalPrice) || Number(data.depositAmount) || 0;
    all.push({ id: "synth_full", type: "payment", paymentType: "full", title: `A full payment of ${money(amt)} was received from ${who}.`, message: `Recorded from the booking's payment status (exact time unavailable).`, changedAt: data.createdAt, _ms: paidAtMs, synthesized: true });
  } else {
    if (data.depositPaid && !loggedDeposit) {
      const amt = Number(data.depositAmount) || 0;
      all.push({ id: "synth_deposit", type: "payment", paymentType: "deposit", title: `${who} paid a ${money(amt)} booking deposit.`, message: `Recorded from the booking's payment status (exact time unavailable).`, changedAt: data.createdAt, _ms: tsMs(data.createdAt) || paidAtMs, synthesized: true });
    }
    if ((data.balancePaid || data.paidInFull) && !loggedBalance) {
      const amt = Number(data.balancePaidAmount) || Math.max(0, (Number(data.totalPrice) || 0) - (Number(data.depositAmount) || 0));
      all.push({ id: "synth_balance", type: "payment", paymentType: "balance", title: `${who} paid the remaining balance of ${money(amt)}.`, message: `Recorded from the booking's payment status (exact time unavailable).`, changedAt: data.updatedAt, _ms: paidAtMs, synthesized: true });
    }
  }

  // Gallery events (view / download / delivered / payment).
  if (data.galleryId) {
    try {
      const gsnap = await adminDb.collection("tenants").doc(ctx.tenantId)
        .collection("galleries").doc(data.galleryId).collection("activityLog").get();
      gsnap.forEach((d) => {
        const x = d.data();
        // Payments are logged canonically on the booking (idempotent, with fee
        // breakdown) — skip the gallery's legacy payment rows to avoid dupes.
        if (x.event === "payment") return;
        all.push({ id: `g_${d.id}`, type: x.event || "gallery", title: null, message: x.note || null, recipient: x.viewerEmail || null, changedAt: x.timestamp, format: x.format || null, fileName: x.fileName || null, viewerName: x.viewerName || null, _ms: tsMs(x.timestamp) });
      });
    } catch {}
  }

  all.sort((a, b) => (b._ms || 0) - (a._ms || 0));
  return Response.json({ activity: all.map(({ _ms, ...rest }) => rest) });
}

// POST — append a manual note to bookingNotes
export async function POST(req, { params }) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { text, authorName } = await req.json();
  if (!text?.trim()) return Response.json({ error: "Note text required" }, { status: 400 });

  const note = {
    text: text.trim(),
    createdAt: new Date().toISOString(),
    createdBy: ctx.uid,
    authorName: authorName || null,
  };

  await adminDb
    .collection("tenants").doc(ctx.tenantId)
    .collection("bookings").doc(params.id)
    .update({ bookingNotes: FieldValue.arrayUnion(note) });

  return Response.json({ ok: true, note });
}
