// Shared Google Calendar fetch helper used by the OAuth callback (first sync)
// and the manual/cron sync route.
//
// Fetches busy intervals WITH event titles via the Events API. Skips events the
// member marked "free" (transparent) or declined. Falls back to freeBusy (no
// titles) when the granted scope is only calendar.freebusy — this keeps members
// who connected under the old scope working until they reconnect.
//
// Returns { items: [{ start, end, allDay, title }], error? }
export async function fetchBusyIntervals(accessToken, calendarId, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin, timeMax,
    singleEvents: "true",
    orderBy:      "startTime",
    maxResults:   "2500",
    fields:       "items(summary,start,end,transparency,status,attendees(self,responseStatus))",
  });
  const evRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (evRes.ok) {
    const data  = await evRes.json();
    const items = [];
    for (const ev of data.items || []) {
      if (ev.status === "cancelled") continue;
      if (ev.transparency === "transparent") continue; // marked "free"
      const selfDeclined = (ev.attendees || []).some((a) => a.self && a.responseStatus === "declined");
      if (selfDeclined) continue;
      const allDay = !!ev.start?.date;
      const start  = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T00:00:00Z` : null);
      const end    = ev.end?.dateTime   || (ev.end?.date   ? `${ev.end.date}T00:00:00Z`   : null);
      if (!start || !end) continue;
      items.push({ start, end, allDay, title: ev.summary || "Busy" });
    }
    return { items };
  }

  // 403 = insufficient scope (old freebusy-only connection). Fall back.
  if (evRes.status === 403) {
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

  const err = await evRes.json().catch(() => ({}));
  return { items: [], error: err.error?.message || "Failed to fetch Google Calendar" };
}
