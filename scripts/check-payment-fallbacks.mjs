#!/usr/bin/env node
// Repository guard: fails CI when a new platform-only tenant-customer payment
// path is introduced.
//
// Rules enforced:
//  1. Direct `stripe.paymentIntents.create` / `stripe.checkout.sessions.create`
//     calls are only allowed in the explicit allowlist below. Tenant client
//     payments must go through createConnectedPaymentIntent /
//     buildConnectedSessionPaymentData (lib/stripe.js), which attach the
//     verified destination + canonical fee.
//  2. Files that create tenant-client payments must call
//     requireTenantPaymentAccount (fail-closed validation).

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();

// Files allowed to call stripe payment-creation APIs directly:
const CREATE_ALLOWLIST = new Set([
  // Canonical connected helpers — the ONLY place tenant client PIs are made.
  "lib/stripe.js",
  // Platform revenue (KyoriaOS's own products — subscriptions/topups/seats/AgentPro):
  "app/api/billing/subscribe/route.js",
  "app/api/billing/topup/route.js",
  "app/api/billing/seats/route.js",
  "app/api/billing/agent-pro/route.js",
  "app/api/[slug]/agent/billing/route.js",
  // Tenant-client CHECKOUT SESSION creators — must also pass rule 2 below:
  "app/api/dashboard/bookings/[id]/send-invoice/route.js",
  "app/api/dashboard/bookings/[id]/send-reminder/route.js",
  "app/api/dashboard/bookings/[id]/send-deposit/route.js",
]);

// Tenant-client payment files that MUST contain fail-closed validation:
const MUST_VALIDATE = [
  "app/api/[slug]/bookings/create/route.js",
  "app/api/[slug]/payment/create-balance-intent/route.js",
  "app/api/payment/create-balance-intent/route.js",
  "app/api/dashboard/bookings/[id]/send-invoice/route.js",
  "app/api/dashboard/bookings/[id]/send-reminder/route.js",
  "app/api/dashboard/bookings/[id]/send-deposit/route.js",
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === ".git") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".js") || name.endsWith(".mjs")) out.push(p);
  }
  return out;
}

const failures = [];
const files = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "lib"))];

for (const file of files) {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  const src = readFileSync(file, "utf8");
  if (/paymentIntents\.create|checkout\.sessions\.create|charges\.create\(/.test(src)) {
    if (!CREATE_ALLOWLIST.has(rel)) {
      failures.push(`${rel}: creates a Stripe payment outside the allowlist — tenant client payments must use the connected helpers in lib/stripe.js (see scripts/check-payment-fallbacks.mjs).`);
    }
  }
}

for (const rel of MUST_VALIDATE) {
  try {
    const src = readFileSync(join(ROOT, rel), "utf8");
    if (!src.includes("requireTenantPaymentAccount")) {
      failures.push(`${rel}: tenant client payment route is missing requireTenantPaymentAccount (fail-closed Connect validation).`);
    }
  } catch {
    // File removed/renamed — fine; the allowlist above still guards creation.
  }
}

if (failures.length) {
  console.error("✖ Payment-fallback guard failed:\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log(`✓ Payment-fallback guard passed (${files.length} files scanned).`);
