import { describe, it, expect } from "vitest";
import {
  encryptValue,
  decryptValue,
  isEncrypted,
  ENCRYPTION_PREFIX,
  getOrCreateEncryptionKey,
} from "../llm/encryption.js";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("encryption", () => {
  describe("isEncrypted", () => {
    it("returns true for encrypted-prefixed strings", () => {
      expect(isEncrypted(`${ENCRYPTION_PREFIX}abc123`)).toBe(true);
    });

    it("returns false for plain strings", () => {
      expect(isEncrypted("sk-plaintext-api-key")).toBe(false);
      expect(isEncrypted("")).toBe(false);
    });
  });

  describe("encryptValue / decryptValue", () => {
    const key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 64 hex chars = 32 bytes

    it("encrypts and decrypts an API key", () => {
      const plaintext = "sk-moonshot-api-key-value";
      const encrypted = encryptValue(plaintext, key);
      expect(encrypted).toMatch(/^aes256gcm:/);
      const decrypted = decryptValue(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it("produces different ciphertexts for the same plaintext (random IV)", () => {
      const plaintext = "alwavs-the-same-key";
      const first = encryptValue(plaintext, key);
      const second = encryptValue(plaintext, key);
      expect(first).not.toBe(second); // different IV → different output
    });

    it("rejects wrong decryption key", () => {
      const plaintext = "sk-test-key";
      const encrypted = encryptValue(plaintext, key);
      const wrongKey = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
      expect(() => decryptValue(encrypted, wrongKey)).toThrow();
    });

    it("passes through plaintext when ciphertext has no prefix", () => {
      // Plaintext fallback for backward compatibility
      expect(decryptValue("sk-old-plain-key", key)).toBe("sk-old-plain-key");
    });
  });

  describe("getOrCreateEncryptionKey", () => {
    it("creates and re-reads a key for a project dir", async () => {
      const root = await mkdtemp(join(tmpdir(), "inkos-enc-"));
      try {
        const key1 = await getOrCreateEncryptionKey(root);
        expect(key1).toMatch(/^[0-9a-f]{64}$/); // 32 bytes hex
        const key2 = await getOrCreateEncryptionKey(root);
        expect(key2).toBe(key1); // same on re-read
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });

    it("generates different keys for different projects", async () => {
      const root1 = await mkdtemp(join(tmpdir(), "inkos-enc-"));
      const root2 = await mkdtemp(join(tmpdir(), "inkos-enc-"));
      try {
        const key1 = await getOrCreateEncryptionKey(root1);
        const key2 = await getOrCreateEncryptionKey(root2);
        expect(key1).not.toBe(key2);
      } finally {
        await rm(root1, { recursive: true, force: true });
        await rm(root2, { recursive: true, force: true });
      }
    });
  });

  describe("roundtrip via project", () => {
    it("encrypts and decrypts via project helpers", async () => {
      const root = await mkdtemp(join(tmpdir(), "inkos-enc-"));
      try {
        const { encryptApiKeyForProject, decryptApiKeyForProject } = await import("../llm/encryption.js");
        const plaintext = "sk-my-secret-key-for-project";
        const encrypted = await encryptApiKeyForProject(plaintext, root);
        expect(encrypted).toMatch(/^aes256gcm:/);
        const decrypted = await decryptApiKeyForProject(encrypted, root);
        expect(decrypted).toBe(plaintext);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    });
  });
});
