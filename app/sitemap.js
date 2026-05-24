import { adminDb } from "@/lib/firebase-admin";

const BASE = "https://app.kyoriaos.com";

export default async function sitemap() {
  const staticPages = [
    { url: BASE,                     lastModified: new Date(), changeFrequency: "monthly", priority: 1.0 },
    { url: `${BASE}/legal/privacy`,  lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/legal/terms`,    lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/legal/cookies`,  lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
  ];

  let tenantPages = [];
  try {
    const snap = await adminDb.collection("tenants").get();
    tenantPages = snap.docs
      .map((doc) => doc.data().slug)
      .filter(Boolean)
      .map((slug) => ({
        url: `${BASE}/${slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.8,
      }));
  } catch {}

  return [...staticPages, ...tenantPages];
}
