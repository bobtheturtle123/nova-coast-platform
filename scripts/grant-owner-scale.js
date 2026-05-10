/**
 * One-time setup: grant superadmin claim + permanent Scale plan to a platform owner.
 *
 * Usage:
 *   node scripts/grant-owner-scale.js owner@yourcompany.com
 *
 * Safe to run multiple times — idempotent.
 * The account must already exist (sign up at /auth/register first).
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
    console.error("Usage: node scripts/grant-owner-scale.js <email>");
    process.exit(1);
  }

  // 1. Look up the user
  const user = await auth.getUserByEmail(email);
  console.log(`Found user: ${user.uid}  (${email})`);

  // 2. Set superadmin claim on their Firebase Auth account
  await auth.setCustomUserClaims(user.uid, { role: "superadmin" });
  console.log(`✓ Superadmin claim set`);
  console.log(`  → Add this UID to SUPERADMIN_UIDS in Vercel env: ${user.uid}`);

  // 3. Find their tenant document by ownerUid
  const tenantSnap = await db
    .collection("tenants")
    .where("ownerUid", "==", user.uid)
    .limit(1)
    .get();

  if (tenantSnap.empty) {
    console.log("\n⚠  No tenant found for this user.");
    console.log("   If they haven't completed onboarding yet, run this script again after they do.");
    return;
  }

  const tenantRef = tenantSnap.docs[0].ref;
  const tenantId  = tenantSnap.docs[0].id;

  await tenantRef.update({
    permanentPlan:        "scale",
    subscriptionPlan:     "scale",
    subscriptionStatus:   "active",
    stripeSubscriptionId: "manual_override",
    trialEndsAt:          null,
  });

  console.log(`✓ Tenant ${tenantId} set to permanentPlan: "scale" (permanent, Stripe-independent)`);
  console.log("\nDone. Sign out and back in to refresh the JWT token.");
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
