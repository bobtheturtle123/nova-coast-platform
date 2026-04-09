// Pure pricing calculations — safe to import in both client and server components.
// No firebase-admin dependency.

export const SQFT_TIERS = [
  { name: "Tiny",   label: "Studio / Under 800 sqft",  max: 800 },
  { name: "Small",  label: "801 – 2,500 sqft",         max: 2500 },
  { name: "Medium", label: "2,501 – 4,000 sqft",       max: 4000 },
  { name: "Large",  label: "4,001 – 6,000 sqft",       max: 6000 },
  { name: "XL",     label: "6,001 – 8,500 sqft",       max: 8500 },
  { name: "XXL",    label: "8,500+ sqft",               max: Infinity },
];

export function getSqftTier(sqft) {
  const sf = parseInt(sqft, 10);
  if (!sf || sf <= 0) return null;
  for (const tier of SQFT_TIERS) {
    if (sf <= tier.max) return tier.name;
  }
  return "XXL";
}

// Get the price for an item, respecting priceTiers if present.
export function getItemPrice(item, tier) {
  if (item.priceTiers && tier && item.priceTiers[tier] !== undefined) {
    return item.priceTiers[tier];
  }
  return item.price ?? 0;
}

// Returns the "from" (lowest tier) price for display when no sqft is entered.
export function getFromPrice(item) {
  if (item.priceTiers) {
    return Math.min(...Object.values(item.priceTiers));
  }
  return item.price ?? 0;
}

export function calculateTenantPrice(packageId, serviceIds, addonIds, travelFee = 0, catalog, squareFootage = 0) {
  const { packages = [], services = [], addons = [] } = catalog;
  const tier = getSqftTier(squareFootage);

  let base = 0;
  if (packageId) {
    const pkg = packages.find((p) => p.id === packageId);
    base = pkg ? getItemPrice(pkg, tier) : 0;
  } else {
    base = serviceIds.reduce((sum, id) => {
      const svc = services.find((s) => s.id === id);
      return sum + (svc ? getItemPrice(svc, tier) : 0);
    }, 0);
  }

  const addonTotal = addonIds.reduce((sum, id) => {
    const addon = addons.find((a) => a.id === id);
    return sum + (addon ? getItemPrice(addon, tier) : 0);
  }, 0);

  const subtotal = base + addonTotal + travelFee;
  const deposit  = Math.round(subtotal * 0.5 * 100) / 100;
  const balance  = subtotal - deposit;

  return { base, addonTotal, travelFee, subtotal, deposit, balance, tier };
}

export function formatPrice(dollars) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}
