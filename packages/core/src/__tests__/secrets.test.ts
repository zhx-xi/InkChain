import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadSecrets, saveSecrets, getServiceApiKey } from "../llm/secrets.js";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("secrets", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "inkos-secrets-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  describe("loadSecrets", () => {
    it("returns empty when .inkos/secrets.json does not exist", async () => {
      const secrets = await loadSecrets(root);
      expect(secrets).toEqual({ services: {} });
    });

    it("reads existing secrets file", async () => {
      await mkdir(join(root, ".inkos"), { recursive: true });
      await writeFile(
        join(root, ".inkos", "secrets.json"),
        JSON.stringify({ services: { moonshot: { apiKey: "sk-test" } } }),
      );
      const secrets = await loadSecrets(root);
      expect(secrets.services.moonshot.apiKey).toBe("sk-test");
    });
  });

  describe("saveSecrets", () => {
    it("creates .inkos dir and writes encrypted secrets file", async () => {
      await saveSecrets(root, {
        services: { deepseek: { apiKey: "sk-deep" } },
      });
      const raw = await readFile(join(root, ".inkos", "secrets.json"), "utf-8");
      const parsed = JSON.parse(raw);
      // Key is encrypted on disk with aes256gcm: prefix
      expect(parsed.services.deepseek.apiKey).toMatch(/^aes256gcm:/);
      // Reading back decrypts transparently
      const secrets = await loadSecrets(root);
      expect(secrets.services.deepseek.apiKey).toBe("sk-deep");
    });

    it("overwrites existing plaintext secrets with encrypted ones", async () => {
      await mkdir(join(root, ".inkos"), { recursive: true });
      await writeFile(
        join(root, ".inkos", "secrets.json"),
        JSON.stringify({ services: { old: { apiKey: "old-key" } } }),
      );
      await saveSecrets(root, {
        services: { new: { apiKey: "new-key" } },
      });
      const secrets = await loadSecrets(root);
      expect(secrets.services.new.apiKey).toBe("new-key");
      expect(secrets.services.old).toBeUndefined();
    });

    it("migrates existing plaintext keys to encrypted on read+save cycle", async () => {
      await mkdir(join(root, ".inkos"), { recursive: true });
      await writeFile(
        join(root, ".inkos", "secrets.json"),
        JSON.stringify({ services: { moonshot: { apiKey: "sk-plaintext" } } }),
      );
      // loadSecrets reads plaintext → saveSecrets encrypts (auto-migration happens if needed)
      const secrets = await loadSecrets(root);
      expect(secrets.services.moonshot.apiKey).toBe("sk-plaintext");
      // Force a save
      await saveSecrets(root, secrets);
      // Now the file should contain encrypted values
      const raw = await readFile(join(root, ".inkos", "secrets.json"), "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.services.moonshot.apiKey).toMatch(/^aes256gcm:/);
      // loadSecrets can still read it back as plaintext
      const reloaded = await loadSecrets(root);
      expect(reloaded.services.moonshot.apiKey).toBe("sk-plaintext");
    });
  });

  describe("getServiceApiKey", () => {
    it("returns key from secrets.json first", async () => {
      await mkdir(join(root, ".inkos"), { recursive: true });
      await writeFile(
        join(root, ".inkos", "secrets.json"),
        JSON.stringify({ services: { moonshot: { apiKey: "sk-from-file" } } }),
      );
      const key = await getServiceApiKey(root, "moonshot");
      expect(key).toBe("sk-from-file");
    });

    it("falls back to environment variable", async () => {
      vi.stubEnv("MOONSHOT_API_KEY", "sk-from-env");
      const key = await getServiceApiKey(root, "moonshot");
      expect(key).toBe("sk-from-env");
      vi.unstubAllEnvs();
    });

    it("returns null when neither secrets nor env exists", async () => {
      const key = await getServiceApiKey(root, "moonshot");
      expect(key).toBeNull();
    });

    it("handles custom service with colon key format", async () => {
      await mkdir(join(root, ".inkos"), { recursive: true });
      await writeFile(
        join(root, ".inkos", "secrets.json"),
        JSON.stringify({
          services: { "custom:内网GPT": { apiKey: "sk-custom" } },
        }),
      );
      const key = await getServiceApiKey(root, "custom:内网GPT");
      expect(key).toBe("sk-custom");
    });
  });
});
