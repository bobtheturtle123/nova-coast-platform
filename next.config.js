/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["pub-placeholder.r2.dev"], // replace with your R2 public domain
  },
  // Required to use Firebase Admin in API routes
  serverExternalPackages: ["firebase-admin"],
};

module.exports = nextConfig;
