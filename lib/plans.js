// Canonical KyoriaOS subscription tier definitions.
// All limit enforcement, fee calculations, and UI rendering should source from here.

export const PLANS = {
  solo: {
    id:               "solo",
    name:             "Solo",
    tagline:          "For solo photographers ready to run a real business.",
    monthlyPrice:     79,
    yearlyMonthly:    67,
    yearlyTotal:      804,
    transactionFeePct: 2.0,
    transactionFeeBps: 200,
    activeListings:   120,  // annual listing credits
    teamSeats:        1,
    archiveMonths:    12,   // internal only — not displayed publicly
    featured:         false,
  },
  studio: {
    id:               "studio",
    name:             "Studio",
    tagline:          "The complete operating system for your media business.",
    monthlyPrice:     159,
    yearlyMonthly:    135,
    yearlyTotal:      1620,
    transactionFeePct: 1.5,
    transactionFeeBps: 150,
    activeListings:   300,  // annual listing credits
    teamSeats:        5,
    archiveMonths:    12,   // internal only
    featured:         true,
  },
  pro: {
    id:               "pro",
    name:             "Pro Team",
    tagline:          "Built for fast-growing teams that need full control.",
    monthlyPrice:     279,
    yearlyMonthly:    237,
    yearlyTotal:      2844,
    transactionFeePct: 1.25,
    transactionFeeBps: 125,
    activeListings:   600,  // annual listing credits
    teamSeats:        12,
    archiveMonths:    12,   // internal only
    featured:         false,
  },
  scale: {
    id:               "scale",
    name:             "Scale",
    tagline:          "Enterprise-ready. Built for multi-location operations.",
    monthlyPrice:     449,
    yearlyMonthly:    381,
    yearlyTotal:      4572,
    transactionFeePct: 1.0,
    transactionFeeBps: 100,
    activeListings:   1200, // annual listing credits
    teamSeats:        null, // unlimited
    archiveMonths:    12,   // internal only
    featured:         false,
  },
};

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
