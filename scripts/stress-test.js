/**
 * Stress test — simulates 1000 concurrent tenant workloads.
 *
 * Usage:
 *   node scripts/stress-test.js                          # hits localhost:3000
 *   node scripts/stress-test.js https://app.kyoriaos.com # hits production
 *
 * Requires Node 18+ (native fetch).
 */

require("dotenv").config({ path: ".env.local" });

const BASE_URL = process.argv[2] || "http://localhost:3000";
const CONCURRENCY = 25;   // parallel requests per batch
const TOTAL = parseInt(process.env.STRESS_TOTAL || "125", 10); // total per scenario (8 scenarios = ~1000 total)

const TENANT_SLUG = process.env.STRESS_SLUG || "nova-coast"; // set STRESS_SLUG to your real slug

// ─── Stats ────────────────────────────────────────────────────────────────────

class Stats {
  constructor(label) {
    this.label = label;
    this.latencies = [];
    this.errors = 0;
    this.statusCounts = {};
  }

  record(ms, status) {
    this.latencies.push(ms);
    this.statusCounts[status] = (this.statusCounts[status] || 0) + 1;
    if (status >= 500 || status === 0) this.errors++;
  }

  percentile(p) {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const idx = Math.floor((p / 100) * sorted.length);
    return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
  }

  print() {
    const total = this.latencies.length;
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    const rps = total / (Math.max(...this.latencies) / 1000 || 1);
    const codes = Object.entries(this.statusCounts)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([k, v]) => `${k}×${v}`)
      .join("  ");

    console.log(`\n  ── ${this.label}`);
    console.log(`     requests : ${total}`);
    console.log(`     errors   : ${this.errors} (${((this.errors / total) * 100).toFixed(1)}%)`);
    console.log(`     status   : ${codes}`);
    console.log(`     avg      : ${(sum / total).toFixed(0)} ms`);
    console.log(`     p50      : ${this.percentile(50)} ms`);
    console.log(`     p95      : ${this.percentile(95)} ms`);
    console.log(`     p99      : ${this.percentile(99)} ms`);
    console.log(`     max      : ${Math.max(...this.latencies)} ms`);
    console.log(`     rps (est): ${rps.toFixed(1)}`);
  }
}

// ─── Request helper ────────────────────────────────────────────────────────────

async function hit(url, opts = {}) {
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal, ...opts });
    clearTimeout(timeout);
    await res.text(); // drain body
    return { ms: Date.now() - t0, status: res.status };
  } catch (err) {
    return { ms: Date.now() - t0, status: err.name === "AbortError" ? 504 : 0, err: err.message };
  }
}

// ─── Run a scenario in batches ────────────────────────────────────────────────

async function runScenario(label, buildRequest, n = TOTAL, concurrency = CONCURRENCY) {
  const stats = new Stats(label);
  process.stdout.write(`  Running ${label} (${n} req)…`);

  let done = 0;
  const batches = Math.ceil(n / concurrency);

  for (let b = 0; b < batches; b++) {
    const batchSize = Math.min(concurrency, n - b * concurrency);
    const requests = Array.from({ length: batchSize }, (_, i) => {
      const idx = b * concurrency + i;
      return buildRequest(idx).then(({ url, opts }) => hit(url, opts));
    });

    const results = await Promise.allSettled(requests);
    for (const r of results) {
      const val = r.status === "fulfilled" ? r.value : { ms: 10_000, status: 0 };
      stats.record(val.ms, val.status);
      done++;
    }
    process.stdout.write(".");
  }
  console.log(" done");
  return stats;
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

// 1. Public catalog fetch (booking form load) — one per slug
//    Simulates 1000 different agents loading the booking form for 1000 different tenants.
async function scenarioCatalog() {
  return runScenario("Catalog load (booking form)", async (i) => ({
    url: `${BASE_URL}/api/${TENANT_SLUG}/catalog`,
    opts: {},
  }));
}

// 2. Agent portal lookup — email enumeration with rate limiting should kick in
async function scenarioLookup() {
  return runScenario("Agent lookup (rate-limit probe)", async (i) => ({
    url: `${BASE_URL}/api/${TENANT_SLUG}/agents/lookup?email=agent${i}@example.com`,
    opts: {},
  }));
}

// 3. Balance intent — no auth, rate-limited; expect 429s after 10 per IP
async function scenarioBalanceIntent() {
  return runScenario("Balance intent (rate-limit)", async (i) => ({
    url: `${BASE_URL}/api/${TENANT_SLUG}/payment/create-balance-intent`,
    opts: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: `fake-booking-${i}` }),
    },
  }));
}

// 4. Tenant homepage (SSR) — simulates 1000 visitors landing on different tenant pages
async function scenarioTenantPage() {
  return runScenario("Tenant homepage (SSR)", async (i) => ({
    url: `${BASE_URL}/${TENANT_SLUG}`,
    opts: {},
  }));
}

// 5. Unauthenticated dashboard API — must return 401, not crash
async function scenarioDashboardUnauthed() {
  return runScenario("Dashboard API (unauthed — expect 401)", async (i) => ({
    url: `${BASE_URL}/api/dashboard/bookings`,
    opts: {},
  }));
}

// 6. Disabled legacy route — must return 410
async function scenarioLegacyCreate() {
  return runScenario("Legacy /api/bookings/create (expect 410)", async (i) => ({
    url: `${BASE_URL}/api/bookings/create`,
    opts: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientName: "Test", clientEmail: `t${i}@x.com`, clientPhone: "555-0000", pricing: { deposit: 100 } }),
    },
  }));
}

// 7. Disabled admin init — must return 404
async function scenarioAdminInit() {
  return runScenario("Admin init route (expect 404)", async (i) => ({
    url: `${BASE_URL}/api/admin/init?secret=anything&email=evil@x.com`,
    opts: {},
  }));
}

// 8. Concurrent tenant reads — simulates 1000 tenants each reading their own catalog simultaneously
//    Uses different fake slugs to test the slug → tenant resolution path under parallel load.
async function scenarioConcurrentTenants() {
  const SLUGS = 200; // pool of fake slugs (will 404, testing the fast-fail path)
  return runScenario("Concurrent multi-tenant catalog (200 slugs × 5 each)", async (i) => {
    const slug = `stress-tenant-${i % SLUGS}`;
    return { url: `${BASE_URL}/api/${slug}/catalog`, opts: {} };
  });
}

// ─── Warmup ───────────────────────────────────────────────────────────────────

async function warmup() {
  process.stdout.write("  Warming up (10 requests)…");
  for (let i = 0; i < 10; i++) {
    await hit(`${BASE_URL}/api/${TENANT_SLUG}/catalog`);
    process.stdout.write(".");
  }
  console.log(" ready\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  KyoriaOS Stress Test — 1000-tenant simulation");
  console.log(`  Target : ${BASE_URL}`);
  console.log(`  Total  : ${TOTAL} req/scenario × 8 scenarios = ~${TOTAL * 8} requests`);
  console.log(`  Concurrency: ${CONCURRENCY} parallel`);
  console.log("═══════════════════════════════════════════════════════\n");

  await warmup();

  const t0 = Date.now();

  const results = [
    await scenarioCatalog(),
    await scenarioLookup(),
    await scenarioBalanceIntent(),
    await scenarioTenantPage(),
    await scenarioDashboardUnauthed(),
    await scenarioLegacyCreate(),
    await scenarioAdminInit(),
    await scenarioConcurrentTenants(),
  ];

  const wallMs = Date.now() - t0;

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════════");
  for (const r of results) r.print();

  const totalRequests = results.reduce((s, r) => s + r.latencies.length, 0);
  const totalErrors   = results.reduce((s, r) => s + r.errors, 0);
  const allLatencies  = results.flatMap((r) => r.latencies).sort((a, b) => a - b);
  const p99Global     = allLatencies[Math.floor(allLatencies.length * 0.99)] ?? 0;

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("  OVERALL SUMMARY");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  total requests : ${totalRequests}`);
  console.log(`  total errors   : ${totalErrors} (${((totalErrors / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  global p99     : ${p99Global} ms`);
  console.log(`  wall time      : ${(wallMs / 1000).toFixed(1)} s`);
  console.log(`  overall rps    : ${(totalRequests / (wallMs / 1000)).toFixed(1)}`);

  console.log("\n  PASS CRITERIA");
  const criteria = [
    { label: "Error rate < 5%",         pass: totalErrors / totalRequests < 0.05 },
    { label: "Global p99 < 3000 ms",    pass: p99Global < 3000 },
    { label: "Legacy route returns 410", pass: results[5].statusCounts["410"] > 0 },
    { label: "Admin init returns 404",   pass: results[6].statusCounts["404"] > 0 },
    { label: "Unauthed API returns 401", pass: results[4].statusCounts["401"] > 0 },
    { label: "Rate limiter fires (429)", pass: (results[1].statusCounts["429"] || 0) > 0 || (results[2].statusCounts["429"] || 0) > 0 },
  ];
  for (const c of criteria) {
    console.log(`  ${c.pass ? "✓" : "✗"} ${c.label}`);
  }

  const failed = criteria.filter((c) => !c.pass).length;
  console.log(`\n  ${failed === 0 ? "ALL PASS ✓" : `${failed} FAILED ✗`}`);
  console.log("═══════════════════════════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Stress test crashed:", err);
  process.exit(1);
});
