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
    sitemap: "https://app.kyoriaos.com/sitemap.xml",
  };
}
