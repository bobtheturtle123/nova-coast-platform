import { adminDb } from "@/lib/firebase-admin";
import { buildGalleryManifest, fileSetHash } from "@/lib/galleryZip";
import { zipDestKey } from "@/lib/zipJobs";

export const dynamic = "force-dynamic";

// Called ONLY by the Cloudflare ZIP-builder Worker (shared-secret guarded).
//
// Returns the current build manifest for a gallery: the exact source R2 objects,
// their paths inside the ZIP, the Links/ text files, the hash-named destination
// key, and the download file name. The manifest reflects the gallery's state at
// the moment of the build, so if files changed since the job was enqueued the
// Worker builds (and reports) the CURRENT hash — the completion handler discards
// anything that no longer matches.
export async function GET(req) {
  if (req.headers.get("x-zip-secret") !== process.env.ZIP_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tenantId  = searchParams.get("tenantId");
  const galleryId = searchParams.get("galleryId");
  if (!tenantId || !galleryId) return Response.json({ error: "Missing params" }, { status: 400 });

  const [gSnap, tSnap] = await Promise.all([
    adminDb.collection("tenants").doc(tenantId).collection("galleries").doc(galleryId).get(),
    adminDb.collection("tenants").doc(tenantId).get(),
  ]);
  if (!gSnap.exists) return Response.json({ error: "Gallery not found" }, { status: 404 });

  const gallery    = gSnap.data();
  const slug       = tSnap.data()?.slug || null;
  const autoRename = tSnap.data()?.gallerySettings?.autoRenameDownloads === true;
  const token      = gallery.accessToken || null;
  const bookingId  = gallery.bookingId || null;

  const hash = fileSetHash(gallery, "package", autoRename);
  const { entries, linkFiles } = buildGalleryManifest(gallery, { slug, token, bookingId, autoRename });
  const address = (gallery.bookingAddress || "listing").replace(/[^a-z0-9]/gi, "-").toLowerCase();

  return Response.json({
    tenantId,
    galleryId,
    hash,
    destKey: zipDestKey(tenantId, galleryId, hash),
    fileName: `${address}-media.zip`,
    entries,
    linkFiles,
  });
}
