// Pure pricing calculations — safe to import in both client and server components.
// No firebase-admin dependency.

export function calculateTenantPrice(packageId, serviceIds, addonIds, travelFee = 0, catalog) {
  const { packages = [], services = [], addons = [] } = catalog;

  let base = 0;
  if (packageId) {
    const pkg = packages.find((p) => p.id === packageId);
    base = pkg ? pkg.price : 0;
  } else {
    base = serviceIds.reduce((sum, id) => {
      const svc = services.find((s) => s.id === id);
      return sum + (svc ? svc.price : 0);
    }, 0);
  }

  const addonTotal = addonIds.reduce((sum, id) => {
    const addon = addons.find((a) => a.id === id);
    return sum + (addon ? addon.price : 0);
  }, 0);

  const subtotal = base + addonTotal + travelFee;
  const deposit  = Math.round(subtotal * 0.5 * 100) / 100;
  const balance  = subtotal - deposit;

  return { base, addonTotal, travelFee, subtotal, deposit, balance };
}

export function formatPrice(dollars) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}
