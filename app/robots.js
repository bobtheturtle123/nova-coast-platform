export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/superadmin/",
          "/admin/",
          "/auth/",
          "/onboarding/",
        ],
      },
    ],
    sitemap: "https://kyoriaos.com/sitemap.xml",
  };
}
