// ─────────────────────────────────────────────────────────────────────────────
// DEMO DATA — screenshot / marketing mode only.
//
// Activated by adding ?demo=1 to a dashboard URL (e.g. /dashboard?demo=1,
// /dashboard/reports?demo=1, /dashboard/products?demo=1). Nothing is written to
// the database — pages just render this in-memory sample data instead of fetching.
// Numbers are intentionally healthy/positive for landing-page screenshots.
//
// To remove later: delete this file and the small `if (isDemo())` blocks that
// import from it in the dashboard / reports / products pages.
// ─────────────────────────────────────────────────────────────────────────────

// Demo mode is active when the URL carries ?demo=1 OR this browser tab has
// entered the demo workspace (persisted in sessionStorage so navigation between
// tabs keeps demo on). sessionStorage is per-tab, so a real user's other tabs
// are never affected, and "Exit demo" fully clears it.
export function isDemo() {
  if (typeof window === "undefined") return false;
  try {
    const v = new URLSearchParams(window.location.search).get("demo");
    if (v === "1" || v === "true") {
      try { window.sessionStorage.setItem("ky_demo", "1"); } catch {}
      return true;
    }
    return window.sessionStorage.getItem("ky_demo") === "1";
  } catch {
    return false;
  }
}

export function enableDemo() {
  try { window.sessionStorage.setItem("ky_demo", "1"); } catch {}
}

export function exitDemo() {
  try { window.sessionStorage.removeItem("ky_demo"); } catch {}
}

// The message shown whenever a user triggers a disabled action in the demo.
export const DEMO_VIEW_ONLY_MESSAGE =
  "This is a view-only demo. Actions are disabled, but this is where you would manage this in your live KyoriaOS workspace.";

// ── date helpers (relative to "now" so buckets always fill) ───────────────────
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}
function mondayOffset(weekdayIndex) {
  // weekdayIndex: 0 = Monday … 6 = Sunday of the CURRENT iso week
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow + weekdayIndex);
  return ymd(d);
}
// ── people ────────────────────────────────────────────────────────────────────
export const DEMO_TEAM = [
  { id: "ph_alex",  name: "Alex Rivera",  role: "photographer", color: "#3486cf", email: "alex@aperturemedia.co" },
  { id: "ph_jordan", name: "Jordan Lee",  role: "photographer", color: "#C9A96E", email: "jordan@aperturemedia.co" },
  { id: "ph_sam",   name: "Sam Carter",   role: "photographer", color: "#5F7A5A", email: "sam@aperturemedia.co" },
  { id: "ed_priya", name: "Priya Patel",  role: "editor",       color: "#BC6B4A", email: "priya@aperturemedia.co" },
];

// ── service areas (small polygons around San Diego so the mini-map renders) ───
function rect(lat, lng, d = 0.045) {
  return [
    { lat: lat + d, lng: lng - d },
    { lat: lat + d, lng: lng + d },
    { lat: lat - d, lng: lng + d },
    { lat: lat - d, lng: lng - d },
  ];
}
export const DEMO_ZONES = [
  { id: "zn_lajolla",  name: "La Jolla",     type: "include", color: "#3486cf", assignedTo: ["ph_alex"],  paths: rect(32.845, -117.274) },
  { id: "zn_downtown", name: "Downtown",     type: "include", color: "#C9A96E", assignedTo: ["ph_jordan"], paths: rect(32.715, -117.161) },
  { id: "zn_north",    name: "North County", type: "include", color: "#5F7A5A", assignedTo: ["ph_sam"],   paths: rect(33.128, -117.286) },
  { id: "zn_coronado", name: "Coronado",     type: "include", color: "#BC6B4A", assignedTo: ["ph_alex"],  paths: rect(32.685, -117.183, 0.03) },
];

// ── catalog (3 packages, 4 services, 3 add-ons) ───────────────────────────────
export const DEMO_PACKAGES = [
  { id: "pkg_essentials", name: "Essentials",  price: 189, tagline: "Perfect for condos & starter homes", active: true,
    description: "25 magazine-quality HDR photos, delivered next morning.", deliverables: "25 HDR photos · next-day delivery" },
  { id: "pkg_signature",  name: "Signature",   price: 329, tagline: "Our most booked package", active: true, featured: true,
    description: "40 HDR photos plus aerial drone coverage and a branded property website.", deliverables: "40 HDR photos · drone · property site" },
  { id: "pkg_luxury",     name: "Luxury",      price: 549, tagline: "For premium & luxury listings", active: true,
    description: "60 HDR photos, cinematic video tour, drone, and virtual twilight.", deliverables: "60 photos · cinematic video · drone · twilight" },
];
export const DEMO_SERVICES = [
  { id: "svc_hdr",     name: "HDR Photography",     price: 179, active: true, tagline: "Crisp, true-to-life interiors", description: "Professionally lit and edited HDR stills." },
  { id: "svc_drone",   name: "Aerial / Drone",      price: 149, active: true, tagline: "FAA-licensed pilots", description: "Aerial stills showcasing the lot and neighborhood." },
  { id: "svc_video",   name: "Cinematic Video Tour", price: 299, active: true, tagline: "Scroll-stopping walkthroughs", description: "Gimbal-stabilized cinematic walkthrough with licensed music." },
  { id: "svc_matterport", name: "Matterport 3D Tour", price: 199, active: true, tagline: "Immersive 24/7 open house", description: "Dollhouse + walkthrough 3D tour with embed link." },
];
export const DEMO_ADDONS = [
  { id: "add_twilight", name: "Virtual Twilight", price: 49, active: true, tagline: "Golden-hour drama, any time", description: "Daytime exterior transformed into a stunning dusk shot." },
  { id: "add_staging",  name: "Virtual Staging",  price: 39, active: true, tagline: "Furnish empty rooms", description: "Photorealistic furniture added to vacant spaces." },
  { id: "add_floorplan", name: "2D Floor Plan",   price: 79, active: true, tagline: "Buyers love layouts", description: "Clean, measured 2D floor plan with room dimensions." },
];

export const DEMO_CATALOG = {
  packages: DEMO_PACKAGES,
  services: DEMO_SERVICES,
  addons:   DEMO_ADDONS,
};

// ── tenant ───────────────────────────────────────────────────────────────────
export const DEMO_TENANT = {
  businessName: "Aperture Real Estate Media",
  slug: "aperture",
  subscriptionPlan: "scale",
  permanentPlan: "scale",
  onboardingCompleted: true,
  starterGuideCompleted: true,
  stripeConnectOnboarded: true,
  bookingConfig: { slotDuration: 60, availableDays: ["mon", "tue", "wed", "thu", "fri"] },
  pricingConfig: null,
};

// ── today / this-week listings (dashboard snapshot) ──────────────────────────
const ADDR = [
  "1842 Ocean View Dr, La Jolla",
  "455 Marina Blvd, Coronado",
  "9021 Sunset Cliffs, Point Loma",
  "27 Hacienda Ln, Rancho Santa Fe",
  "612 Gaslamp Ct, Downtown",
  "3300 Camino Del Mar, Del Mar",
  "78 Vista Grande, Carlsbad",
  "1500 Pacific Hwy #1204, Downtown",
  "440 Prospect St, La Jolla",
  "215 Orange Ave, Coronado",
  "1190 Highland Dr, Solana Beach",
  "66 Linda Vista Ter, Encinitas",
];
const CLIENTS = [
  ["Morgan Bailey", "morgan@coastalrealty.com"],
  ["Taylor Quinn",  "taylor@quinngroup.com"],
  ["Jamie Foster",  "jamie@fosterhomes.com"],
  ["Riley Nguyen",  "riley@summitres.com"],
  ["Casey Brooks",  "casey@brookrealty.com"],
  ["Drew Sutton",   "drew@suttonluxury.com"],
  ["Avery Collins", "avery@collinsestates.com"],
  ["Quinn Harper",  "quinn@harpergroup.com"],
];
const PKG_NAMES = { pkg_essentials: "Essentials", pkg_signature: "Signature", pkg_luxury: "Luxury" };

// Cover photos for demo listings — the studio's own licensed photography,
// self-hosted from /public/demo (used for copyright reasons).
const COVERS = [
  "/demo/003%20San%20Diiego%20Real%20Estate%20Photography%20.jpg",
  "/demo/1-web-or-mls-Photo-123.jpg",
  "/demo/13-web-or-mls-Altered%20Photo-12.jpg",
  "/demo/23-web-or-mls-Altered%20Photo-19.jpg",
  "/demo/33-web-or-mls-Altered%20Photo%20%2834%20of%20164%29.jpg",
  "/demo/63-web-or-mls-Altered%20Photo%20Reshoot-26.jpg",
  "/demo/80-web-or-mls-Altered%20Photo%20%2880%20of%20164%29.jpg",
  "/demo/Altered%20Photo%20-89%20copy.jpg",
  "/demo/large-019db15a-c866-7031-9091-d53fbc628e91.jpeg",
  "/demo/photo%201.jpg",
  "/demo/photo%202.jpg",
];

function listing(i, dateStr, hour, phId, zoneId, pkgId, price, workflowStatus, pay) {
  const [clientName, clientEmail] = CLIENTS[i % CLIENTS.length];
  const ph = DEMO_TEAM.find((m) => m.id === phId);
  const deposit = Math.round(price * 0.3);
  const created = new Date(new Date(dateStr + "T12:00:00").getTime() - 3 * 86400000).toISOString();
  return {
    id: `demo_l_${i}`,
    clientName, clientEmail,
    address: ADDR[i % ADDR.length],
    fullAddress: ADDR[i % ADDR.length],
    createdAt: created,
    shootDate: dateStr,
    shootTime: `${String(hour).padStart(2, "0")}:00`,
    photographerId: phId,
    photographerName: ph?.name,
    zoneId,
    selectedPackageName: PKG_NAMES[pkgId],
    packageId: pkgId,
    totalPrice: price,
    depositAmount: deposit,
    remainingBalance: price - deposit,
    depositPaid: pay !== "unpaid",
    balancePaid: pay === "paid",
    paidInFull: pay === "paid",
    status: "confirmed",
    workflowStatus,
    hidden: false,
    gallery: { coverUrl: COVERS[i % COVERS.length] },
  };
}

function buildDemoListings() {
  const L = [];
  let i = 0;
  // TODAY — 6 shoots across the team (the primary snapshot screenshot)
  const today = dayOffset(0);
  const todayPlan = [
    [8,  "ph_alex",   "zn_lajolla",  "pkg_signature",  329, "delivered",              "paid"],
    [9,  "ph_jordan", "zn_downtown", "pkg_essentials", 189, "appointment_confirmed",  "deposit"],
    [11, "ph_sam",    "zn_north",    "pkg_luxury",     549, "photographer_assigned",  "deposit"],
    [12, "ph_alex",   "zn_coronado", "pkg_signature",  329, "shot_completed",         "deposit"],
    [14, "ph_jordan", "zn_downtown", "pkg_essentials", 189, "appointment_confirmed",  "paid"],
    [15, "ph_sam",    "zn_north",    "pkg_luxury",     549, "editing_complete",       "deposit"],
  ];
  todayPlan.forEach(([h, ph, zn, pk, pr, ws, pay]) => L.push(listing(i++, today, h, ph, zn, pk, pr, ws, pay)));

  // REST OF THIS WEEK — feeds the weekly revenue KPI
  const weekPlan = [
    [0, 10, "ph_alex",   "zn_lajolla",  "pkg_luxury",     549],
    [1, 13, "ph_jordan", "zn_downtown", "pkg_signature",  329],
    [3, 9,  "ph_sam",    "zn_north",    "pkg_essentials", 189],
    [3, 15, "ph_alex",   "zn_coronado", "pkg_signature",  329],
    [4, 11, "ph_jordan", "zn_downtown", "pkg_luxury",     549],
  ];
  weekPlan.forEach(([wd, h, ph, zn, pk, pr]) => {
    const ds = mondayOffset(wd);
    if (ds !== today) L.push(listing(i++, ds, h, ph, zn, pk, pr, "delivered", "paid"));
  });

  // TOMORROW — a few upcoming
  const tomorrow = dayOffset(1);
  [[9, "ph_alex", "zn_lajolla", "pkg_signature", 329], [13, "ph_sam", "zn_north", "pkg_essentials", 189]]
    .forEach(([h, ph, zn, pk, pr]) => L.push(listing(i++, tomorrow, h, ph, zn, pk, pr, "booked", "deposit")));

  // PREVIOUS WEEK (lower total) — makes the week-over-week delta positive
  [[-7, "pkg_essentials", 189], [-6, "pkg_signature", 329], [-5, "pkg_essentials", 189], [-4, "pkg_essentials", 189]]
    .forEach(([off, pk, pr]) => {
      const ds = dayOffset(off);
      const l = listing(i++, ds, 10, "ph_jordan", "zn_downtown", pk, pr, "completed", "paid");
      L.push(l);
    });

  // DELIVERED in last 30 days w/ fast turnaround → powers "Avg Turnaround"
  for (let k = 0; k < 8; k++) {
    const off = -(3 + k * 3);
    const ds = dayOffset(off);
    const l = listing(i++, ds, 10, DEMO_TEAM[k % 3].id, DEMO_ZONES[k % 4].id, "pkg_signature", 329, "completed", "paid");
    // delivered ~next morning → ~20–28h turnaround
    l.deliveredAt = new Date(new Date(ds + "T12:00:00").getTime() + (20 + (k % 3) * 4) * 3600000).toISOString();
    L.push(l);
  }
  return L;
}

export const DEMO_REVISIONS = [
  {
    id: "rev_1",
    agentName: "Taylor Quinn",
    agentEmail: "taylor@quinngroup.com",
    message: "Could we brighten the kitchen photos a touch?",
    status: "pending",
    bookingId: "demo_l_1",
  },
];

export function getDemoDashboard() {
  return {
    tenant: DEMO_TENANT,
    listings: buildDemoListings(),
    team: DEMO_TEAM,
    zones: DEMO_ZONES,
    revisions: DEMO_REVISIONS,
    hasProducts: true,
  };
}

// ── reports bookings (12 months of healthy history) ──────────────────────────
function buildDemoBookings() {
  const out = [];
  const pkgPrices = { pkg_essentials: 189, pkg_signature: 329, pkg_luxury: 549 };
  const pkgIds = Object.keys(pkgPrices);
  const svcIds = ["svc_drone", "svc_video", "svc_matterport"];
  const addIds = ["add_twilight", "add_staging", "add_floorplan"];
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  let id = 0;
  for (let m = 11; m >= 0; m--) {
    const base = new Date();
    base.setMonth(base.getMonth() - m);
    // Growing volume toward recent months (positive trend)
    const count = 7 + Math.round((11 - m) * 0.5) + Math.floor(rnd() * 3);
    for (let k = 0; k < count; k++) {
      const created = new Date(base.getFullYear(), base.getMonth(), 2 + Math.floor(rnd() * 25), 10);
      const pkgId = pkgIds[Math.floor(rnd() * pkgIds.length)];
      const extras = [];
      if (rnd() > 0.4) extras.push(svcIds[Math.floor(rnd() * svcIds.length)]);
      if (rnd() > 0.55) extras.push(addIds[Math.floor(rnd() * addIds.length)]);
      const extrasPrice = extras.reduce((s, e) => s + (e.startsWith("svc") ? (e === "svc_video" ? 299 : e === "svc_matterport" ? 199 : 149) : (e === "add_twilight" ? 49 : e === "add_staging" ? 39 : 79)), 0);
      const price = pkgPrices[pkgId] + extrasPrice;
      const deposit = Math.round(price * 0.3);
      // ~88% fully paid/completed, ~9% confirmed (deposit only), ~3% requested
      const roll = rnd();
      const completed = roll > 0.12;
      const confirmedOnly = !completed && roll > 0.03;
      const [clientName, clientEmail] = CLIENTS[Math.floor(rnd() * CLIENTS.length)];
      out.push({
        id: `demo_b_${id++}`,
        clientName, clientEmail,
        fullAddress: ADDR[id % ADDR.length],
        createdAt: created.toISOString(),
        shootDate: created.toISOString(),
        status: completed ? "completed" : confirmedOnly ? "confirmed" : "requested",
        workflowStatus: completed ? "delivered" : confirmedOnly ? "appointment_confirmed" : "booked",
        packageId: pkgId,
        serviceIds: extras.filter((e) => e.startsWith("svc")),
        selectedAddons: extras.filter((e) => e.startsWith("add")).map((a) => ({ id: a })),
        totalPrice: price,
        depositAmount: deposit,
        remainingBalance: price - deposit,
        depositPaid: completed || confirmedOnly,
        balancePaid: completed,
        paidInFull: completed,
        promoDiscount: 0,
        costs: { totalCost: Math.round(price * 0.3) }, // ~70% margin
      });
    }
  }
  return out;
}

export function getDemoReports() {
  return { bookings: buildDemoBookings(), catalog: DEMO_CATALOG };
}

// ── team page (members + schedule bookings + products) ───────────────────────
export function getDemoTeam() {
  return {
    tenant: DEMO_TENANT,
    members: DEMO_TEAM,
    bookings: buildDemoListings(),
    products: { services: DEMO_SERVICES, packages: DEMO_PACKAGES, addons: DEMO_ADDONS },
    timeBlocks: [],
  };
}

// ── listings page ────────────────────────────────────────────────────────────
export function getDemoListings() {
  const listings = buildDemoListings().sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const pendingRevCounts = {};
  DEMO_REVISIONS.forEach((r) => {
    if (r.bookingId) pendingRevCounts[r.bookingId] = (pendingRevCounts[r.bookingId] || 0) + 1;
  });
  return { listings, pendingRevCounts };
}

// ── clients / customers (agents tab) ─────────────────────────────────────────
const BROKERAGES = ["Coastal Realty", "Quinn Group", "Foster Homes", "Summit Residential", "Brook Realty", "Sutton Luxury", "Collins Estates", "Harper Group"];
export function getDemoAgents() {
  const monthsAgo = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString(); };
  const agents = CLIENTS.map(([name, email], i) => {
    const totalOrders = 14 - i;
    const avg = 280 + (i % 4) * 60;
    return {
      id: `cl_${i}`,
      name, email,
      phone: `(858) 555-0${100 + i}`,
      company: BROKERAGES[i % BROKERAGES.length],
      brokerage: BROKERAGES[i % BROKERAGES.length],
      totalOrders,
      totalSpent: totalOrders * avg,
      firstOrderAt: monthsAgo(11 - (i % 11)),
      lastOrderAt: monthsAgo(i % 3),
    };
  });
  return { agents, teams: [] };
}

// ── deliveries / galleries ───────────────────────────────────────────────────
export function getDemoGalleries() {
  const listings = buildDemoListings().slice(0, 12);
  const galleries = listings.map((l, i) => ({
    id: `gal_${i}`,
    bookingId: l.id,
    title: l.address,
    address: l.address,
    clientName: l.clientName,
    coverUrl: l.gallery.coverUrl,
    photoCount: 32 + (i % 5) * 8,
    videoCount: i % 3 === 0 ? 1 : 0,
    delivered: l.workflowStatus === "delivered" || l.workflowStatus === "completed",
    status: l.workflowStatus === "completed" ? "delivered" : l.workflowStatus,
    paid: l.paidInFull,
    createdAt: l.createdAt,
    deliveredAt: l.deliveredAt || l.createdAt,
  }));
  return { galleries };
}

// ── calendar ─────────────────────────────────────────────────────────────────
export function getDemoCalendar() {
  return { listings: buildDemoListings(), blocks: [] };
}

// ── service areas ────────────────────────────────────────────────────────────
export function getDemoServiceAreas() {
  return { zones: DEMO_ZONES, teamMembers: DEMO_TEAM, tenant: DEMO_TENANT };
}

// ── bookings tab ─────────────────────────────────────────────────────────────
export function getDemoBookingsTab() {
  return {
    bookings: buildDemoListings(),
    agents: getDemoAgents().agents,
    teamMembers: DEMO_TEAM,
    abandonedBookings: [],
    catalog: DEMO_CATALOG,
    tenant: DEMO_TENANT,
  };
}

// ── settings / branding ──────────────────────────────────────────────────────
export function getDemoSettingsTenant() {
  return {
    ...DEMO_TENANT,
    phone: "(858) 555-0100",
    fromZip: "92037",
    country: "US",
    tempUnit: "F",
    currency: "USD",
    locale: "en-US",
    branding: {
      tagline: "San Diego's real estate media studio",
      primaryColor: "#3486cf",
      accentColor: "#c9a96e",
      logoUrl: "/kyoriaos-logo.png",
    },
    pricingConfig: { mode: "sqft" },
  };
}

// ── billing / payments ───────────────────────────────────────────────────────
export function getDemoBilling() {
  return {
    tenant: {
      ...DEMO_TENANT,
      permanentPlan: "scale",
      subscriptionPlan: "scale",
      subscriptionStatus: "active",
      stripeSubscriptionId: "sub_demo123",
      stripeCustomerId: "cus_demo123",
      stripeConnectOnboarded: true,
      addonListings: 0,
      addonSeats: 0,
    },
    listingsThisYear: 218,
    teamMemberCount: DEMO_TEAM.length,
  };
}

export function getDemoProducts() {
  return {
    items: {
      packages: DEMO_PACKAGES,
      services: DEMO_SERVICES,
      addons:   DEMO_ADDONS,
      retainers: [],
    },
    teamMembers: DEMO_TEAM,
    pricingConfig: null,
  };
}
