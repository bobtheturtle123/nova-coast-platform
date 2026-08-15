import { adminDb } from "@/lib/firebase-admin";
import { enqueueZipBuild } from "@/lib/zipJobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Reconciliation cron for the background ZIP builds. It does NO heavy work — it
// only enqueues jobs on the Cloudflare Worker for any deliverable gallery whose
// current file set differs from its last-built package (adds / replaces / deletes
// / renames / recategorizes all change fileSetHash, so this catches them all).
//
// This is the safety net; the primary trigger is on-demand from /api/gallery/zip-url
// when an agent actually clicks "Download Everything" (which serves the previous
// ZIP immediately and rebuilds in the background). enqueueZipBuild is idempotent,
// so a gallery already ready or in flight is skipped cheaply.

const PER_RUN = 200; // just HTTP enqueues — cheap

export async function GET(req) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return new Response("Server misconfiguration", { status: 500 });
  if (authHeader !== `Bearer ${cronSecret}`) return new Response("Unauthorized", { status: 401 });

  if (!process.env.ZIP_WORKER_URL || !process.env.ZIP_SECRET) {
    return Response.json({ skipped: "zip worker not configured" });
  }

  const report = { scanned: 0, enqueued: 0, skipped: 0 };

  const tenantsSnap = await adminDb.collection("tenants").get();
  outer:
  for (const tenantDoc of tenantsSnap.docs) {
    const tenantId   = tenantDoc.id;
    const autoRename = tenantDoc.data()?.gallerySettings?.autoRenameDownloads === true;
    const galSnap = await adminDb.collection("tenants").doc(tenantId).collection("galleries").get();

    for (const galDoc of galSnap.docs) {
      const gallery = galDoc.data();
      const media = (gallery.media || []).filter((m) => m.key && !m.hidden);
      const hasFiles =
        media.length > 0 ||
        (gallery.floorPlans || []).some((f) => !f.hidden && f.key) ||
        (gallery.attachedFiles || []).some((f) => !f.hidden && f.key);
      if (!hasFiles) { report.skipped++; continue; }

      // Only prebuild for galleries clients can actually download.
      const buildable = gallery.unlocked === true || gallery.delivered === true || gallery.status === "delivered";
      if (!buildable) { report.skipped++; continue; }

      report.scanned++;
      const r = await enqueueZipBuild(tenantId, galDoc.id, gallery, autoRename);
      if (r.enqueued) {
        report.enqueued++;
        if (report.enqueued >= PER_RUN) break outer;
      }
    }
  }

  return Response.json(report);
}
