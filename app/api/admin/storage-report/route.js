import { adminDb } from "@/lib/firebase-admin";
import { isSuperAdmin } from "@/lib/superadmin";
import {
  STORAGE_LIMIT_BYTES, WARN_80, WARN_90, GB, fmtBytes,
  monthlyStorageCostUsd, warnLevel, ACTION_THRESHOLDS, R2_STORAGE_USD_PER_GB_MONTH,
} from "@/lib/storage";
import {
  eligibleOriginals, eligibleVideoOriginals, isVideo, isPhoto, isWebSized,
  isPastRetention, deliveredAtMs,
} from "@/lib/retention";
import { MAX_INLINE_TRANSCODE_BYTES } from "@/lib/videoTranscode";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Superadmin storage + cost + cleanup report. This route is the single data
// source for the /admin/storage page. It is protected by isSuperAdmin (role
// claim + UID allowlist) — no tenant admin/manager/photographer/client can read
// it. All money is derived from R2_STORAGE_USD_PER_GB_MONTH in lib/storage.js.

const planPriceFor = (plan) => {
  const p = PLANS[plan];
  return p && typeof p.monthlyPrice === "number" ? p.monthlyPrice : null;
};
const planNameFor = (plan) => PLANS[plan]?.name || (plan ? String(plan) : "—");

// ── Growth projection assumptions ───────────────────────────────────────────
// Default subscriber plan mix used to estimate blended MRR + storage.
const PLAN_MIX = { solo: 0.40, studio: 0.35, pro: 0.20, scale: 0.05 };

// Per-listing media footprint (GB) that ultimately stays in R2. "original" is
// the full-res file held for the 1-year window; "web" is the optimized image /
// 1080p version kept long-term.
const PER_LISTING_GB = {
  light: { original: 0.8, web: 0.17 }, // typical real estate shoot, modest video
  heavy: { original: 8.0, web: 0.26 }, // 4K / drone, video-heavy listings
};

// Listing-cap utilization per scenario.
const UTIL = { typical: 0.5, heavy: 1.0 };

// Storage % of revenue → health verdict.
function marginVerdict(ratio) {
  if (ratio < 0.15) return { key: "healthy",    label: "This is healthy." };
  if (ratio < 0.30) return { key: "monitor",    label: "This needs monitoring." };
  return { key: "addon", label: "This may require storage add-ons." };
}

// Estimated steady-state GB held by one subscriber on `plan` under `scenario`.
// Originals roll off after ~1 year (so ≈ one year's worth held); web versions
// accumulate, modeled here at ~2 years of retention for a mature account.
function perSubscriberGB(plan, scenario) {
  const cap = PLANS[plan]?.activeListings || 0;
  const listings = cap * UTIL[scenario];
  const profile = scenario === "heavy" ? PER_LISTING_GB.heavy : PER_LISTING_GB.light;
  return listings * (profile.original + profile.web * 2);
}

function buildProjections(perGbRate) {
  const counts = [10, 25, 50, 100, 250, 500, 1000];
  const blendedMrr = Object.entries(PLAN_MIX)
    .reduce((s, [plan, w]) => s + w * (PLANS[plan]?.monthlyPrice || 0), 0);

  const scenario = (name) => {
    const gbPerSub = Object.entries(PLAN_MIX)
      .reduce((s, [plan, w]) => s + w * perSubscriberGB(plan, name), 0);
    const costPerSub = gbPerSub * perGbRate;
    const ratio = blendedMrr > 0 ? costPerSub / blendedMrr : 0;
    const verdict = marginVerdict(ratio);
    return {
      name,
      gbPerSub: +gbPerSub.toFixed(1),
      costPerSub: +costPerSub.toFixed(2),
      ratioPct: +(ratio * 100).toFixed(1),
      grossMarginPct: +((1 - ratio) * 100).toFixed(1),
      verdict: verdict.key, verdictLabel: verdict.label,
      rows: counts.map((n) => ({
        subscribers: n,
        mrr: +(n * blendedMrr).toFixed(0),
        storageCost: +(n * costPerSub).toFixed(2),
        costPerSub: +costPerSub.toFixed(2),
        ratioPct: +(ratio * 100).toFixed(1),
        grossMarginPct: +((1 - ratio) * 100).toFixed(1),
      })),
    };
  };

  return {
    assumptions: {
      planMix: PLAN_MIX,
      planPrices: Object.fromEntries(Object.keys(PLAN_MIX).map((p) => [p, PLANS[p]?.monthlyPrice ?? null])),
      planCaps:   Object.fromEntries(Object.keys(PLAN_MIX).map((p) => [p, PLANS[p]?.activeListings ?? null])),
      perGbMonthUsd: perGbRate,
      blendedMrrPerSub: +blendedMrr.toFixed(2),
      typical: { utilization: UTIL.typical, perListingGB: PER_LISTING_GB.light,
        note: "≈50% of listing limits, mostly light listings." },
      heavy:   { utilization: UTIL.heavy, perListingGB: PER_LISTING_GB.heavy,
        note: "Near listing limits, video-heavy listings." },
    },
    typical: scenario("typical"),
    heavy:   scenario("heavy"),
  };
}

// Recommended action for a single account.
function recommendAction({ pct, costRatio, oversizedBytes, usedBytes }) {
  const T = ACTION_THRESHOLDS;
  const oversizedDriving =
    oversizedBytes >= 100 * GB || (usedBytes > 0 && oversizedBytes / usedBytes >= 0.25);

  if (pct >= T.requireAddonPct || (costRatio != null && costRatio >= T.requireAddonCostRatio)) {
    return "require_addon";
  }
  if (pct >= T.contactPct || oversizedDriving) return "contact";
  if (pct >= T.watchPct || (costRatio != null && costRatio >= T.watchCostRatio)) return "watch";
  return "normal";
}

export async function GET(req) {
  if (!await isSuperAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();

  // Prepared-ZIP usage, grouped per tenant, plus platform-level stats.
  const zipByTenant = {};
  let preparedZipBytes = 0, preparedReady = 0, preparedExpiredEligible = 0;
  const failedJobs = [];
  try {
    const zipSnap = await adminDb.collection("preparedZips").get();
    for (const z of zipSnap.docs) {
      const d = z.data();
      if (d.status === "ready") {
        preparedReady++;
        preparedZipBytes += Number(d.sizeBytes) || 0;
        if (d.tenantId) zipByTenant[d.tenantId] = (zipByTenant[d.tenantId] || 0) + (Number(d.sizeBytes) || 0);
      }
      if (d.status === "failed") failedJobs.push({ jobId: z.id, galleryId: d.galleryId, error: d.error, createdAt: d.createdAt });
      const exp = d.expiresAt && new Date(d.expiresAt).getTime() < now;
      if (exp && d.status !== "expired") preparedExpiredEligible++;
    }
  } catch { /* collection may not exist yet */ }

  const tenantsSnap = await adminDb.collection("tenants").get();

  const tenants = [];
  const oversizedVideos = [];
  const largestFiles = [];

  // Platform accumulators.
  const platformByType = {
    photoOriginal: 0, webImage: 0, videoOriginal: 0, webVideo: 0,
    floorPlan: 0, document: 0, preparedZip: preparedZipBytes, other: 0,
  };
  let platformBytes = 0, platformEligibleBytes = 0, platformEligiblePhotos = 0, platformEligibleVideos = 0;
  let platformEligiblePhotoBytes = 0, platformEligibleVideoBytes = 0;

  for (const tDoc of tenantsSnap.docs) {
    const t = tDoc.data();
    const tenantId = tDoc.id;
    const plan = t.subscriptionPlan || null;
    const planPrice = planPriceFor(plan);

    // Per-tenant type breakdown derived from actual files (more granular than
    // the running counters, which don't separate originals from web versions).
    const byType = {
      photoOriginal: 0, webImage: 0, videoOriginal: 0, webVideo: 0,
      floorPlan: 0, document: 0, preparedZip: zipByTenant[tenantId] || 0, other: 0,
    };
    let eligiblePhotoBytes = 0, eligibleVideoBytes = 0, eligiblePhotos = 0, eligibleVideos = 0;
    let oversizedBytes = 0; // skipped_large / preserved video originals

    const galSnap = await adminDb.collection("tenants").doc(tenantId).collection("galleries").get();
    for (const g of galSnap.docs) {
      const gallery = g.data();
      const galleryName = gallery.title || gallery.bookingAddress || gallery.address || g.id;

      // Cleanup eligibility (past 1-year retention).
      const { items: pItems, bytes: pBytes } = eligibleOriginals(gallery, now);
      const { items: vItems, bytes: vBytes } = eligibleVideoOriginals(gallery, now);
      eligiblePhotos += pItems.length; eligiblePhotoBytes += pBytes;
      eligibleVideos += vItems.length; eligibleVideoBytes += vBytes;

      const past = isPastRetention(gallery, now);

      for (const m of (gallery.media || [])) {
        const size = Number(m.size) || 0;
        if (isVideo(m)) {
          if (m.originalRemoved) {
            byType.webVideo += Number(m.webVideoBytes) || 0;
          } else {
            byType.videoOriginal += size;
            if (m.webVideoBytes) byType.webVideo += Number(m.webVideoBytes) || 0;
          }
          // Oversized / preserved video detection.
          const tooBig = size > MAX_INLINE_TRANSCODE_BYTES;
          const noWeb  = !m.webVideoKey || m.webVideoStatus !== "ready";
          if ((m.webVideoStatus === "skipped_large" || (tooBig && noWeb)) && !m.originalRemoved) {
            oversizedBytes += size;
            const blocking = past && noWeb; // past retention but can't remove (no web version)
            oversizedVideos.push({
              tenantId, tenantName: t.businessName || t.name || tenantId,
              galleryId: g.id, galleryName,
              fileName: m.fileName || m.key?.split("/").pop() || "video",
              sizeBytes: size, size: fmtBytes(size),
              deliveredAt: deliveredAtMs(gallery),
              reason: m.webVideoError ? `Transcode failed: ${m.webVideoError}` : "Too large to transcode in serverless",
              hasWebVersion: !!(m.webVideoKey && m.webVideoStatus === "ready"),
              blockingCleanup: blocking,
              recommendedAction: blocking ? "external_processing" : "leave_preserved",
            });
          }
        } else if (isPhoto(m)) {
          if (m.originalRemoved || isWebSized(m)) byType.webImage += size;
          else byType.photoOriginal += size;
        } else {
          byType.document += size;
        }
        if (size > 0) largestFiles.push({
          tenantId, tenantName: t.businessName || t.name || tenantId, galleryId: g.id,
          fileName: m.fileName || m.key, fileType: m.fileType || "", sizeBytes: size,
        });
      }

      for (const fp of (gallery.floorPlans || []))    byType.floorPlan += Number(fp.size) || 0;
      for (const f  of (gallery.attachedFiles || [])) byType.document  += Number(f.size)  || 0;
    }

    // Authoritative total = running counter, reconciled against the file scan.
    const counterTotal = Math.max(0, t.storage?.totalBytes || 0);
    const scannedTotal = byType.photoOriginal + byType.webImage + byType.videoOriginal +
      byType.webVideo + byType.floorPlan + byType.document + byType.preparedZip;
    const usedBytes = Math.max(counterTotal, scannedTotal);
    byType.other = Math.max(0, usedBytes - scannedTotal); // reconcile untracked bytes

    const eligibleBytes = eligiblePhotoBytes + eligibleVideoBytes;
    const afterCleanupBytes = Math.max(0, usedBytes - eligibleBytes);

    const costNow   = monthlyStorageCostUsd(usedBytes);
    const costAfter = monthlyStorageCostUsd(afterCleanupBytes);
    const costRatio = planPrice ? costNow / planPrice : null;
    const pct = usedBytes / STORAGE_LIMIT_BYTES;
    const action = recommendAction({ pct, costRatio, oversizedBytes, usedBytes });

    // Roll up platform type totals.
    for (const k of Object.keys(byType)) if (k !== "preparedZip") platformByType[k] += byType[k];
    platformBytes += usedBytes;
    platformEligibleBytes += eligibleBytes;
    platformEligiblePhotos += eligiblePhotos; platformEligibleVideos += eligibleVideos;
    platformEligiblePhotoBytes += eligiblePhotoBytes; platformEligibleVideoBytes += eligibleVideoBytes;

    tenants.push({
      tenantId,
      name: t.businessName || t.name || tenantId,
      plan, planName: planNameFor(plan), planPrice,
      usedBytes, used: fmtBytes(usedBytes),
      pct: +(pct * 100).toFixed(2),
      warnLevel: warnLevel(usedBytes),
      costNow: +costNow.toFixed(2),
      costRatioPct: costRatio != null ? +(costRatio * 100).toFixed(1) : null,
      eligibleBytes, eligibleSaved: fmtBytes(eligibleBytes),
      eligiblePhotos, eligiblePhotoBytes, eligiblePhotoSaved: fmtBytes(eligiblePhotoBytes),
      eligibleVideos, eligibleVideoBytes, eligibleVideoSaved: fmtBytes(eligibleVideoBytes),
      costAfter: +costAfter.toFixed(2),
      oversizedBytes, oversized: fmtBytes(oversizedBytes),
      action,
      byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, { bytes: v, pretty: fmtBytes(v) }])),
    });
  }

  tenants.sort((a, b) => b.usedBytes - a.usedBytes);
  largestFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);
  oversizedVideos.sort((a, b) => b.sizeBytes - a.sizeBytes);

  // Retention runs: latest overall, latest dry-run, latest execute.
  let lastRun = null, lastDryRun = null, lastExecute = null;
  try {
    const runSnap = await adminDb.collection("retentionRuns").orderBy("at", "desc").limit(25).get();
    const runs = runSnap.docs.map((d) => d.data());
    const norm = (r) => r && ({
      mode: r.mode, at: r.at,
      eligibleFiles: r.eligibleFiles || 0, eligible: fmtBytes(r.eligibleBytes || 0),
      removedFiles: r.removedFiles || 0, removed: fmtBytes(r.removedBytes || 0),
      videosSkippedLarge: r.videosSkippedLarge || 0, errors: r.errors || 0,
    });
    lastRun     = norm(runs[0]);
    lastDryRun  = norm(runs.find((r) => r.mode === "DRY_RUN"));
    lastExecute = norm(runs.find((r) => r.mode === "EXECUTE"));
  } catch { /* single-field index auto-created; ignore if missing */ }

  // Platform totals.
  const platformCostNow   = monthlyStorageCostUsd(platformBytes);
  const platformCostAfter = monthlyStorageCostUsd(Math.max(0, platformBytes - platformEligibleBytes));
  const over80 = tenants.filter((t) => t.usedBytes >= WARN_80).length;
  const over90 = tenants.filter((t) => t.usedBytes >= WARN_90).length;
  const near100 = tenants.filter((t) => t.warnLevel === "100").length;
  const needAddon = tenants.filter((t) => t.action === "require_addon").length;

  return Response.json({
    generatedAt: new Date().toISOString(),
    pricing: {
      perGbMonthUsd: R2_STORAGE_USD_PER_GB_MONTH,
      capBytes: STORAGE_LIMIT_BYTES,
      capPretty: fmtBytes(STORAGE_LIMIT_BYTES),
      egressNote:
        "Customer downloads are served directly from R2 using pre-signed URLs and do not stream " +
        "through Vercel. R2 currently has free internet egress, so storage is the primary " +
        "infrastructure cost to monitor.",
    },
    platform: {
      totalTenants: tenants.length,
      totalBytes: platformBytes, totalPretty: fmtBytes(platformBytes),
      costNow: +platformCostNow.toFixed(2),
      costAfter: +platformCostAfter.toFixed(2),
      eligibleBytes: platformEligibleBytes, eligibleSaved: fmtBytes(platformEligibleBytes),
      eligiblePhotos: platformEligiblePhotos, eligibleVideos: platformEligibleVideos,
      eligiblePhotoSaved: fmtBytes(platformEligiblePhotoBytes),
      eligibleVideoSaved: fmtBytes(platformEligibleVideoBytes),
      over80, over90, near100, needAddon,
      oversizedVideos: oversizedVideos.length,
      byType: Object.fromEntries(Object.entries(platformByType).map(([k, v]) => [k, { bytes: v, pretty: fmtBytes(v) }])),
    },
    projections: buildProjections(R2_STORAGE_USD_PER_GB_MONTH),
    tenants,
    oversizedVideos,
    topFiles: largestFiles.slice(0, 20).map((f) => ({ ...f, size: fmtBytes(f.sizeBytes) })),
    retention: { lastRun, lastDryRun, lastExecute },
    preparedZips: {
      ready: preparedReady,
      storageUsed: fmtBytes(preparedZipBytes),
      expiredEligibleForCleanup: preparedExpiredEligible,
      failedJobs,
    },
  });
}
