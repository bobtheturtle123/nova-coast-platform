// Resolve a booking's ordered package/service/add-on IDs into human names so a
// photographer can see at a glance what a shoot needs — used in calendar events
// and assignment/reschedule emails.
export function resolveBookingServiceNames(booking, catalog) {
  if (!booking || !catalog) return [];
  const names = [];
  const byId = (list, id) => (list || []).find((x) => x.id === id);

  const pkgIds = Array.isArray(booking.packageIds) && booking.packageIds.length
    ? booking.packageIds
    : (booking.packageId ? [booking.packageId] : []);
  for (const id of pkgIds) {
    const p = byId(catalog.packages, id);
    if (p?.name) names.push(p.name);
  }
  for (const id of (booking.serviceIds || [])) {
    const s = byId(catalog.services, id);
    if (s?.name) names.push(s.name);
  }
  for (const id of (booking.addonIds || [])) {
    const a = byId(catalog.addons, id);
    if (a?.name) names.push(a.name);
  }
  for (const id of (booking.retainerIds || [])) {
    const r = byId(catalog.retainers, id);
    if (r?.name) names.push(r.name);
  }
  // De-dupe while preserving order.
  return [...new Set(names)];
}
