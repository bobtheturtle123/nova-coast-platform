// scripts/set-scale.js
// Sets subscriptionPlan="scale" and subscriptionStatus="active" on the tenant
// owned by the given email address.
//
// Usage:
//   node scripts/set-scale.js your@email.com

require("dotenv").config({ path: ".env.local" });

const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth }             = require("firebase-admin/auth");
const { getFirestore }        = require("firebase-admin/firestore");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
initializeApp({ credential: cert(serviceAccount) });

const email = process.argv[2];

if (!email) {
  console.error("Usage: node scripts/set-scale.js your@email.com");
  process.exit(1);
}

async function main() {
  const user = await getAuth().getUserByEmail(email);
  const db   = getFirestore();

  const snap = await db
    .collection("tenants")
    .where("ownerUid", "==", user.uid)
    .limit(1)
    .get();

  if (snap.empty) {
    console.error(`No tenant found for ${email} (uid: ${user.uid})`);
    process.exit(1);
  }

  const doc = snap.docs[0];
  await doc.ref.update({
    subscriptionPlan:   "scale",
    subscriptionStatus: "active",
  });

  console.log(`✓ Tenant ${doc.id} (${doc.data().businessName || email}) is now scale/active`);
  console.log("  Reload the dashboard to see the change.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
