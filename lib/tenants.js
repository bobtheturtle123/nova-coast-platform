import { adminDb, adminAuth } from "@/lib/firebase-admin";

// ─────────────────────────────────────────────────────────────────────────────
// SLUG HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a business name to a URL-safe slug.
 * "Nova Coast Media" → "nova-coast-media"
 */
export function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 48);
}

/**
 * Check if a slug is taken by another tenant.
 */
export async function isSlugTaken(slug, excludeTenantId = null) {
  const snap = await adminDb
    .collection("tenants")
    .where("slug", "==", slug)
    .limit(1)
    .get();

  if (snap.empty) return false;
  if (excludeTenantId && snap.docs[0].id === excludeTenantId) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// TENANT CRUD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch tenant by slug (public — used in booking flow).
 * Returns null if not found.
 */
// Deep-serialize any object coming from Firestore so it can be passed as
// Next.js Server→Client Component props. Recursively converts Timestamps to
// ISO strings and strips undefined values.
export function deepSerialize(val) {
  if (val === null || val === undefined) return val ?? null;
  if (typeof val?.toDate === "function") return val.toDate().toISOString();
  if (Array.isArray(val)) return val.map(deepSerialize);
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "object") {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = deepSerialize(v);
    }
    return out;
  }
  return val;
}

function serializeTenant(id, data) {
  return deepSerialize({ id, ...data });
}

export async function getTenantBySlug(slug) {
  const snap = await adminDb
    .collection("tenants")
    .where("slug", "==", slug)
    .limit(1)
    .get();

  if (snap.empty) return null;
  const doc = snap.docs[0];
  return serializeTenant(doc.id, doc.data());
}

/**
 * Fetch tenant by ID.
 */
export async function getTenantById(tenantId) {
  const doc = await adminDb.collection("tenants").doc(tenantId).get();
  if (!doc.exists) return null;
  return serializeTenant(doc.id, doc.data());
}

/**
 * Create a new tenant document and set Firebase custom claims.
 */
export async function createTenant({
  uid,           // Firebase Auth UID of the owner
  email,
  businessName,
  slug,
  phone = "",
  fromZip = "",
  referralCode = null,
  referredBy   = null,
}) {
  const tenantId = adminDb.collection("tenants").doc().id;

  const branding = {
    businessName,
    tagline: "Professional real estate photography",
    primaryColor: "#0b2a55",
    accentColor: "#c9a96e",
    logoUrl: "",
  };

  const defaultServices = [];
  const defaultPackages = [];
  const defaultAddons   = [];

  const batch = adminDb.batch();

  // Tenant document
  const tenantRef = adminDb.collection("tenants").doc(tenantId);
  batch.set(tenantRef, {
    id: tenantId,
    slug,
    businessName,
    email,
    phone,
    fromZip,
    branding,
    ownerUid: uid,
    subscriptionStatus: "trialing",   // "trialing" | "active" | "past_due" | "canceled"
    subscriptionPlan:   "starter",    // "starter" | "pro" | "agency"
    stripeCustomerId:   null,
    stripeSubscriptionId: null,
    stripeConnectAccountId: null,
    stripeConnectOnboarded: false,
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
    createdAt: new Date(),
    // Referral program
    referralCode:             referralCode || null,
    referredBy:               referredBy   || null,
    referralCredits:          0,
    referralRewardsThisMonth: 0,
    referralRewardCap:        20000, // $200/month cap in cents
  });

  // Seed default services
  for (const svc of defaultServices) {
    batch.set(tenantRef.collection("services").doc(svc.id), svc);
  }
  for (const pkg of defaultPackages) {
    batch.set(tenantRef.collection("packages").doc(pkg.id), pkg);
  }
  for (const addon of defaultAddons) {
    batch.set(tenantRef.collection("addons").doc(addon.id), addon);
  }

  await batch.commit();

  // Set custom claims on the Firebase user
  await adminAuth.setCustomUserClaims(uid, {
    role: "owner",
    tenantId,
  });

  return tenantId;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT CATALOG (seeded on registration)
// ─────────────────────────────────────────────────────────────────────────────

function getDefaultServices() {
  return [
    {
      id: "classicDaytime", name: "Classic Daytime Photography",
      description: "Corner-to-corner interior and exterior coverage built for clean MLS presentation. Every space documented with wide-angle, professionally edited photos.",
      price: 250,
      priceTiers: { Tiny: 250, Small: 275, Medium: 325, Large: 375, XL: 475, XXL: 525 },
    },
    {
      id: "luxuryDaytime", name: "Luxury Daytime Photography",
      description: "Story-driven photography with selective framing, elevated lighting, and detail shots. Recommended for listings $1M+.",
      price: 399,
      priceTiers: { Tiny: 399, Small: 449, Medium: 549, Large: 649, XL: 749, XXL: 849 },
    },
    {
      id: "drone", name: "Drone Photography",
      description: "~15 aerial images from multiple altitudes and angles. Subject to FAA airspace authorization.",
      price: 299,
    },
    {
      id: "realTwilight", name: "Twilight Photography",
      description: "True golden and blue-hour exterior captures scheduled at dusk for maximum curb appeal. 6–10 edited exterior photos.",
      price: 399,
      priceTiers: { Tiny: 399, Small: 449, Medium: 499, Large: 549, XL: 599, XXL: 675 },
    },
    {
      id: "premiumCinematicVideo", name: "Cinematic Property Video",
      description: "60-second horizontal walkthrough video with aerial drone. Delivered within 48–72 hours.",
      price: 375,
      priceTiers: { Tiny: 375, Small: 475, Medium: 525, Large: 599, XL: 699, XXL: 850 },
    },
    {
      id: "luxuryCinematicVideo", name: "Luxury Cinematic Video",
      description: "Dramatic day-to-night production combining daytime and twilight footage. Aerial drone included. Delivered within 48–72 hours.",
      price: 899,
      priceTiers: { Tiny: 899, Small: 1099, Medium: 1199, Large: 1299, XL: 1499, XXL: 1699 },
    },
    {
      id: "socialReel", name: "Signature Social Media Reel",
      description: "Agent on camera with property walkthrough. 60 seconds or two 20-second cuts. Vertical format for Reels, TikTok, and Shorts.",
      price: 475,
      priceTiers: { Tiny: 475, Small: 575, Medium: 625, Large: 699, XL: 799, XXL: 950 },
    },
    {
      id: "matterport", name: "Matterport 3D Tour",
      description: "Interactive 3D virtual walkthrough. Next-day delivery. 4 months hosting included.",
      price: 250,
      priceTiers: { Tiny: 250, Small: 325, Medium: 425, Large: 425, XL: 599, XXL: 699 },
    },
    {
      id: "zillow3d", name: "Zillow 3D Tour",
      description: "Integrates directly into your Zillow listing. No ongoing hosting fees. Stays live until sold.",
      price: 250,
      priceTiers: { Tiny: 250, Small: 325, Medium: 425, Large: 425, XL: 599, XXL: 699 },
    },
  ];
}

function getDefaultPackages() {
  return [
    {
      id: "essentials", name: "Essentials",
      tagline: "More listing views. Professional photos, drone, and twilight ready to publish within 24 hours.",
      price: 549,
      priceTiers: { Tiny: 549, Small: 599, Medium: 649, Large: 699, XL: 799, XXL: 899 },
      includes: ["classicDaytime", "drone"],
      featured: false,
      deliverables: "Photos delivered within 24 hours · Includes 1 digital twilight",
    },
    {
      id: "prime", name: "Prime",
      tagline: "More showings. Luxury photography and real twilight that make buyers stop scrolling and book a tour.",
      price: 1199,
      priceTiers: { Tiny: 1199, Small: 1299, Medium: 1499, Large: 1599, XL: 1799, XXL: 1999 },
      includes: ["luxuryDaytime", "drone", "realTwilight"],
      featured: true,
      deliverables: "Photos & twilight within 24 hours · Property website included",
    },
    {
      id: "signature", name: "Signature",
      tagline: "More offers. Luxury photos, a cinematic video, and a property website that works across every platform buyers use.",
      price: 1999,
      priceTiers: { Tiny: 1999, Small: 2399, Medium: 2599, Large: 2899, XL: 3199, XXL: 3599 },
      includes: ["luxuryDaytime", "drone", "realTwilight", "luxuryCinematicVideo"],
      featured: false,
      deliverables: "Photos within 24 hrs · Video within 72 hrs · Property website included",
    },
  ];
}

function getDefaultAddons() {
  return [
    {
      id: "floorplans2d", name: "2D Floor Plans",
      description: "Measured floor plan with room dimensions accurate to 97%. Next-day delivery.",
      price: 120,
      priceTiers: { Tiny: 120, Small: 120, Medium: 150, Large: 180, XL: 220, XXL: 260 },
    },
    {
      id: "floorplans3d", name: "3D Floor Plan (includes 2D)",
      description: "Dimensional 3D layout with clean 2D floor plan included. Great for listing pages.",
      price: 220,
      priceTiers: { Tiny: 220, Small: 220, Medium: 250, Large: 280, XL: 320, XXL: 360 },
    },
    {
      id: "virtualTwilight", name: "Digital Twilight Images",
      description: "Warm curb appeal without rescheduling. 48-hour delivery. Priced per image.",
      price: 49,
    },
    {
      id: "agentOnCamera", name: "Agent On Camera",
      description: "On-camera intro or walkthrough filmed during your video session.",
      price: 299,
    },
    {
      id: "verticalVideoEdit", name: "Vertical Video Edit",
      description: "Vertical cut of your cinematic video optimized for Reels, TikTok, and Shorts. Must be booked with a video.",
      price: 99,
    },
    {
      id: "virtualStaging", name: "AI Virtual Staging",
      description: "Furnish empty rooms digitally with modern styles. Priced per image.",
      price: 39,
    },
    {
      id: "traditionalStaging", name: "Traditional Virtual Staging",
      description: "Designer-curated staging by our team — higher realism than AI. Priced per image.",
      price: 49,
    },
    {
      id: "grass", name: "Green Grass Enhancement",
      description: "Replaces dry or patchy lawns with lush, natural-looking grass. 48-hour delivery.",
      price: 79,
    },
    {
      id: "detailPhotos", name: "Detail Photo Set",
      description: "5–10 close-up architectural details and finishes that wide-angle shots miss.",
      price: 119,
    },
    {
      id: "propertySite", name: "Single Property Website",
      description: "All media and property info in one shareable, branded link.",
      price: 79,
    },
    {
      id: "propertyOutlines", name: "Property Outlines",
      description: "Boundary lines overlaid on drone media to define lot layout. Priced per image.",
      price: 39,
    },
    {
      id: "neighborhoodShots", name: "Neighborhood Shots",
      description: "5 curated photos of the surrounding area within 5 miles. Pulled from library or captured fresh.",
      price: 199,
    },
    {
      id: "sameDay", name: "Same Day Turnaround",
      description: "Photos by 8:30pm for shoots starting by 1:30pm.",
      price: 399,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// TENANT CATALOG FETCHING (used in booking flow)
// ─────────────────────────────────────────────────────────────────────────────

export async function getTenantCatalog(tenantId) {
  const tenantRef = adminDb.collection("tenants").doc(tenantId);

  const [tenantDoc, pkgSnap, svcSnap, addonSnap] = await Promise.all([
    tenantRef.get(),
    tenantRef.collection("packages").get(),
    tenantRef.collection("services").get(),
    tenantRef.collection("addons").get(),
  ]);

  const tenantData    = tenantDoc.exists ? tenantDoc.data() : {};
  const pricingConfig = tenantData.pricingConfig  || null;
  const bookingConfig = tenantData.bookingConfig  || null;

  // Include photographers for agent selection if the feature is enabled
  let photographers = [];
  if (bookingConfig?.allowAgentPhotographerSelection) {
    const teamSnap = await tenantRef.collection("team").get();
    photographers = teamSnap.docs
      .map((d) => ({ id: d.id, name: d.data().name, color: d.data().color || null, photoUrl: d.data().photoUrl || null }))
      .filter((m) => m.name);
  }

  return deepSerialize({
    packages:      pkgSnap.docs.map((d) => d.data()),
    services:      svcSnap.docs.map((d) => d.data()),
    addons:        addonSnap.docs.map((d) => d.data()),
    pricingConfig,
    bookingConfig,
    photographers,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING CALCULATION (tenant-catalog-aware)
// ─────────────────────────────────────────────────────────────────────────────

export function calculateTenantPrice(packageId, serviceIds, addonIds, travelFee = 0, catalog) {
  const { packages, services, addons } = catalog;

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

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIPTION PLAN LIMITS
// ─────────────────────────────────────────────────────────────────────────────

export const PLANS = {
  starter: {
    name: "Starter",
    price: 39,
    bookingsPerMonth: 30,
    teamMembers: 1,
    customDomain: false,
  },
  pro: {
    name: "Pro",
    price: 79,
    bookingsPerMonth: 150,
    teamMembers: 5,
    customDomain: true,
  },
  studio: {
    name: "Studio",
    price: 149,
    bookingsPerMonth: Infinity,
    teamMembers: 25,
    customDomain: true,
  },
};
