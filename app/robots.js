export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Only block pages where we can't serve noindex (truly private/internal).
        // Auth and onboarding pages are handled with noindex meta tags instead —
        // that way Googlebot can crawl them, read the noindex, and deindex them.
        disallow: [
          "/api/",
          "/dashboard/",
          "/superadmin/",
          "/admin/",
          "/onboarding/",
        ],
      },
    ],
    sitemap: "https://kyoriaos.com/sitemap.xml",
  };
}
