// scripts/seed-catalog.js
// Seeds the product catalog into the tenant owned by EMAIL.
// Clears existing packages/services/addons first, then writes fresh.
//
// Usage:
//   node scripts/seed-catalog.js complexdesign123@gmail.com
//
// Pass --dry-run to preview without writing.

require("dotenv").config({ path: ".env.local" });

const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth }             = require("firebase-admin/auth");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
initializeApp({ credential: cert(serviceAccount) });

const email  = process.argv[2];
const dryRun = process.argv.includes("--dry-run");

if (!email) {
  console.error("Usage: node scripts/seed-catalog.js your@email.com [--dry-run]");
  process.exit(1);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function features(str) {
  if (!str) return [];
  return str.split("|").map((s) => s.trim()).filter(Boolean);
}

function tiers(tiny, small, medium, large, xl, xxl) {
  return {
    Tiny:   Number(tiny)   || 0,
    Small:  Number(small)  || 0,
    Medium: Number(medium) || 0,
    Large:  Number(large)  || 0,
    XL:     Number(xl)     || 0,
    XXL:    Number(xxl)    || 0,
  };
}

function fixedPrice(str) {
  // "$39 per image" → 39,  "$79.99" → 79.99
  const m = String(str || "").match(/\$?([\d.]+)/);
  return m ? Number(m[1]) : 0;
}

// Split "headline | delivery note" → { tagline, deliveryNote }
function splitSummary(str) {
  if (!str) return { tagline: "", deliveryNote: "" };
  const parts = str.split("|").map((s) => s.trim());
  return { tagline: parts[0] || "", deliveryNote: parts[1] || "" };
}

// ─── PACKAGES ────────────────────────────────────────────────────────────────

const PACKAGES = [
  {
    id:   "essentials-package",
    name: "Essentials Package",
    tierTag: "Photos · Drone · Digital Twilight",
    badge: "",
    summary: "More listing views. Professional photos, drone, and twilight ready to publish within 24 hours. | Photos delivered within 24 hours",
    featureStr: "Classic Daytime Photography | Aerial / Drone Photography | 1 Digital Twilight Image | Professional Editing",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/07/Photo-work-05.jpg",
    thumbnailAlt: "Essentials package example photo",
    priceTiers: tiers(549, 599, 649, 699, 799, 899),
  },
  {
    id:   "prime-package",
    name: "Prime Package",
    tierTag: "Photos · Drone · Twilight · Website",
    badge: "Most Popular",
    summary: "More showings. Luxury photography and real twilight that make buyers stop scrolling and book a tour. | Photos delivered within 24 hours",
    featureStr: "Luxury Daytime Photography | Aerial / Drone Photography | Real Twilight Photography | Property Outline | Single Property Website | Professional Editing",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/09/Photo-012.jpg",
    thumbnailAlt: "Prime package example photo",
    priceTiers: tiers(1199, 1299, 1499, 1599, 1799, 1999),
  },
  {
    id:   "signature-package",
    name: "Signature Package",
    tierTag: "Photos · Drone · Twilight · Video · Website",
    badge: "",
    summary: "More offers. Luxury photos, a cinematic video, and a property website that works across every platform buyers use. | Photos within 24 hrs · Video within 72 hrs",
    featureStr: "Luxury Daytime Photography | Aerial / Drone Photography | Real Twilight Photography | Luxury Cinematic Video (Day to Night) | Single Property Website | Professional Editing",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/09/ucarecjdn-copy.jpg",
    thumbnailAlt: "Signature package example twilight exterior",
    priceTiers: tiers(1999, 2399, 2599, 2899, 3199, 3599),
  },
];

// ─── A LA CARTE SERVICES ─────────────────────────────────────────────────────

const SERVICES = [
  {
    id:   "classic-daytime-photography",
    name: "Classic Daytime Photography",
    summary: "Efficient, corner-to-corner coverage built for clean MLS presentation. Wide-angle, room-by-room photography that ensures every space is documented. Best suited for listings under $1M.",
    featureStr: "Full interior and exterior coverage | Community and apartment amenities included | Blue sky replacement where needed | TV and fireplace screen replacements | Professional editing included | Delivered within 24 hours",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2024/09/Portfolio-59.jpg",
    thumbnailAlt: "Classic daytime photography interior example",
    priceTiers: tiers(250, 275, 325, 375, 475, 525),
  },
  {
    id:   "luxury-daytime-photography",
    name: "Luxury Daytime Photography",
    summary: "Story-driven photography that markets the home with intention. More time on location, selective framing with only the best angles of each space, not every corner. Elevated lighting, artistic compositions, and detail shots that tell a premium narrative. Recommended for listings $1M and above.",
    featureStr: "Extended on-site time for an unhurried, thorough shoot | Selective framing: best angles, not every angle | Architectural detail and feature shots | Light staging adjustments when needed | Enhanced lighting for depth and dimension | Professional editing included | Delivered within 24 hours",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2026/02/Altered-Photo-25-copy.jpg",
    thumbnailAlt: "Luxury daytime photography example",
    priceTiers: tiers(399, 449, 549, 649, 749, 849),
  },
  {
    id:   "drone-photos",
    name: "Drone Photos",
    summary: "Aerial exterior coverage from multiple altitudes and angles. Subject to FAA airspace authorization.",
    featureStr: "Approximately 15 images from varied altitudes | Multiple angles and a top-down shot | 24 hour turnaround",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2026/01/Standard-Real-Estate-Video-2-copy.jpg",
    thumbnailAlt: "Drone photo example exterior",
    priceTiers: tiers(299, 299, 299, 299, 299, 299),
  },
  {
    id:   "twilight-photography",
    name: "Twilight Photography",
    summary: "True golden and blue-hour exterior captures scheduled at dusk for maximum curb appeal.",
    featureStr: "6 to 10 professionally edited exterior photos | True twilight captures | Scheduled independently",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2026/01/1-web-or-mls-Photo-124.jpg",
    thumbnailAlt: "Real twilight photography example exterior",
    priceTiers: tiers(399, 449, 499, 549, 599, 675),
  },
  {
    id:   "cinematic-property-video",
    name: "Cinematic Property Video",
    summary: "A clean, 60-second horizontal video that shows off the home and gives buyers a reason to schedule a showing.",
    featureStr: "60 seconds, horizontal format | Full property coverage with aerial drone where allowed | Delivered within 48 to 72 hours | Vertical reel add-on available at $99 per 20 seconds",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/09/Video.jpg",
    thumbnailAlt: "Cinematic property video example thumbnail",
    priceTiers: tiers(375, 475, 525, 599, 699, 850),
  },
  {
    id:   "luxury-cinematic-video",
    name: "Luxury Cinematic Video",
    summary: "The most cinematic way to present a luxury listing. A dramatic day-to-night production that shows the home at its absolute best and signals to every buyer that this property is in a class of its own.",
    featureStr: "60 seconds, horizontal format | Daytime and twilight footage combined into one edit | Aerial drone included where allowed | Delivered within 48 to 72 hours | Vertical reel add-on available at $99 per 20 seconds",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2026/03/1-web-or-mls-Photo-124-copy.jpg",
    thumbnailAlt: "Luxury day to night video example thumbnail",
    priceTiers: tiers(899, 1099, 1199, 1299, 1499, 1699),
  },
  {
    id:   "signature-social-media-reel",
    name: "Signature Social Media Reel",
    summary: "Our Signature Reel is designed to elevate your presence and position you as a top-tier agent in the eyes of buyers and peers. One 1-hour shoot. Content that works as hard as you do.",
    featureStr: "Agent on camera throughout, intro, walkthrough, or both | 60 seconds or two 20-second cuts | Natively shot vertical for Reels, TikTok, and Shorts | Aerial drone included where allowed | Delivered within 48 to 72 hours",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/06/Social-Media-Reel-Real-Estate-copy.jpg",
    thumbnailAlt: "Social media reel agent on camera example",
    priceTiers: tiers(475, 575, 625, 699, 799, 950),
  },
  {
    id:   "matterport-3d-tour",
    name: "Matterport 3D Tour",
    summary: "The gold standard in immersive real estate tours. Buyers explore the home at their own pace, virtually walking every room, measuring spaces, and experiencing true depth before ever stepping foot inside.",
    featureStr: "Next day delivery | 4 months hosting or until sold | Extended hosting available",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/06/mp_realestate-dollhouse-copy.jpg",
    thumbnailAlt: "Matterport 3D tour example",
    priceTiers: tiers(250, 325, 425, 425, 599, 699),
  },
  {
    id:   "zillow-3d-tour",
    name: "Zillow 3D Tour",
    summary: "Integrates directly into your Zillow listing. Stays live until the listing sells or is removed from the MLS. No ongoing hosting fees.",
    featureStr: "Next day delivery | Ideal for Zillow Showcase listings | No ongoing hosting fees",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/06/fg.jpg",
    thumbnailAlt: "Zillow 3D tour example",
    priceTiers: tiers(250, 325, 425, 425, 599, 699),
  },
];

// ─── ADD-ONS ─────────────────────────────────────────────────────────────────

const ADDONS = [
  {
    id:       "property-outlines",
    name:     "Property Outlines",
    summary:  "Boundary lines overlaid on drone media to clearly define lot layout and property lines. Priced per image.",
    featureStr: "",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/06/019776a5-5e35-71bd-ac70-f6186c3ef5c0-scaled.jpeg",
    thumbnailAlt: "Property outlines example",
    pricingModel: "FIXED",
    price: 39,
    priceLabel: "$39 per image",
  },
  {
    id:       "digital-twilight-images",
    name:     "Digital Twilight Images",
    summary:  "Warm curb appeal without rescheduling. Priced per image.",
    featureStr: "48 hour delivery",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2026/03/1-web-or-mls-Altered-Image-Twilight-copy.jpg",
    thumbnailAlt: "Digital twilight enhancement example",
    pricingModel: "FIXED",
    price: 49,
    priceLabel: "$49 per image",
  },
  {
    id:       "hyper-local-stock",
    name:     "Hyper Local Stock",
    summary:  "Curated neighborhood clips and stills. Priced per image for your MLS listing.",
    featureStr: "",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/09/Hyper-Local-Stock-Photography-San-Diego-La-jolla.jpg",
    thumbnailAlt: "Hyper local stock media example",
    pricingModel: "FIXED",
    price: 39,
    priceLabel: "$39 per image",
  },
  {
    id:       "neighborhood-shots",
    name:     "Neighborhood Shots",
    summary:  "5 curated photos of the surrounding area within 5 miles. Pulled from our library or captured fresh.",
    featureStr: "5 photos within 5 miles of the property | Existing stock pulled or captured fresh | Ideal for highlighting walkability, views, and local character",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/09/Hyper-Local-Stock-Photography-San-Diego-La-jolla.jpg",
    thumbnailAlt: "Neighborhood shots example",
    pricingModel: "FIXED",
    price: 199,
    priceLabel: "$199",
  },
  {
    id:       "single-property-website",
    name:     "Single Property Website",
    summary:  "All media and property info in one shareable link.",
    featureStr: "",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2024/12/2024-12-27-12_16_45-San-Diego-Photographer-Rick-Ryan-Photography-—-Mozilla-Firefox.png",
    thumbnailAlt: "Single property website example",
    pricingModel: "FIXED",
    price: 79.99,
    priceLabel: "$79.99",
  },
  {
    id:       "2d-floor-plans",
    name:     "2D Floor Plans",
    summary:  "",
    featureStr: "Next day delivery | Room dimensions accurate to 97% | Optional styling available",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2024/10/Floor-Plans-scaled.jpg",
    thumbnailAlt: "2D floor plans example",
    pricingModel: "TIER_BASED",
    priceTiers: tiers(120, 120, 150, 180, 220, 260),
  },
  {
    id:       "3d-floor-plan",
    name:     "3D Floor Plan (Includes 2D)",
    summary:  "A dimensional 3D layout. Clean 2D floor plan included.",
    featureStr: "Next day delivery | Great for listing pages",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2026/01/Standard-Real-Estate-Video-2-copy-1.jpg",
    thumbnailAlt: "3D floor plan example",
    pricingModel: "TIER_BASED",
    priceTiers: tiers(220, 220, 250, 280, 320, 360),
  },
  {
    id:       "agent-on-camera",
    name:     "Agent On Camera",
    summary:  "On camera intro or walkthrough filmed during your video session.",
    featureStr: "Shot during your video session | Optimized for your delivery format",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/08/agent-on-camera.png",
    thumbnailAlt: "Agent on camera segment",
    pricingModel: "FIXED",
    price: 299,
    priceLabel: "$299",
  },
  {
    id:       "vertical-video-edit",
    name:     "Vertical Video Edit",
    summary:  "An add-on to any cinematic video order. We cut a vertical version optimized for Reels, TikTok, and Shorts. No separate shoot required.",
    featureStr: "Must be booked alongside a cinematic video | Vertical format delivery | Built for social media",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/06/Social-Media-Reel-Real-Estate-copy.jpg",
    thumbnailAlt: "Vertical video edit example",
    pricingModel: "FIXED",
    price: 99,
    priceLabel: "$99 per 20 seconds",
  },
  {
    id:       "ai-virtual-staging",
    name:     "AI Virtual Staging",
    summary:  "Furnish empty rooms digitally with modern, market-appropriate styles. Priced per image. Note: identical multiple angles of the same room are not supported.",
    featureStr: "Multiple style options per photo | Fast turnaround",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/09/Virtual-Staging.png",
    thumbnailAlt: "AI virtual staging example",
    pricingModel: "FIXED",
    price: 39,
    priceLabel: "$39 per image",
  },
  {
    id:       "traditional-virtual-staging",
    name:     "Traditional Virtual Staging",
    summary:  "Hand-crafted staging by our design team. More detailed and realistic than AI, ideal for high-end empty listings. Priced per image.",
    featureStr: "Designer-curated furniture and styling | Higher realism and detail than AI staging | Multiple style options available",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/09/Virtual-Staging.png",
    thumbnailAlt: "Traditional virtual staging example",
    pricingModel: "FIXED",
    price: 49,
    priceLabel: "$49 per image",
  },
  {
    id:       "green-grass-enhancement",
    name:     "Green Grass Enhancement",
    summary:  "Replaces dry or patchy lawns with lush, natural-looking grass.",
    featureStr: "48 hour delivery",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/09/Grass-Enhancer.png",
    thumbnailAlt: "Green grass enhancement example",
    pricingModel: "FIXED",
    price: 79,
    priceLabel: "$79",
  },
  {
    id:       "detail-photo-set",
    name:     "Detail Photo Set",
    summary:  "Architectural details, finishes, and features that wide-angle shots miss.",
    featureStr: "5 to 10 close-up detail photos | Ideal for luxury and design-forward listings",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/06/019776c5-fc99-7398-ad68-e95b6d5140f5.jpeg",
    thumbnailAlt: "Detail photo set example",
    pricingModel: "FIXED",
    price: 119,
    priceLabel: "$119",
  },
  {
    id:       "location-callouts",
    name:     "Location Callouts",
    summary:  "Distance and point-of-interest callouts overlaid on drone or map media. Priced per image.",
    featureStr: "48 hour delivery",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/06/Callouts.jpeg",
    thumbnailAlt: "Location callouts example",
    pricingModel: "FIXED",
    price: 99,
    priceLabel: "$99 per image",
  },
  {
    id:       "same-day-turnaround",
    name:     "Same Day Turnaround",
    summary:  "Photos by 8:30pm for shoots starting by 1:30pm.",
    featureStr: "",
    thumbnailUrl: "https://novacoastmedia.com/wp-content/uploads/2025/09/Photo-054.jpg",
    thumbnailAlt: "Same day turnaround example",
    pricingModel: "FIXED",
    price: 399,
    priceLabel: "$399",
  },
];

// ─── Main ────────────────────────────────────────────────────────────────────

async function clearCollection(ref) {
  const snap = await ref.get();
  if (snap.empty) return;
  const batch = ref.firestore.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  console.log(`  Cleared ${snap.size} existing docs from ${ref.path}`);
}

async function writeItems(ref, items, buildDoc) {
  for (const item of items) {
    const doc = buildDoc(item);
    if (dryRun) {
      console.log(`  [dry] Would write ${ref.path}/${item.id}:`, JSON.stringify(doc, null, 2).slice(0, 200));
    } else {
      await ref.doc(item.id).set(doc);
      console.log(`  ✓ ${item.name}`);
    }
  }
}

async function main() {
  const user = await getAuth().getUserByEmail(email);
  const db   = getFirestore();

  const snap = await db
    .collection("tenants")
    .where("ownerUid", "==", user.uid)
    .limit(1)
    .get();

  if (snap.empty) {
    console.error(`No tenant found for ${email}`);
    process.exit(1);
  }

  const tenantRef = snap.docs[0].ref;
  const tenantId  = snap.docs[0].id;
  console.log(`\nTenant: ${tenantId} (${snap.docs[0].data().businessName || email})`);
  if (dryRun) console.log("DRY RUN — no writes will occur\n");

  const pkgRef = tenantRef.collection("packages");
  const svcRef = tenantRef.collection("services");
  const addRef = tenantRef.collection("addons");

  // Clear existing
  if (!dryRun) {
    console.log("\nClearing existing catalog...");
    await clearCollection(pkgRef);
    await clearCollection(svcRef);
    await clearCollection(addRef);
  }

  const now = Timestamp.now();

  // Packages
  console.log("\nWriting packages...");
  await writeItems(pkgRef, PACKAGES, (p) => ({
    id:           p.id,
    name:         p.name,
    description:  p.summary,
    tagline:      p.tierTag || "",
    badge:        p.badge   || "",
    active:       true,
    thumbnailUrl: p.thumbnailUrl,
    thumbnailAlt: p.thumbnailAlt,
    pricingModel: "TIER_BASED",
    priceTiers:   p.priceTiers,
    features:     features(p.featureStr),
    createdAt:    now,
  }));

  // Services
  console.log("\nWriting services...");
  await writeItems(svcRef, SERVICES, (s) => ({
    id:           s.id,
    name:         s.name,
    description:  s.summary,
    active:       true,
    thumbnailUrl: s.thumbnailUrl,
    thumbnailAlt: s.thumbnailAlt,
    pricingModel: "TIER_BASED",
    priceTiers:   s.priceTiers,
    features:     features(s.featureStr),
    createdAt:    now,
  }));

  // Add-ons
  console.log("\nWriting add-ons...");
  await writeItems(addRef, ADDONS, (a) => {
    const base = {
      id:           a.id,
      name:         a.name,
      description:  a.summary,
      active:       true,
      thumbnailUrl: a.thumbnailUrl,
      thumbnailAlt: a.thumbnailAlt,
      pricingModel: a.pricingModel,
      features:     features(a.featureStr),
      createdAt:    now,
    };
    if (a.pricingModel === "TIER_BASED") {
      base.priceTiers = a.priceTiers;
    } else {
      base.price      = a.price;
      base.priceLabel = a.priceLabel;
    }
    return base;
  });

  const total = PACKAGES.length + SERVICES.length + ADDONS.length;
  console.log(`\n✓ Done. ${dryRun ? "Would write" : "Wrote"} ${total} products (${PACKAGES.length} packages, ${SERVICES.length} services, ${ADDONS.length} add-ons)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
