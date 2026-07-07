// Builds an iCalendar (.ics) invite for a booking's shoot. Attaching this to
// emails lets the client's calendar app (Google/Apple/Outlook) ADD the event
// and — because the UID is stable and SEQUENCE increments — UPDATE it in place
// when the shoot is rescheduled.

function pad(n) { return String(n).padStart(2, "0"); }

function fmtLocal(dateStr, timeStr) {
  // Floating local time (no Z) so it shows at the shoot's wall-clock time.
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  const tm = /^(\d{1,2}):(\d{2})/.exec(timeStr || "");
  const hh = tm ? Number(tm[1]) : 10;
  const mm = tm ? Number(tm[2]) : 0;
  return `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
}
function fmtDate(dateStr) {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  return `${y}${pad(m)}${pad(d)}`;
}
function fmtUtcStamp(dt = new Date()) {
  return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`;
}
function esc(s = "") {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function addMinutes(dateStr, timeStr, minutes) {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  const tm = /^(\d{1,2}):(\d{2})/.exec(timeStr || "");
  const base = new Date(y, (m || 1) - 1, d || 1, tm ? Number(tm[1]) : 10, tm ? Number(tm[2]) : 0);
  const end = new Date(base.getTime() + (minutes || 60) * 60000);
  return `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`;
}

// { uid, sequence, method } — method "REQUEST" (invite/update) or "CANCEL".
export function buildBookingIcs({ booking, tenant, shootDate, shootTime, uid, sequence = 0, method = "REQUEST" }) {
  const timed   = /^\d{1,2}:\d{2}/.test(shootTime || "");
  const address = booking.fullAddress || booking.address || "Property";
  const biz     = tenant?.branding?.businessName || tenant?.businessName || "Photography";
  const summary = `Photo shoot — ${address}`;
  const orgEmail = tenant?.email || "noreply@mail.kyoriaos.com";
  const durMin   = Number(booking.shootDuration) || 60;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KyoriaOS//Booking//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${fmtUtcStamp()}`,
    timed ? `DTSTART:${fmtLocal(shootDate, shootTime)}` : `DTSTART;VALUE=DATE:${fmtDate(shootDate)}`,
    timed ? `DTEND:${addMinutes(shootDate, shootTime, durMin)}` : `DTEND;VALUE=DATE:${fmtDate(shootDate)}`,
    `SUMMARY:${esc(summary)}`,
    `LOCATION:${esc(address)}`,
    `DESCRIPTION:${esc(`${biz} photo shoot at ${address}.`)}`,
    `ORGANIZER;CN=${esc(biz)}:mailto:${orgEmail}`,
    booking.clientEmail ? `ATTENDEE;CN=${esc(booking.clientName || booking.clientEmail)};RSVP=TRUE:mailto:${booking.clientEmail}` : null,
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}
