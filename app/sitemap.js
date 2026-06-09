import { adminDb } from "@/lib/firebase-admin";

const BASE = "https://kyoriaos.com";

export default async function sitemap() {
  const staticPages = [
    { url: BASE,                    lastModified: new Date(), changeFrequency: "monthly", priority: 1.0 },
    { url: `${BASE}/legal/privacy`, lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/legal/terms`,   lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/legal/cookies`, lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/guides`,                   lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/guides/getting-started`,   lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/guides/products`,          lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/guides/listings`,          lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/guides/team-schedule`,     lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/guides/payments`,          lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/guides/property-websites`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/guides/promo-codes`,       lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/guides/importing-clients`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/guides/ai-assistant`,      lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/guides/zapier`,            lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  // Tenant booking pages — canonical URL is /{slug}/book, NOT /{slug} which redirects
  let tenantPages = [];
  try {
    const snap = await adminDb.collection("tenants").get();
    tenantPages = snap.docs
      .map((doc) => doc.data().slug)
      .filter(Boolean)
      .map((slug) => ({
        url: `${BASE}/${slug}/book`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      }));
  } catch {}

  // Published property listing pages
  let propertyPages = [];
  try {
    const bookingSnap = await adminDb
      .collectionGroup("bookings")
      .where("propertyWebsite.published", "==", true)
      .limit(500)
      .get();

    const tenantIds = [...new Set(
      bookingSnap.docs.map((d) => d.data().tenantId).filter(Boolean)
    )];

    const tenantSnaps = await Promise.all(
      tenantIds.map((id) => adminDb.collection("tenants").doc(id).get())
    );
    const slugMap = Object.fromEntries(
      tenantSnaps.filter((d) => d.exists).map((d) => [d.id, d.data().slug])
    );

    propertyPages = bookingSnap.docs
      .map((d) => {
        const slug = slugMap[d.data().tenantId];
        if (!slug) return null;
        const publishedAt = d.data().propertyWebsite?.publishedAt;
        return {
          url: `${BASE}/${slug}/property/${d.id}`,
          lastModified: publishedAt ? new Date(publishedAt) : new Date(),
          changeFrequency: "weekly",
          priority: 0.7,
        };
      })
      .filter(Boolean);
  } catch {}

  return [...staticPages, ...tenantPages, ...propertyPages];
}
