import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { hostname } from "node:os";

/**
 * AES-256-GCM encryption utilities for API key storage.
 *
 * Design:
 * - A random 256-bit AES key is generated per project.
 * - The AES key is wrapped (encrypted) with a machine fingerprint derived from
 *   hostname + platform + arch, and stored in `.inkos/.key.enc`.
 * - API keys in `.inkos/secrets.json` are encrypted with the AES key.
 * - Encrypted values carry the `aes256gcm:` prefix for detection.
 * - Decryption only happens in runtime memory — the file on disk is always
 *   encrypted.
 */

/** Prefix marker for encrypted values in secrets.json */
export const ENCRYPTION_PREFIX = "aes256gcm:";

const KEY_FILE = ".key.enc";
const KEY_DIR = ".inkos";

/** Return true if the value looks like an encrypted string. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTION_PREFIX);
}

/** Path to the wrapped encryption key file. */
function getKeyPath(projectRoot: string): string {
  return join(projectRoot, KEY_DIR, KEY_FILE);
}

/**
 * Derive a stable-but-not-truly-secure machine fingerprint.
 * Combined with the AES key, this binds decryption to the current machine.
 */
function machineFingerprint(): string {
  const raw = `${hostname()}:${process.platform}:${process.arch}`;
  return createHash("sha256").update(raw, "utf-8").digest("hex");
}

/**
 * Wrap (encrypt) the AES key with the machine fingerprint.
 * Returns base64(iv + ciphertext + authTag).
 */
function wrapKeyWithMachineId(aesHexKey: string, fingerprint: string): string {
  const wrappingKey = createHash("sha256").update(fingerprint, "utf-8").digest();
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", wrappingKey, iv);
  const encrypted = Buffer.concat([cipher.update(aesHexKey, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("base64");
}

/**
 * Unwrap (decrypt) the AES key using the machine fingerprint.
 */
function unwrapKeyWithMachineId(wrappedBase64: string, fingerprint: string): string {
  const wrappingKey = createHash("sha256").update(fingerprint, "utf-8").digest();
  const raw = Buffer.from(wrappedBase64, "base64");
  const iv = raw.subarray(0, 16);
  const tag = raw.subarray(-16);
  const encrypted = raw.subarray(16, -16);
  const decipher = createDecipheriv("aes-256-gcm", wrappingKey, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf-8");
}

/**
 * Load the project's encryption key, or create a new one if none exists.
 * The key is stored encrypted with a machine fingerprint so that even if the
 * `.inkos/` directory is copied, the key is useless without the original machine.
 */
export async function getOrCreateEncryptionKey(projectRoot: string): Promise<string> {
  const keyPath = getKeyPath(projectRoot);
  const fingerprint = machineFingerprint();

  try {
    const wrapped = await readFile(keyPath, "utf-8");
    return unwrapKeyWithMachineId(wrapped.trim(), fingerprint);
  } catch {
    // Key file doesn't exist or is corrupt — generate a new one
    const aesKey = randomBytes(32).toString("hex");
    const wrapped = wrapKeyWithMachineId(aesKey, fingerprint);
    const dir = join(projectRoot, KEY_DIR);
    await mkdir(dir, { recursive: true });
    await writeFile(keyPath, wrapped, "utf-8");
    return aesKey;
  }
}

/**
 * Encrypt a plaintext API key.
 * Returns `aes256gcm:base64(iv + ciphertext + authTag)`.
 */
export function encryptValue(plaintext: string, aesHexKey: string): string {
  const key = Buffer.from(aesHexKey, "hex");
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENCRYPTION_PREFIX + Buffer.concat([iv, encrypted, tag]).toString("base64");
}

/**
 * Decrypt a value previously encrypted with `encryptValue`.
 * Expects `aes256gcm:base64(iv + ciphertext + authTag)`.
 */
export function decryptValue(ciphertext: string, aesHexKey: string): string {
  if (!isEncrypted(ciphertext)) {
    return ciphertext; // plaintext fallback for backward compatibility
  }
  const key = Buffer.from(aesHexKey, "hex");
  const raw = Buffer.from(ciphertext.slice(ENCRYPTION_PREFIX.length), "base64");
  const iv = raw.subarray(0, 16);
  const tag = raw.subarray(-16);
  const encrypted = raw.subarray(16, -16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf-8");
}

/**
 * High-level helper: encrypt an API key for a project.
 * Ensures the encryption key exists, then encrypts the value.
 */
export async function encryptApiKeyForProject(
  plaintext: string,
  projectRoot: string,
): Promise<string> {
  const aesKey = await getOrCreateEncryptionKey(projectRoot);
  return encryptValue(plaintext, aesKey);
}

/**
 * High-level helper: decrypt an API key for a project.
 * Returns the plaintext.
 */
export async function decryptApiKeyForProject(
  encrypted: string,
  projectRoot: string,
): Promise<string> {
  if (!isEncrypted(encrypted)) return encrypted; // plaintext fallback
  const aesKey = await getOrCreateEncryptionKey(projectRoot);
  return decryptValue(encrypted, aesKey);
}
