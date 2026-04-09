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
function serializeTenant(id, data) {
  const out = { id, ...data };
  // Convert Firestore Timestamps to ISO strings so Next.js can serialize them
  for (const key of Object.keys(out)) {
    if (out[key]?.toDate) out[key] = out[key].toDate().toISOString();
  }
  return out;
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
}) {
  const tenantId = adminDb.collection("tenants").doc().id;

  const branding = {
    businessName,
    tagline: "Professional real estate photography",
    primaryColor: "#0b2a55",
    accentColor: "#c9a96e",
    logoUrl: "",
  };

  const defaultServices = getDefaultServices();
  const defaultPackages = getDefaultPackages();
  const defaultAddons   = getDefaultAddons();

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
    { id: "photography", name: "Photography", description: "25–50 professionally edited HDR photos", price: 199, duration: 90 },
    { id: "drone",       name: "Drone",       description: "FAA-certified aerial photography and video", price: 149, duration: 45 },
    { id: "video",       name: "Listing Video", description: "Cinematic walkthrough, edited with music", price: 299, duration: 60 },
    { id: "matterport",  name: "Matterport 3D Tour", description: "Interactive 3D virtual walkthrough", price: 199, duration: 60 },
    { id: "floorPlans",  name: "Floor Plans", description: "Measured 2D floor plan with dimensions", price: 99, duration: 30 },
  ];
}

function getDefaultPackages() {
  return [
    { id: "core",      name: "Core",      tagline: "Everything you need to list with confidence.", price: 299, includes: ["photography"], featured: false, deliverables: "25–35 edited photos · 48hr turnaround" },
    { id: "growth",    name: "Growth",    tagline: "Stand out with photos, drone, and a walkthrough.", price: 449, includes: ["photography", "drone"], featured: true, deliverables: "35–50 edited photos · Drone shots · 48hr turnaround" },
    { id: "signature", name: "Signature", tagline: "The full production experience.", price: 649, includes: ["photography", "drone", "video"], featured: false, deliverables: "50+ edited photos · Drone · Cinematic video · Floor plan" },
  ];
}

function getDefaultAddons() {
  return [
    { id: "twilight",     name: "Twilight Photography", description: "Golden hour exterior shots at dusk", price: 149 },
    { id: "reels",        name: "Social Media Reel", description: "Vertical 30–60s reel edited for Instagram/TikTok", price: 199 },
    { id: "rushDelivery", name: "Rush Delivery (24hr)", description: "Get your media back in 24 hours", price: 99 },
    { id: "agentIntro",   name: "Agent Introduction Video", description: "30-second talking-head intro clip", price: 149 },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// TENANT CATALOG FETCHING (used in booking flow)
// ─────────────────────────────────────────────────────────────────────────────

export async function getTenantCatalog(tenantId) {
  const tenantRef = adminDb.collection("tenants").doc(tenantId);

  const [pkgSnap, svcSnap, addonSnap] = await Promise.all([
    tenantRef.collection("packages").get(),
    tenantRef.collection("services").get(),
    tenantRef.collection("addons").get(),
  ]);

  return {
    packages: pkgSnap.docs.map((d) => d.data()),
    services: svcSnap.docs.map((d) => d.data()),
    addons:   addonSnap.docs.map((d) => d.data()),
  };
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
    price: 49,
    bookingsPerMonth: 30,
    teamMembers: 1,
    customDomain: false,
  },
  pro: {
    name: "Professional",
    price: 99,
    bookingsPerMonth: 150,
    teamMembers: 5,
    customDomain: true,
  },
  agency: {
    name: "Agency",
    price: 199,
    bookingsPerMonth: Infinity,
    teamMembers: 25,
    customDomain: true,
  },
};
