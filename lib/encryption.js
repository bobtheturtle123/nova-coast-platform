// Symmetric encryption for at-rest secrets (e.g. third-party OAuth tokens).
// AES-256-GCM with a key derived from an env secret. Tokens are NEVER stored or
// returned in plaintext.
//
// Set INTEGRATIONS_ENC_KEY (any high-entropy string) in the environment. We
// derive a 32-byte key from it via SHA-256, so the input length is flexible.
// CRON_SECRET is used as a fallback so the feature works if the dedicated key
// has not been set yet, but a dedicated key is strongly recommended.

import crypto from "crypto";

function getKey() {
  const secret = process.env.INTEGRATIONS_ENC_KEY || process.env.CRON_SECRET;
  if (!secret) throw new Error("No encryption secret configured (INTEGRATIONS_ENC_KEY).");
  return crypto.createHash("sha256").update(String(secret)).digest(); // 32 bytes
}

// Returns base64 of: iv(12) | authTag(16) | ciphertext.
export function encrypt(plaintext) {
  if (plaintext == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decrypt(payload) {
  if (!payload) return null;
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
