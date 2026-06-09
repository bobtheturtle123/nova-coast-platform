// 1080p web-viewable video generation.
//
// Real estate videos are delivered at full resolution (often 4K, 50+ Mbps) for
// the client download. For long-term gallery PLAYBACK we keep a smaller 1080p
// H.264 version that stays available even after the full-res original is removed
// for storage management. The target is ~8-10 Mbps — compressed enough to cut
// storage meaningfully, but not so aggressive that the footage looks cheap.
//
// ffmpeg needs real file paths (it seeks), so we stage the input/output in the
// OS temp dir. Buffers in/out keep callers simple.

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";

// 1080p web target. ~9 Mbps average with a 12 Mbps cap keeps motion-heavy
// drone/walkthrough footage clean without ballooning file size.
export const WEB_VIDEO = {
  height:    1080,
  bitrate:   "9000k",
  maxrate:   "12000k",
  bufsize:   "18000k",
  audioRate: "128k",
  preset:    "medium",
};

// Only attempt inline transcode below this size. Larger originals should be
// handled by a dedicated worker (transcoding a multi-GB 4K file can exceed a
// serverless function's time/temp-disk budget).
export const MAX_INLINE_TRANSCODE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

// Transcode an input video buffer to a 1080p H.264 MP4 buffer.
// Resolves { buffer, bytes }. Throws on failure.
export async function transcodeTo1080p(inputBuffer) {
  const ffmpegPath = (await import("ffmpeg-static")).default;
  const ffmpegMod  = (await import("fluent-ffmpeg")).default;
  if (ffmpegPath) ffmpegMod.setFfmpegPath(ffmpegPath);

  const dir    = os.tmpdir();
  const inPath  = path.join(dir, `in-${randomUUID()}`);
  const outPath = path.join(dir, `out-${randomUUID()}.mp4`);

  await fs.writeFile(inPath, inputBuffer);
  try {
    await new Promise((resolve, reject) => {
      ffmpegMod(inPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .audioBitrate(WEB_VIDEO.audioRate)
        .outputOptions([
          // Downscale to 1080p height, preserve aspect, never upscale, even dims.
          `-vf scale=-2:'min(${WEB_VIDEO.height},ih)'`,
          `-b:v ${WEB_VIDEO.bitrate}`,
          `-maxrate ${WEB_VIDEO.maxrate}`,
          `-bufsize ${WEB_VIDEO.bufsize}`,
          `-preset ${WEB_VIDEO.preset}`,
          "-pix_fmt yuv420p",
          "-movflags +faststart", // web streaming: moov atom up front
        ])
        .on("end", resolve)
        .on("error", reject)
        .save(outPath);
    });

    const buffer = await fs.readFile(outPath);
    return { buffer, bytes: buffer.length };
  } finally {
    await fs.rm(inPath,  { force: true }).catch(() => {});
    await fs.rm(outPath, { force: true }).catch(() => {});
  }
}

// Derive the R2 key for a video's 1080p web version from its original key.
export function webVideoKey(originalKey) {
  const base = originalKey.replace(/\.[^./]+$/, "");
  return `${base}-1080p.mp4`;
}
