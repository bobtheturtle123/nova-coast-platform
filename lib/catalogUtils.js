// Pure pricing calculations — safe to import in both client and server components.
// No firebase-admin dependency.

// ─── Default tiers (used when tenant has no custom pricingConfig) ─────────────
export const SQFT_TIERS = [
  { name: "Tiny",   label: "Studio / Under 800 sqft",  max: 800 },
  { name: "Small",  label: "801 – 2,500 sqft",         max: 2500 },
  { name: "Medium", label: "2,501 – 4,000 sqft",       max: 4000 },
  { name: "Large",  label: "4,001 – 6,000 sqft",       max: 6000 },
  { name: "XL",     label: "6,001 – 8,500 sqft",       max: 8500 },
  { name: "XXL",    label: "8,500+ sqft",               max: Infinity },
];

// ─── Resolve active tiers from optional tenant pricingConfig ─────────────────
// pricingConfig: { mode: "sqft"|"photos"|"flat", tiers: [{ name, label, max }] }
export function getActiveTiers(pricingConfig) {
  if (pricingConfig?.tiers && pricingConfig.tiers.length > 0) {
    return pricingConfig.tiers;
  }
  return SQFT_TIERS;
}

export function getPricingMode(pricingConfig) {
  return pricingConfig?.mode || "sqft";
}

// Get the gate label: "Square Footage" or "Number of Photos" etc.
export function getPricingLabel(pricingConfig) {
  const mode = getPricingMode(pricingConfig);
  if (mode === "photos") return "Number of Photos";
  if (mode === "flat")   return null; // no gate needed
  return "Square Footage";
}

// ─── Tier resolution ──────────────────────────────────────────────────────────
export function getSqftTier(sqft, pricingConfig) {
  const tiers = getActiveTiers(pricingConfig);
  const val   = parseInt(sqft, 10);
  if (!val || val <= 0) return null;
  for (const tier of tiers) {
    if (val <= tier.max) return tier.name;
  }
  return tiers[tiers.length - 1]?.name || null;
}

// ─── Item price helpers ───────────────────────────────────────────────────────
export function getItemPrice(item, tier) {
  if (item.priceTiers && tier && item.priceTiers[tier] !== undefined) {
    return item.priceTiers[tier];
  }
  return item.price ?? 0;
}

export function getFromPrice(item, pricingConfig) {
  if (item.priceTiers) {
    const tiers  = getActiveTiers(pricingConfig);
    const values = tiers.map((t) => item.priceTiers[t.name]).filter((v) => v !== undefined && v > 0);
    if (values.length) return Math.min(...values);
    return Math.min(...Object.values(item.priceTiers).filter((v) => v > 0));
  }
  return item.price ?? 0;
}

// ─── Deposit calculation ──────────────────────────────────────────────────────
// depositConfig: { type: "percent" | "fixed" | "none", value: number }
export function calculateDeposit(subtotal, depositConfig) {
  if (!depositConfig || depositConfig.type === "percent") {
    const pct = depositConfig?.value ?? 50;
    return Math.round(subtotal * (pct / 100) * 100) / 100;
  }
  if (depositConfig.type === "fixed") {
    return Math.min(Number(depositConfig.value) || 0, subtotal);
  }
  if (depositConfig.type === "none") {
    return 0; // pay in full only, no deposit
  }
  return Math.round(subtotal * 0.5 * 100) / 100;
}

export function depositLabel(depositConfig) {
  if (!depositConfig || depositConfig.type === "percent") {
    return `${depositConfig?.value ?? 50}% deposit`;
  }
  if (depositConfig.type === "fixed") return `$${depositConfig.value} deposit`;
  if (depositConfig.type === "none") return "Pay in full";
  return "50% deposit";
}

// ─── Full price calculation ───────────────────────────────────────────────────
export function calculateTenantPrice(packageId, serviceIds, addonIds, travelFee = 0, catalog, squareFootage = 0) {
  const { packages = [], services = [], addons = [], pricingConfig, bookingConfig } = catalog;
  const tier = getSqftTier(squareFootage, pricingConfig);

  let base = 0;
  if (packageId) {
    const pkg = packages.find((p) => p.id === packageId);
    base = pkg ? getItemPrice(pkg, tier) : 0;
  } else {
    base = (serviceIds || []).reduce((sum, id) => {
      const svc = services.find((s) => s.id === id);
      return sum + (svc ? getItemPrice(svc, tier) : 0);
    }, 0);
  }

  const addonTotal = (addonIds || []).reduce((sum, id) => {
    const addon = addons.find((a) => a.id === id);
    return sum + (addon ? getItemPrice(addon, tier) : 0);
  }, 0);

  const subtotal = base + addonTotal + travelFee;
  const deposit  = calculateDeposit(subtotal, bookingConfig?.deposit);
  const balance  = subtotal - deposit;

  return { base, addonTotal, travelFee, subtotal, deposit, balance, tier };
}

export function formatPrice(dollars) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(dollars);
}
