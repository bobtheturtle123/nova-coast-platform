// Kyoria OS — background "Download Everything" ZIP builder (Cloudflare Worker).
//
// The heavy work of assembling a complete listing ZIP lives HERE, not on Vercel.
// Vercel only enqueues a job ({ tenantId, galleryId }) and, when we finish, gets a
// completion callback. This Worker:
//
//   1. /enqueue (HTTP, shared-secret) → pushes the job onto the Queue.
//   2. queue consumer → for each job:
//        a. fetches the build manifest from the app (source R2 keys + zip paths).
//        b. streams every object from R2 through client-zip (store, no recompress).
//        c. multipart-uploads the finished ZIP back to R2 (bounded memory).
//        d. POSTs the app's completion endpoint so it flips the zipPackage pointer.
//
// Everything streams: an object is read from R2 and written into the ZIP part by
// part, so a 10GB+ listing never loads into memory. R2 read + R2 write stay inside
// Cloudflare, so there is zero egress cost.

import { makeZip } from "client-zip";

const PART_SIZE = 10 * 1024 * 1024; // 10 MiB (R2 multipart parts must be >= 5 MiB)

function concatChunks(chunks, total) {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

// Yield client-zip inputs for every manifest entry (streamed from R2) plus the
// literal Links/ text files. Missing objects are skipped rather than failing the
// whole build.
async function* filesFromManifest(manifest, env) {
  for (const entry of manifest.entries || []) {
    const obj = await env.BUCKET.get(entry.key);
    if (!obj) continue;
    yield { name: entry.path, input: obj.body, size: obj.size, lastModified: obj.uploaded };
  }
  for (const lf of manifest.linkFiles || []) {
    yield { name: lf.name, input: lf.content };
  }
}

async function buildOne(job, env) {
  const { tenantId, galleryId } = job || {};
  if (!tenantId || !galleryId) return;

  // 1. Manifest (reflects the gallery's CURRENT state; the app discards a stale
  //    result if the file set changed while we were building).
  const manifestRes = await fetch(
    `${env.APP_URL}/api/internal/zip-manifest?tenantId=${encodeURIComponent(tenantId)}&galleryId=${encodeURIComponent(galleryId)}`,
    { headers: { "x-zip-secret": env.ZIP_SECRET } }
  );
  if (!manifestRes.ok) throw new Error(`manifest fetch failed: ${manifestRes.status}`);
  const manifest = await manifestRes.json();
  const { destKey, hash } = manifest;
  if (!destKey || !hash) throw new Error("manifest missing destKey/hash");

  // 2 + 3. Stream the ZIP into an R2 multipart upload.
  const zipStream = makeZip(filesFromManifest(manifest, env));
  const mpu = await env.BUCKET.createMultipartUpload(destKey, {
    httpMetadata: { contentType: "application/zip" },
  });

  let bytes = 0;
  try {
    const reader = zipStream.getReader();
    const parts = [];
    let partNumber = 1;
    let buffered = [];     // pending chunks not yet uploaded
    let bufferedLen = 0;

    // R2 (unlike S3) requires every non-final multipart part to be EXACTLY the same
    // size. So we must slice parts to a fixed PART_SIZE and carry the remainder
    // forward — NOT flush opportunistically whenever the buffer crosses PART_SIZE
    // (that produces parts of varying length and R2 rejects completeMultipartUpload
    // with "All non-trailing parts must have the same length").
    const uploadFixedParts = async () => {
      while (bufferedLen >= PART_SIZE) {
        const merged = concatChunks(buffered, bufferedLen);
        const part = await mpu.uploadPart(partNumber, merged.subarray(0, PART_SIZE));
        parts.push(part);
        partNumber += 1;
        const rest = merged.subarray(PART_SIZE);
        buffered = rest.byteLength ? [rest] : [];
        bufferedLen = rest.byteLength;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered.push(value);
      bufferedLen += value.byteLength;
      bytes += value.byteLength;
      if (bufferedLen >= PART_SIZE) await uploadFixedParts();
    }

    // Trailing part — may be any size (< PART_SIZE), or the sole part of a tiny ZIP.
    if (bufferedLen > 0) {
      const body = concatChunks(buffered, bufferedLen);
      const part = await mpu.uploadPart(partNumber, body);
      parts.push(part);
      partNumber += 1;
    }

    if (parts.length === 0) {
      // Empty archive — complete needs at least one part.
      const part = await mpu.uploadPart(1, new Uint8Array(0));
      parts.push(part);
    }

    await mpu.complete(parts);
  } catch (err) {
    try { await mpu.abort(); } catch { /* best-effort */ }
    throw err;
  }

  // 4. Tell the app the ZIP is ready so it flips the served pointer.
  const done = await fetch(`${env.APP_URL}/api/internal/zip-complete`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-zip-secret": env.ZIP_SECRET },
    body: JSON.stringify({ tenantId, galleryId, hash, key: destKey, bytes }),
  });
  if (!done.ok) throw new Error(`completion callback failed: ${done.status}`);
}

export default {
  // Producer endpoint — Vercel POSTs { tenantId, galleryId } here to enqueue.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }
    if (request.method === "POST" && url.pathname === "/enqueue") {
      if (request.headers.get("x-zip-secret") !== env.ZIP_SECRET) {
        return new Response("Unauthorized", { status: 401 });
      }
      const job = await request.json().catch(() => null);
      if (!job || !job.tenantId || !job.galleryId) {
        return new Response("Bad request", { status: 400 });
      }
      await env.ZIP_QUEUE.send({ tenantId: job.tenantId, galleryId: job.galleryId });
      return new Response("queued", { status: 202 });
    }
    return new Response("Not found", { status: 404 });
  },

  // Consumer — one job per message; retries on throw.
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        await buildOne(message.body, env);
        message.ack();
      } catch (err) {
        console.error("[zip-builder] build failed:", err?.message || err);
        message.retry();
      }
    }
  },
};
