# Kyoria ZIP Builder (Cloudflare Worker)

Background builder for the gallery **"Download Everything"** ZIP. Vercel never
builds these ZIPs — it only enqueues jobs here and receives a completion callback.
This Worker streams every listing file from R2 into a single ZIP and writes it back
to R2, entirely inside Cloudflare (zero egress cost, no timeout).

## What it does

```
Vercel  ──POST /enqueue { tenantId, galleryId }──▶  Worker (producer)
                                                       │  env.ZIP_QUEUE.send()
                                                       ▼
                                              Cloudflare Queue
                                                       │
                                                       ▼
                                              Worker (consumer)
   GET  {APP_URL}/api/internal/zip-manifest  ◀── fetch manifest (source keys+paths)
   R2 get(key) ─▶ client-zip ─▶ R2 multipart put({hash}.zip)   (streamed, bounded RAM)
   POST {APP_URL}/api/internal/zip-complete  ──▶ app flips zipPackage pointer
```

The manifest reflects the gallery's **current** state. If files change while a build
runs, the app's `zip-complete` handler sees the hash no longer matches, discards the
stale ZIP, and a fresh build is enqueued — the previously-served ZIP stays live the
whole time, so clients never get a partial or missing download.

## Plans

Deploy on **Workers Free** first — Queues are available on Free (since Feb 2026),
so the full producer/consumer architecture runs unchanged. The one caveat is the
Free CPU cap of **10 ms per invocation**; a real ZIP build (CRC32 over many large
files) will likely exceed it. When it does, upgrade to **Workers Paid** — that is
a billing change plus uncommenting the two `[limits]` lines in `wrangler.toml` to
raise the CPU ceiling. The architecture itself does not change between plans.

## One-time setup

Prereqs: a Cloudflare account (Free is fine to start) and the R2 bucket the app
already uses. Install deps and log in:

```bash
cd cloudflare/zip-builder
npm install
npx wrangler login
```

1. **Create the queue:**
   ```bash
   npx wrangler queues create kyoria-zip-builds
   ```

2. **Point the R2 binding at your bucket** — edit `wrangler.toml` and replace
   `REPLACE_WITH_YOUR_R2_BUCKET` with the real bucket name (same one the app uses,
   i.e. the value of the app's `R2_BUCKET_NAME`).

3. **Set the shared secret** (any long random string; must match the app's
   `ZIP_SECRET`):
   ```bash
   npx wrangler secret put ZIP_SECRET
   ```

4. **Confirm `APP_URL`** in `wrangler.toml` is `https://kyoriaos.com`.

5. **Deploy:**
   ```bash
   npx wrangler deploy
   ```
   Note the deployed URL, e.g. `https://kyoria-zip-builder.<subdomain>.workers.dev`.

## Vercel environment variables

Add these to the Vercel project (Production) and redeploy:

| Variable         | Value                                                        |
| ---------------- | ------------------------------------------------------------ |
| `ZIP_WORKER_URL` | the deployed Worker URL (no trailing slash)                  |
| `ZIP_SECRET`     | the SAME secret you set on the Worker                        |

That's it. Until both are set, the app safely falls back to its on-demand streamed
ZIP, so nothing breaks in the meantime.

## Verify

```bash
curl https://kyoria-zip-builder.<subdomain>.workers.dev/health   # -> ok
```

Then, in the app, open a delivered gallery and click **Download Everything**. The
first click on a large listing enqueues a build and polls until it's ready; later
clicks download instantly from R2. Watch logs with:

```bash
npx wrangler tail
```
