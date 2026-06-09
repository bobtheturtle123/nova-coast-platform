import { adminDb, adminAuth } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// Per-member earnings / payroll report. Sums each team member's pay across the
// shoots assigned to them in a date range, using their per-service rates when
// configured, otherwise their flat pay rate. Read-only: this does not move money
// or compute taxes — it's a number to pay against / hand to a bookkeeper.

async function getCtx(req) {
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(auth);
    if (!decoded.tenantId) return null;
    return { tenantId: decoded.tenantId, role: decoded.role || "owner", memberId: decoded.memberId || null };
  } catch { return null; }
}

// Can this caller see earnings? Owner/admin always; otherwise the member needs
// the reports or revenue permission.
async function canViewEarnings(ctx) {
  if (ctx.role === "owner" || ctx.role === "admin") return true;
  if (!ctx.memberId) return false;
  const snap = await adminDb.collection("tenants").doc(ctx.tenantId).collection("team").doc(ctx.memberId).get();
  const p = snap.data()?.permissions || {};
  return !!(p.canViewReports || p.canViewRevenue);
}

// Resolve a member's pay for one booking.
function payForBooking(member, booking) {
  const rates = member.serviceRates || {};
  const ids = [...(booking.serviceIds || []), ...(booking.addonIds || [])];
  if (booking.packageId) ids.push(booking.packageId);

  let sum = 0, matched = false;
  for (const id of ids) {
    const r = rates[id];
    if (r == null) continue;
    if (typeof r === "number") { sum += r; matched = true; }
    else if (typeof r === "object") { // { type: rate } shape — sum numeric values
      for (const v of Object.values(r)) if (typeof v === "number") { sum += v; matched = true; }
    }
  }
  // Fall back to the flat per-shoot pay rate when no per-service rate applies.
  if (!matched) return Number(member.payRate) || 0;
  return sum;
}

function shootDateMs(b) {
  const raw = b.shootDate || b.preferredDate || b.createdAt;
  if (!raw) return null;
  if (raw?.toMillis) return raw.toMillis();
  // preferredDate is a yyyy-mm-dd string; anchor at noon to avoid tz drift.
  const s = typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw;
  const ms = new Date(s).getTime();
  return Number.isFinite(ms) ? ms : null;
}

// Collect every assigned member id for a booking (lead + additional).
function assignedMemberIds(b) {
  const ids = [];
  if (b.photographerId) ids.push(b.photographerId);
  for (const a of (b.additionalPhotographers || [])) {
    if (typeof a === "string") ids.push(a);
    else if (a?.id) ids.push(a.id);
  }
  return [...new Set(ids)];
}

export async function GET(req) {
  const ctx = await getCtx(req);
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!await canViewEarnings(ctx)) return Response.json({ error: "Insufficient permissions" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "json";
  // Default range: current month-to-date.
  const now = new Date();
  const fromMs = searchParams.get("from")
    ? new Date(`${searchParams.get("from")}T00:00:00`).getTime()
    : new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const toMs = searchParams.get("to")
    ? new Date(`${searchParams.get("to")}T23:59:59`).getTime()
    : now.getTime();

  const tenantRef = adminDb.collection("tenants").doc(ctx.tenantId);
  const [teamSnap, bookingsSnap] = await Promise.all([
    tenantRef.collection("team").get(),
    tenantRef.collection("bookings").get(),
  ]);

  const members = {};
  for (const d of teamSnap.docs) {
    const m = d.data();
    members[d.id] = {
      id: d.id, name: m.name || m.email || d.id, role: m.role || "photographer",
      customRoleTitle: m.customRoleTitle || "", payRate: m.payRate, serviceRates: m.serviceRates,
      shoots: 0, earnings: 0, lineItems: [],
    };
  }

  let totalEarnings = 0, totalShoots = 0;
  for (const d of bookingsSnap.docs) {
    const b = d.data();
    if (b.status === "cancelled") continue;
    const ms = shootDateMs(b);
    if (ms == null || ms < fromMs || ms > toMs) continue;

    const ids = assignedMemberIds(b);
    for (const id of ids) {
      const member = members[id];
      if (!member) continue; // assigned to a removed member — skip
      const pay = payForBooking(member, b);
      member.shoots += 1;
      member.earnings += pay;
      member.lineItems.push({
        bookingId: d.id,
        date: ms ? new Date(ms).toISOString().slice(0, 10) : "",
        address: b.fullAddress || b.address || "",
        amount: +pay.toFixed(2),
      });
      totalEarnings += pay;
      totalShoots += 1;
    }
  }

  const rows = Object.values(members)
    .filter((m) => m.shoots > 0)
    .map((m) => ({
      memberId: m.id, name: m.name, role: m.role, customRoleTitle: m.customRoleTitle,
      shoots: m.shoots, earnings: +m.earnings.toFixed(2), lineItems: m.lineItems,
    }))
    .sort((a, b) => b.earnings - a.earnings);

  const range = {
    from: new Date(fromMs).toISOString().slice(0, 10),
    to:   new Date(toMs).toISOString().slice(0, 10),
  };

  if (format === "csv") {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Member", "Role", "Shoots", "Earnings (USD)"].join(",")];
    for (const r of rows) lines.push([esc(r.name), esc(r.customRoleTitle || r.role), r.shoots, r.earnings].join(","));
    lines.push(["", "Total", totalShoots, +totalEarnings.toFixed(2)].join(","));
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="earnings-${range.from}_to_${range.to}.csv"`,
      },
    });
  }

  return Response.json({
    range,
    totals: { shoots: totalShoots, earnings: +totalEarnings.toFixed(2) },
    members: rows,
    note: "Earnings use per-service rates when set, otherwise the member's flat pay rate. Excludes cancelled bookings.",
  });
}
