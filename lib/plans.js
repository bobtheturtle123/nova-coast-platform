// Canonical KyoriaOS subscription tier definitions.
// All limit enforcement, fee calculations, and UI rendering should source from here.

export const PLANS = {
  solo: {
    id:               "solo",
    name:             "Solo",
    tagline:          "Best for solo real estate media photographers.",
    monthlyPrice:     49,
    yearlyMonthly:    41,   // ~2 months free
    yearlyTotal:      490,
    transactionFeePct: 2.0,
    transactionFeeBps: 200,
    activeListings:   125,  // annual listing credits
    teamSeats:        1,
    archiveMonths:    12,   // internal only — not displayed publicly
    featured:         false,
  },
  studio: {
    id:               "studio",
    name:             "Studio",
    tagline:          "Best for small teams and growing media businesses.",
    monthlyPrice:     99,
    yearlyMonthly:    83,   // ~2 months free
    yearlyTotal:      990,
    transactionFeePct: 2.0,
    transactionFeeBps: 200,
    activeListings:   300,  // annual listing credits
    teamSeats:        3,
    archiveMonths:    12,   // internal only
    featured:         true,
  },
  pro: {
    id:               "pro",
    name:             "Pro",
    tagline:          "Best for growing teams with higher listing volume.",
    monthlyPrice:     179,
    yearlyMonthly:    149,  // ~2 months free
    yearlyTotal:      1790,
    transactionFeePct: 1.5,
    transactionFeeBps: 150,
    activeListings:   600,  // annual listing credits
    teamSeats:        5,
    archiveMonths:    12,   // internal only
    featured:         false,
  },
  scale: {
    id:               "scale",
    name:             "Scale",
    tagline:          "Best for high-volume media teams.",
    monthlyPrice:     349,
    yearlyMonthly:    291,  // ~2 months free
    yearlyTotal:      3490,
    transactionFeePct: 1.25,
    transactionFeeBps: 125,
    activeListings:   1000, // annual listing credits
    teamSeats:        10,
    archiveMonths:    12,   // internal only
    featured:         false,
  },
  // Internal-only lifetime plan for owner/super-admin accounts: free, unlimited
  // listings + seats, no platform fees. Never sold or shown in pricing.
  unlimited: {
    id:               "unlimited",
    name:             "Scale",
    tagline:          "Lifetime — unlimited.",
    monthlyPrice:     0,
    yearlyMonthly:    0,
    yearlyTotal:      0,
    transactionFeePct: 0,
    transactionFeeBps: 0,
    activeListings:   1_000_000_000, // effectively unlimited
    teamSeats:        null,          // null = unlimited seats
    archiveMonths:    1200,          // 100 years
    featured:         false,
  },
};

// Accounts that get the lifetime unlimited plan for free. Their email (or a
// tenant.unlimited flag) is enough — no Stripe subscription required.
const BUILTIN_SUPERADMIN_EMAILS = ["complexdesign123@gmail.com"];
export const SUPERADMIN_EMAILS = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPERADMIN_EMAILS || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export function isSuperAdminEmail(email) {
  if (!email) return false;
  const e = String(email).toLowerCase();
  return BUILTIN_SUPERADMIN_EMAILS.includes(e) || SUPERADMIN_EMAILS.includes(e);
}

// True for accounts that should never be limited or billed.
export function isUnlimitedTenant(tenant) {
  if (!tenant) return false;
  if (tenant.unlimited === true) return true;
  return isSuperAdminEmail(tenant.email || tenant.ownerEmail);
}

export const MIN_PLATFORM_FEE_CENTS = 150;

// Monthly recurring seat add-on only
export const PLAN_ADDONS = {
  extraSeat: {
    id:        "extraSeat",
    name:      "Additional internal team member",
    price:     19,
    seatBonus: 1,
  },
};

// One-time listing credit top-up packs (not subscriptions, non-refundable)
export const LISTING_TOPUPS = {
  pack25: {
    id:      "pack25",
    name:    "+25 Listing Credits",
    price:   175,
    credits: 25,
  },
  pack50: {
    id:      "pack50",
    name:    "+50 Listing Credits",
    price:   325,
    credits: 50,
  },
  pack100: {
    id:      "pack100",
    name:    "+100 Listing Credits",
    price:   600,
    credits: 100,
  },
};

// Per-plan add-on expansion caps. null = unlimited (Scale only).
export const PLAN_ADDON_CAPS = {
  solo:   { extraSeats: 0,    topupListings: 50  },
  studio: { extraSeats: 3,    topupListings: 100 },
  pro:    { extraSeats: 8,    topupListings: 200 },
  scale:  { extraSeats: null, topupListings: null },
};

export const NEXT_PLAN = {
  solo:   "studio",
  studio: "pro",
  pro:    "scale",
  scale:  null,
};

export function getAddonCaps(planId) {
  return PLAN_ADDON_CAPS[planId] || PLAN_ADDON_CAPS.solo;
}

export function getPlan(planId) {
  return PLANS[planId] || PLANS.solo;
}

export function calculatePlatformFee(amountCents, planId) {
  const plan = getPlan(planId);
  const calculated = Math.round(amountCents * (plan.transactionFeeBps / 10000));
  return Math.max(calculated, MIN_PLATFORM_FEE_CENTS);
}

export function getListingLimit(planId, addonListings = 0) {
  const plan = getPlan(planId);
  return plan.activeListings + addonListings;
}

export function getSeatLimit(planId, addonSeats = 0) {
  const plan = getPlan(planId);
  if (plan.teamSeats === null) return null;
  return plan.teamSeats + addonSeats;
}

export function getListingExpiresAt(listing, planId) {
  const plan = getPlan(planId);
  const raw = listing.createdAt;
  let created;
  if (raw && typeof raw.toDate === "function") {
    created = raw.toDate();
  } else if (raw instanceof Date) {
    created = raw;
  } else if (typeof raw === "string") {
    created = new Date(raw);
  } else {
    created = new Date();
  }
  const expires = new Date(created);
  expires.setMonth(expires.getMonth() + plan.archiveMonths);
  return expires;
}

export function isListingExpired(listing, planId) {
  return new Date() > getListingExpiresAt(listing, planId);
}

// Returns the effective plan ID for a tenant, respecting permanentPlan overrides.
// Use this everywhere instead of reading tenant.subscriptionPlan directly.
export function getEffectivePlan(tenant) {
  if (isUnlimitedTenant(tenant)) return "unlimited";
  return tenant?.permanentPlan || tenant?.subscriptionPlan || "solo";
}
