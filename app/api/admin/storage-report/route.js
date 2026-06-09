import { adminDb } from "@/lib/firebase-admin";
import { isSuperAdmin } from "@/lib/superadmin";
import { STORAGE_LIMIT_BYTES, WARN_80, fmtBytes } from "@/lib/storage";
import { eligibleOriginals } from "@/lib/retention";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Admin storage + cleanup report. Superadmin-only.
//
// Returns: total R2 storage, by account, by type, largest 20 accounts,
// largest 20 files, accounts over 80%, full-res photos eligible for cleanup +
// estimated savings, the latest dry-run result, prepared-ZIP storage usage,
// expired prepared ZIPs eligible for cleanup, and failed prepared-ZIP jobs.

export async function GET(req) {
  if (!await isSuperAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  const tenantsSnap = await adminDb.collection("tenants").get();

  const accounts = [];      // per-account storage rows
  const largestFiles = [];  // candidate largest files (bounded)
  let totalBytes = 0;
  const byType = { photoBytes: 0, videoBytes: 0, documentBytes: 0, floorPlanBytes: 0 };
  let eligibleFiles = 0, eligibleBytes = 0, galleriesPastRetention = 0;

  for (const tDoc of tenantsSnap.docs) {
    const t = tDoc.data();
    const s = t.storage || {};
    const used = Math.max(0, s.totalBytes || 0);
    totalBytes += used;
    byType.photoBytes     += Math.max(0, s.photoBytes || 0);
    byType.videoBytes     += Math.max(0, s.videoBytes || 0);
    byType.documentBytes  += Math.max(0, s.documentBytes || 0);
    byType.floorPlanBytes += Math.max(0, s.floorPlanBytes || 0);

    accounts.push({
      tenantId: tDoc.id,
      name: t.businessName || t.name || tDoc.id,
      plan: t.subscriptionPlan || "—",
      usedBytes: used,
      pct: used / STORAGE_LIMIT_BYTES,
      over80: used >= WARN_80,
    });

    // Scan this tenant's galleries for cleanup eligibility + largest files.
    const galSnap = await adminDb
      .collection("tenants").doc(tDoc.id).collection("galleries").get();
    for (const g of galSnap.docs) {
      const gallery = g.data();
      const { items, bytes } = eligibleOriginals(gallery, now);
      if (items.length) {
        galleriesPastRetention++;
        eligibleFiles += items.length;
        eligibleBytes += bytes;
      }
      for (const m of (gallery.media || [])) {
        const size = Number(m.size) || 0;
        if (size > 0) largestFiles.push({
          tenantId: tDoc.id, galleryId: g.id, fileName: m.fileName || m.key,
          fileType: m.fileType || "", sizeBytes: size,
        });
      }
    }
  }

  // Largest 20 accounts + 20 files.
  const topAccounts = [...accounts].sort((a, b) => b.usedBytes - a.usedBytes).slice(0, 20)
    .map((a) => ({ ...a, used: fmtBytes(a.usedBytes), pct: +(a.pct * 100).toFixed(2) }));
  const topFiles = largestFiles.sort((a, b) => b.sizeBytes - a.sizeBytes).slice(0, 20)
    .map((f) => ({ ...f, size: fmtBytes(f.sizeBytes) }));
  const over80 = accounts.filter((a) => a.over80)
    .map((a) => ({ tenantId: a.tenantId, name: a.name, used: fmtBytes(a.usedBytes), pct: +(a.pct * 100).toFixed(2) }));

  // Prepared-ZIP storage usage + cleanup candidates + failed jobs.
  const zipSnap = await adminDb.collection("preparedZips").get();
  let preparedZipBytes = 0, preparedReady = 0, preparedExpiredEligible = 0;
  const failedJobs = [];
  for (const z of zipSnap.docs) {
    const d = z.data();
    if (d.status === "ready") { preparedReady++; preparedZipBytes += Number(d.sizeBytes) || 0; }
    if (d.status === "failed") failedJobs.push({ jobId: z.id, galleryId: d.galleryId, error: d.error, createdAt: d.createdAt });
    const exp = d.expiresAt && new Date(d.expiresAt).getTime() < now;
    if (exp && d.status !== "expired") preparedExpiredEligible++;
  }

  // Latest retention dry-run / execute result.
  let lastRetentionRun = null;
  try {
    const runSnap = await adminDb.collection("retentionRuns").orderBy("at", "desc").limit(1).get();
    if (!runSnap.empty) {
      const r = runSnap.docs[0].data();
      lastRetentionRun = {
        mode: r.mode, at: r.at, eligibleFiles: r.eligibleFiles, eligibleBytes: r.eligibleBytes,
        eligible: fmtBytes(r.eligibleBytes || 0), removedFiles: r.removedFiles,
        removed: fmtBytes(r.removedBytes || 0), errors: r.errors,
      };
    }
  } catch { /* index may be missing */ }

  return Response.json({
    generatedAt: new Date().toISOString(),
    limitPerAccount: fmtBytes(STORAGE_LIMIT_BYTES),
    totals: {
      bytes: totalBytes,
      pretty: fmtBytes(totalBytes),
      byType: {
        photo:     fmtBytes(byType.photoBytes),
        video:     fmtBytes(byType.videoBytes),
        document:  fmtBytes(byType.documentBytes),
        floorPlan: fmtBytes(byType.floorPlanBytes),
      },
      accounts: accounts.length,
    },
    topAccounts,
    topFiles,
    over80,
    cleanup: {
      galleriesPastRetention,
      eligibleFiles,
      eligibleBytes,
      estimatedSaved: fmtBytes(eligibleBytes),
      lastRetentionRun,
    },
    preparedZips: {
      ready: preparedReady,
      storageUsed: fmtBytes(preparedZipBytes),
      expiredEligibleForCleanup: preparedExpiredEligible,
      failedJobs,
    },
  });
}
