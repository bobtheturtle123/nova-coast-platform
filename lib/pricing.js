// ─────────────────────────────────────────────────────────────────────────────
// PRICING CONFIG
// Edit prices here whenever you need to update your rates.
// ─────────────────────────────────────────────────────────────────────────────

export const PACKAGES = [
  {
    id: "core",
    name: "Core",
    tagline: "Everything you need to list with confidence.",
    price: 299,
    featured: false,
    includes: ["photography"],
    services: ["Photography"],
    deliverables: "25–35 edited photos · 48hr turnaround",
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "Stand out with photos, drone, and a walkthrough.",
    price: 449,
    featured: true,
    includes: ["photography", "drone"],
    services: ["Photography", "Drone Footage"],
    deliverables: "35–50 edited photos · Drone shots · 48hr turnaround",
  },
  {
    id: "signature",
    name: "Signature",
    tagline: "The full production experience.",
    price: 649,
    featured: false,
    includes: ["photography", "drone", "video"],
    services: ["Photography", "Drone", "Listing Video"],
    deliverables: "50+ edited photos · Drone · Cinematic video · Floor plan",
  },
];

export const SERVICES = [
  {
    id: "photography",
    name: "Photography",
    description: "25–50 professionally edited HDR photos",
    price: 199,
    duration: 90, // minutes
  },
  {
    id: "drone",
    name: "Drone",
    description: "FAA-certified aerial photography and video",
    price: 149,
    duration: 45,
  },
  {
    id: "video",
    name: "Listing Video",
    description: "Cinematic walkthrough, edited with music",
    price: 299,
    duration: 60,
  },
  {
    id: "matterport",
    name: "Matterport 3D Tour",
    description: "Interactive 3D virtual walkthrough",
    price: 199,
    duration: 60,
  },
  {
    id: "floorPlans",
    name: "Floor Plans",
    description: "Measured 2D floor plan with dimensions",
    price: 99,
    duration: 30,
  },
];

export const ADDONS = [
  {
    id: "twilight",
    name: "Twilight Photography",
    description: "Golden hour exterior shots at dusk",
    price: 149,
  },
  {
    id: "reels",
    name: "Social Media Reel",
    description: "Vertical 30–60s reel edited for Instagram/TikTok",
    price: 199,
  },
  {
    id: "rushDelivery",
    name: "Rush Delivery (24hr)",
    description: "Get your media back in 24 hours",
    price: 99,
  },
  {
    id: "agentIntro",
    name: "Agent Introduction Video",
    description: "30-second talking-head intro clip",
    price: 149,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate total price from booking selections.
 * @param {string|null} packageId   - e.g. "core", "growth", "signature"
 * @param {string[]}    serviceIds  - e.g. ["photography", "drone"]
 * @param {string[]}    addonIds    - e.g. ["twilight"]
 * @param {number}      travelFee   - calculated separately via Maps API
 * @returns {object}    Full price breakdown
 */
export function calculatePrice(packageId, serviceIds, addonIds, travelFee = 0) {
  let base = 0;

  if (packageId) {
    const pkg = PACKAGES.find((p) => p.id === packageId);
    base = pkg ? pkg.price : 0;
  } else {
    base = serviceIds.reduce((sum, id) => {
      const svc = SERVICES.find((s) => s.id === id);
      return sum + (svc ? svc.price : 0);
    }, 0);
  }

  const addonTotal = addonIds.reduce((sum, id) => {
    const addon = ADDONS.find((a) => a.id === id);
    return sum + (addon ? addon.price : 0);
  }, 0);

  const subtotal = base + addonTotal + travelFee;
  const deposit = Math.round(subtotal * 0.5 * 100) / 100;
  const balance = subtotal - deposit;

  return {
    base,
    addonTotal,
    travelFee,
    subtotal,
    deposit,
    balance,
  };
}

/**
 * Calculate total shoot duration in minutes based on selected services.
 */
export function calculateDuration(packageId, serviceIds) {
  if (packageId) {
    const pkg = PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return 90;
    return pkg.includes.reduce((sum, id) => {
      const svc = SERVICES.find((s) => s.id === id);
      return sum + (svc ? svc.duration : 0);
    }, 0);
  }

  return serviceIds.reduce((sum, id) => {
    const svc = SERVICES.find((s) => s.id === id);
    return sum + (svc ? svc.duration : 0);
  }, 0);
}

/** Format cents to dollar string: 29900 → "$299.00" */
export function formatPrice(dollars) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}
