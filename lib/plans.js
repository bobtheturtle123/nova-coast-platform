// Canonical ShootFlow subscription tier definitions.
// All limit enforcement, fee calculations, and UI rendering should source from here.

export const PLANS = {
  solo: {
    id:               "solo",
    name:             "Solo",
    tagline:          "Everything you need to start taking bookings today.",
    monthlyPrice:     39,
    yearlyMonthly:    33,   // per-month cost when billed annually
    yearlyTotal:      396,  // 33 * 12
    transactionFeePct: 2.0,
    transactionFeeBps: 200,
    activeListings:   25,
    teamSeats:        1,
    archiveMonths:    6,
    featured:         false,
  },
  studio: {
    id:               "studio",
    name:             "Studio",
    tagline:          "Built for teams. Scales as you hire.",
    monthlyPrice:     89,
    yearlyMonthly:    76,
    yearlyTotal:      912,
    transactionFeePct: 1.5,
    transactionFeeBps: 150,
    activeListings:   75,
    teamSeats:        5,
    archiveMonths:    12,
    featured:         true,
  },
  pro: {
    id:               "pro",
    name:             "Pro",
    tagline:          "The full platform for serious studios.",
    monthlyPrice:     179,
    yearlyMonthly:    152,
    yearlyTotal:      1824,
    transactionFeePct: 1.25,
    transactionFeeBps: 125,
    activeListings:   150,
    teamSeats:        15,
    archiveMonths:    18,
    featured:         false,
  },
  scale: {
    id:               "scale",
    name:             "Scale",
    tagline:          "Franchise-ready. No limits on growth.",
    monthlyPrice:     349,
    yearlyMonthly:    297,
    yearlyTotal:      3564,
    transactionFeePct: 1.0,
    transactionFeeBps: 100,
    activeListings:   300,
    teamSeats:        null, // unlimited
    archiveMonths:    24,
    featured:         false,
  },
};

// $1.50 minimum platform fee per processed transaction.
// Prevents micro-transactions from being processed at a loss.
export const MIN_PLATFORM_FEE_CENTS = 150;

export const PLAN_ADDONS = {
  listings25: {
    id:           "listings25",
    name:         "+25 active listings",
    price:        49,
    listingBonus: 25,
  },
  listings50: {
    id:           "listings50",
    name:         "+50 active listings",
    price:        89,
    listingBonus: 50,
  },
  extraSeat: {
    id:        "extraSeat",
    name:      "Additional team member",
    price:     10,
    seatBonus: 1,
  },
  byop: {
    id:         "byop",
    name:       "Bring Your Own Payments",
    price:      79,
    removesFee: true,
    // BYOP disables: automatic deposit collection, "pay now" buttons,
    // automatic balance collection, and all payment automation.
    // Users handle payments manually outside the platform.
    // ShootFlow tracks status only — no alternative payment processor is integrated.
  },
};

export function getPlan(planId) {
  return PLANS[planId] || PLANS.solo;
}

/**
 * Calculate the platform fee for a transaction in cents.
 * Applies the per-plan percentage with a $1.50 minimum floor.
 * Returns 0 if the tenant has BYOP enabled.
 */
export function calculatePlatformFee(amountCents, planId, hasByop = false) {
  if (hasByop) return 0;
  const plan = getPlan(planId);
  const calculated = Math.round(amountCents * (plan.transactionFeeBps / 10000));
  return Math.max(calculated, MIN_PLATFORM_FEE_CENTS);
}

/**
 * Return the effective listing limit for a tenant including add-on bonuses.
 */
export function getListingLimit(planId, addonListings = 0) {
  const plan = getPlan(planId);
  return plan.activeListings + addonListings;
}

/**
 * Return the effective seat limit for a tenant including add-on seats.
 * Returns null for unlimited.
 */
export function getSeatLimit(planId, addonSeats = 0) {
  const plan = getPlan(planId);
  if (plan.teamSeats === null) return null;
  return plan.teamSeats + addonSeats;
}
