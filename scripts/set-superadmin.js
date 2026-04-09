/**
 * One-time script: Grant superadmin claim to the platform owner.
 *
 * Usage:
 *   node scripts/set-superadmin.js owner@yourcompany.com
 *
 * Requirements:
 *   - FIREBASE_SERVICE_ACCOUNT_JSON in .env.local
 *   - The email must already have a Firebase Auth account (sign up at /auth/register first,
 *     then run this script to elevate their role)
 */

require("dotenv").config({ path: ".env.local" });
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth }      = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
}

const auth = getAuth();
const db   = getFirestore();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: node scripts/set-superadmin.js <email>");
    process.exit(1);
  }

  const user = await auth.getUserByEmail(email);

  // Set superadmin claim (removes any tenant claim)
  await auth.setCustomUserClaims(user.uid, { role: "superadmin" });

  // Remove from tenants collection if they were a tenant
  console.log(`✓ Superadmin claim set for ${email} (uid: ${user.uid})`);
  console.log("  They must sign out and back in for the new role to take effect.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
