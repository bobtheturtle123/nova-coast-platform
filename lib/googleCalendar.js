// Shared Google Calendar fetch helper used by the OAuth callback (first sync)
// and the manual/cron sync route.
//
// Uses the freeBusy API (non-sensitive scope, no "unverified app" warning).
// It returns only busy intervals — no event titles — which is all we surface:
// blocks are labelled "Busy" under the member's name.
//
// Returns { items: [{ start, end, allDay, title }], error? }
// (title is always null here; kept in the shape for callers that store it.)
export async function fetchBusyIntervals(accessToken, calendarId, timeMin, timeMax) {
  const fbRes = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
  });
  if (!fbRes.ok) {
    const err = await fbRes.json().catch(() => ({}));
    return { items: [], error: err.error?.message || "Failed to fetch Google Calendar" };
  }
  const fbData = await fbRes.json();
  const busy   = fbData.calendars?.[calendarId]?.busy || fbData.calendars?.primary?.busy || [];
  return { items: busy.map((b) => ({ start: b.start, end: b.end, title: null })) };
}
