// scripts/set-admin.js
// Run once to make yourself an admin:
//   node scripts/set-admin.js your@email.com
//
// Requirements:
//   npm install firebase-admin dotenv
//   Set FIREBASE_SERVICE_ACCOUNT_JSON in your .env.local

require("dotenv").config({ path: ".env.local" });

const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth }             = require("firebase-admin/auth");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
initializeApp({ credential: cert(serviceAccount) });

const email = process.argv[2];

if (!email) {
  console.error("Usage: node scripts/set-admin.js your@email.com");
  process.exit(1);
}

getAuth()
  .getUserByEmail(email)
  .then((user) => getAuth().setCustomUserClaims(user.uid, { admin: true }))
  .then(() => {
    console.log(`✓ Admin claim set for ${email}`);
    console.log("  Sign out and back in for the claim to take effect.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  });
