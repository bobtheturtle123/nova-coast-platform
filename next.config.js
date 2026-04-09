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
  // Required to use Firebase Admin in API routes
  serverExternalPackages: ["firebase-admin", "sharp"],
};

module.exports = nextConfig;
