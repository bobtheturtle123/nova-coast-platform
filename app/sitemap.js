const BASE = "https://kyoriaos.com";

export default async function sitemap() {
  // Load firebase-admin lazily so a missing service account / env can never 500
  // the sitemap — the static marketing + guide URLs must always be served.
  let adminDb = null;
  try { ({ adminDb } = await import("@/lib/firebase-admin")); } catch { adminDb = null; }

  const staticPages = [
    { url: BASE,                    lastModified: new Date(), changeFrequency: "monthly", priority: 1.0 },
    { url: `${BASE}/privacy`,       lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/terms`,         lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/cookies`,       lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/sms-consent`,   lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/legal/dpa`,             lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/legal/acceptable-use`,  lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/legal/media-policy`,    lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
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
    { url: `${BASE}/guides/dropbox-import`,    lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/guides/cubicasa-import`,   lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/guides/3d-tours`,          lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  // Tenant booking pages (/{slug}/book) are intentionally EXCLUDED from the sitemap.
  // They are near-duplicate templates marked noindex,follow (see app/[slug]/book/layout.js),
  // so listing them would tell Google to index pages we are asking it not to index.

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

  return [...staticPages, ...propertyPages];
}
