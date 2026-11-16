/**
 * Helpers for a booking's agent/client contacts.
 *
 * A booking has ONE primary client (clientName / clientEmail / clientPhone) plus
 * an optional list of ADDITIONAL agents on the same order (additionalClients).
 * Additional agents get the same "co-client" treatment as the primary: booking
 * confirmation + update emails and their own agent-portal / gallery access.
 *
 * `clientEmails` is a denormalized, lowercased, de-duped array of every agent
 * email on the order (primary first). It exists so the agent portal can find a
 * booking with a single `array-contains` query regardless of which agent signs
 * in. Legacy bookings created before this field are still matched by the
 * portal's existing clientEmail query, so nothing needs backfilling.
 */

// Keep only valid additional-agent rows: must have an email, trimmed/normalized.
export function sanitizeAdditionalClients(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const a of list) {
    const email = String(a?.email || "").toLowerCase().trim();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    out.push({
      name:  String(a?.name  || "").trim(),
      email,
      phone: String(a?.phone || "").trim(),
    });
  }
  return out;
}

// True when `agentEmail` is an agent on this booking — the primary client OR
// any additional agent. Checks the denormalized clientEmails array when present
// and falls back to the primary clientEmail + additionalClients for legacy docs.
export function bookingBelongsToAgent(booking, agentEmail) {
  const target = String(agentEmail || "").toLowerCase().trim();
  if (!target) return false;
  if (Array.isArray(booking?.clientEmails) && booking.clientEmails.length) {
    if (booking.clientEmails.map((e) => String(e).toLowerCase()).includes(target)) return true;
  }
  if (String(booking?.clientEmail || "").toLowerCase().trim() === target) return true;
  return sanitizeAdditionalClients(booking?.additionalClients).some((a) => a.email === target);
}

// All agent emails on the order (primary + additional), lowercased & de-duped.
export function buildClientEmails(primaryEmail, additionalClients) {
  const emails = [];
  const seen = new Set();
  const push = (e) => {
    const v = String(e || "").toLowerCase().trim();
    if (v && !seen.has(v)) { seen.add(v); emails.push(v); }
  };
  push(primaryEmail);
  for (const a of sanitizeAdditionalClients(additionalClients)) push(a.email);
  return emails;
}
