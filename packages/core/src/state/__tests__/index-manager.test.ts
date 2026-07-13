import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { IndexManager } from "../index-manager.js";

const TMP_ROOT = join(tmpdir(), "index-manager-test-" + Date.now());
const NS = "test-ns";

describe("IndexManager (Issue #597)", () => {
  let idx: IndexManager;

  beforeEach(async () => {
    await mkdir(join(TMP_ROOT, NS), { recursive: true });
    idx = IndexManager.getInstance();
    idx.clear();
  });

  afterEach(async () => {
    idx.clear();
    await rm(TMP_ROOT, { recursive: true, force: true });
  });

  // ── Basic get/set ──

  it("get returns null for non-existent entry", async () => {
    const result = await idx.get(TMP_ROOT, NS, "nonexistent");
    expect(result).toBeNull();
  });

  it("set then get returns the value (write-through)", async () => {
    const data = { id: "test-1", name: "Test", value: 42 };
    await idx.set(TMP_ROOT, NS, "test-1", data);

    const result = await idx.get<typeof data>(TMP_ROOT, NS, "test-1");
    expect(result).toEqual(data);
  });

  it("get returns cached data after first read (cache hit)", async () => {
    // First: write directly to disk, bypass cache
    const filePath = join(TMP_ROOT, NS, "cache-hit.json");
    const data = { id: "cache-hit", value: "original" };
    await writeFile(filePath, JSON.stringify(data), "utf-8");

    // First read — cache miss, loads from disk
    const result1 = await idx.get<typeof data>(TMP_ROOT, NS, "cache-hit");
    expect(result1).toEqual(data);

    // Modify disk file — cache should still return original (stale is fine)
    await writeFile(filePath, JSON.stringify({ ...data, value: "modified" }), "utf-8");

    // Second read — cache hit, should return cached (original)
    const result2 = await idx.get<typeof data>(TMP_ROOT, NS, "cache-hit");
    expect(result2).toEqual(data);
    expect(result2!.value).toBe("original");
  });

  // ── LRU eviction ──

  it("evicts oldest entry when max size is exceeded", async () => {
    const smallIdx = new IndexManager(3); // max 3 entries

    // Add 3 entries
    for (let i = 0; i < 3; i++) {
      await smallIdx.set(TMP_ROOT, NS, `item-${i}`, { id: `item-${i}`, index: i });
    }

    // All 3 should be accessible
    for (let i = 0; i < 3; i++) {
      const result = await smallIdx.get<{ id: string; index: number }>(TMP_ROOT, NS, `item-${i}`);
      expect(result).not.toBeNull();
      expect(result!.index).toBe(i);
    }

    // Add 4th — should evict item-0 (oldest)
    await smallIdx.set(TMP_ROOT, NS, "item-3", { id: "item-3", index: 3 });

    // item-0 should be evicted
    const evicted = await smallIdx.get(TMP_ROOT, NS, "item-0");
    expect(evicted).not.toBeNull(); // It's still on disk, just not in cache

    // item-1, item-2, item-3 should be in cache
    const cached1 = await smallIdx.get(TMP_ROOT, NS, "item-1");
    expect(cached1).toEqual({ id: "item-1", index: 1 });
  });

  it("get touches entry to prevent eviction (LRU promotion)", async () => {
    const smallIdx = new IndexManager(3);

    await smallIdx.set(TMP_ROOT, NS, "a", { id: "a" });
    await smallIdx.set(TMP_ROOT, NS, "b", { id: "b" });
    await smallIdx.set(TMP_ROOT, NS, "c", { id: "c" });

    // Access 'a' — promotes it to MRU
    await smallIdx.get(TMP_ROOT, NS, "a");

    // Add 'd' — should evict 'b' (oldest now), not 'a'
    await smallIdx.set(TMP_ROOT, NS, "d", { id: "d" });

    // 'a' should still be in cache
    const cachedA = await smallIdx.get(TMP_ROOT, NS, "a");
    expect(cachedA).toEqual({ id: "a" });
  });

  // ── Eviction API ──

  it("evict removes a specific entry from cache", async () => {
    await idx.set(TMP_ROOT, NS, "evict-me", { data: 1 });
    await idx.set(TMP_ROOT, NS, "keep-me", { data: 2 });

    idx.evict(NS, "evict-me");

    // evict-me should be evicted from cache
    // get will load from disk again (cache miss)
    const evicted = await idx.get(TMP_ROOT, NS, "evict-me");
    expect(evicted).toEqual({ data: 1 }); // loaded from disk
  });

  it("evict removes entire namespace", async () => {
    await idx.set(TMP_ROOT, NS, "a", { id: "a" });
    await idx.set(TMP_ROOT, NS, "b", { id: "b" });

    idx.evict(NS);

    // Should load from disk (cache miss)
    const a = await idx.get(TMP_ROOT, NS, "a");
    expect(a).toEqual({ id: "a" });
  });

  it("clear resets all caches", async () => {
    await idx.set(TMP_ROOT, NS, "a", { id: "a" });
    await idx.set(TMP_ROOT, "other", "b", { id: "b" });

    idx.clear();

    // Should be cache miss (load from disk)
    const a = await idx.get(TMP_ROOT, NS, "a");
    expect(a).toEqual({ id: "a" });
  });

  // ── List ──

  it("list returns all items in a namespace", async () => {
    await idx.set(TMP_ROOT, NS, "item-1", { id: "item-1", val: 1 });
    await idx.set(TMP_ROOT, NS, "item-2", { id: "item-2", val: 2 });

    const items = await idx.list<{ id: string; val: number }>(TMP_ROOT, NS);
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.val).sort()).toEqual([1, 2]);
  });

  it("list returns empty array for non-existent namespace", async () => {
    const items = await idx.list(TMP_ROOT, "nonexistent");
    expect(items).toEqual([]);
  });

  // ── Singleton ──

  it("getInstance returns the same instance", () => {
    const i1 = IndexManager.getInstance();
    const i2 = IndexManager.getInstance();
    expect(i1).toBe(i2);
  });

  // ── Custom parser ──

  it("get uses custom parser when provided", async () => {
    const filePath = join(TMP_ROOT, NS, "custom.json");
    await writeFile(filePath, JSON.stringify({ a: 1, b: 2 }), "utf-8");

    const result = await idx.get<number>(TMP_ROOT, NS, "custom", (raw) => JSON.parse(raw).a);
    expect(result).toBe(1);
  });

  // ── Persistence (write-through) ──

  it("set persists data to disk", async () => {
    const data = { id: "persist", value: "disk-check" };
    await idx.set(TMP_ROOT, NS, "persist", data);

    // Read directly from disk
    const filePath = join(TMP_ROOT, NS, "persist.json");
    const raw = await readFile(filePath, "utf-8");
    const onDisk = JSON.parse(raw);
    expect(onDisk).toEqual(data);
  });

  it("get returns data written by set via file system", async () => {
    await idx.set(TMP_ROOT, NS, "fs-test", { x: 1, y: 2 });

    // Clear cache and re-read
    idx.evict(NS, "fs-test");
    const result = await idx.get<{ x: number; y: number }>(TMP_ROOT, NS, "fs-test");
    expect(result).toEqual({ x: 1, y: 2 });
  });

  // ── Namespace isolation ──

  it("caches are isolated per namespace", async () => {
    await idx.set(TMP_ROOT, "ns1", "shared", { from: "ns1" });
    await idx.set(TMP_ROOT, "ns2", "shared", { from: "ns2" });

    const fromNs1 = await idx.get<{ from: string }>(TMP_ROOT, "ns1", "shared");
    const fromNs2 = await idx.get<{ from: string }>(TMP_ROOT, "ns2", "shared");

    expect(fromNs1!.from).toBe("ns1");
    expect(fromNs2!.from).toBe("ns2");
  });

  // ── Edge cases ──

  it("works with empty objects", async () => {
    await idx.set(TMP_ROOT, NS, "empty", {});
    const result = await idx.get<Record<string, never>>(TMP_ROOT, NS, "empty");
    expect(result).toEqual({});
  });

  it("works with arrays", async () => {
    const arr = [1, 2, 3, "a", "b"];
    await idx.set(TMP_ROOT, NS, "array", arr);
    const result = await idx.get<unknown[]>(TMP_ROOT, NS, "array");
    expect(result).toEqual(arr);
  });

  it("does not throw when evicting non-existent entry", () => {
    expect(() => idx.evict(NS, "does-not-exist")).not.toThrow();
  });

  it("does not throw when evicting non-existent namespace", () => {
    expect(() => idx.evict("no-such-ns")).not.toThrow();
  });

  it("handles deeply nested data", async () => {
    const nested = { level1: { level2: { level3: { value: 42, items: [1, 2, 3] } } } };
    await idx.set(TMP_ROOT, NS, "nested", nested);
    const result = await idx.get<typeof nested>(TMP_ROOT, NS, "nested");
    expect(result).toEqual(nested);
    expect(result!.level1.level2.level3.value).toBe(42);
  });
});
