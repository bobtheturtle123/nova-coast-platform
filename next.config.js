/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.dev",
      },
      {
        protocol: "https",
        hostname: "**.cloudflare.com",
      },
    ],
  },
  experimental: {
    // Required to use Firebase Admin in API routes (Next.js 14)
    serverComponentsExternalPackages: ["firebase-admin", "sharp"],
  },
};

module.exports = nextConfig;
