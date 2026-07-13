// ── Global IndexManager — LRU cache layer for API data reads (Issue #597) ──
//
// Provides a transparent in-memory cache for JSON data files stored under
// the project root. Uses a per-namespace LRU Map to cap memory usage at
// `maxEntries` total items.
//
// Write-through strategy: `set()` writes to disk AND updates the cache,
// so subsequent reads are served from memory without a disk round-trip.
//
// Types:
//   get<T>(root, namespace, id, parser?)  → lazy-load from disk, cache hit
//   set<T>(root, namespace, id, data)     → write-through (disk + cache)
//   evict(namespace, id?)                  → drop one or all entries from cache
//   list<T>(root, namespace)              → list all items in a namespace
//   clear()                               → reset entire cache

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

interface CacheEntry {
  data: unknown;
}

export class IndexManager {
  private static instance: IndexManager;
  private readonly cache = new Map<string, Map<string, CacheEntry>>();
  /** Ordered list of "namespace:id" keys, oldest first, for LRU eviction. */
  private readonly lruOrder: string[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries = 200) {
    this.maxEntries = maxEntries;
  }

  static getInstance(maxEntries = 200): IndexManager {
    if (!IndexManager.instance) {
      IndexManager.instance = new IndexManager(maxEntries);
    }
    return IndexManager.instance;
  }

  // ── Public API ──

  /**
   * Get a cached value by namespace + id. On cache miss, load from file
   * `<root>/<namespace>/<id>.json`, parse with `parser` (default JSON.parse),
   * cache the result, and return it. Returns `null` if the file does not exist.
   */
  async get<T = unknown>(
    root: string,
    namespace: string,
    id: string,
    parser?: (raw: string) => T,
  ): Promise<T | null> {
    const nsMap = this.ensureNamespace(namespace);
    const existing = nsMap.get(id);
    if (existing !== undefined) {
      this.recordAccess(namespace, id);
      return existing.data as T;
    }

    // Cache miss — load from disk
    const filePath = join(root, namespace, `${id}.json`);
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }

    const data: T = parser ? parser(raw) : (JSON.parse(raw) as T);
    nsMap.set(id, { data });
    this.recordAccess(namespace, id);
    this.evictLru();
    return data;
  }

  /**
   * Write-through: write data to disk at `<root>/<namespace>/<id>.json`,
   * then update the in-memory cache. Creates the namespace directory if needed.
   */
  async set<T = unknown>(
    root: string,
    namespace: string,
    id: string,
    data: T,
  ): Promise<void> {
    const dir = join(root, namespace);
    await mkdir(dir, { recursive: true });

    const filePath = join(dir, `${id}.json`);
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");

    // Update cache
    const nsMap = this.ensureNamespace(namespace);
    nsMap.set(id, { data });
    this.recordAccess(namespace, id);
    this.evictLru();
  }

  /**
   * Evict one entry or an entire namespace from cache.
   * - With `id`: evict only that entry.
   * - Without `id`: evict the whole namespace.
   */
  evict(namespace: string, id?: string): void {
    if (id !== undefined) {
      const nsMap = this.cache.get(namespace);
      if (nsMap) {
        nsMap.delete(id);
        const key = `${namespace}:${id}`;
        const idx = this.lruOrder.indexOf(key);
        if (idx !== -1) this.lruOrder.splice(idx, 1);
        if (nsMap.size === 0) this.cache.delete(namespace);
      }
    } else {
      this.cache.delete(namespace);
      // Remove all keys for this namespace from LRU order
      for (let i = this.lruOrder.length - 1; i >= 0; i--) {
        if (this.lruOrder[i]!.startsWith(`${namespace}:`)) {
          this.lruOrder.splice(i, 1);
        }
      }
    }
  }

  /**
   * List all items in a namespace by reading the directory and loading each file.
   * Uses the cache for already-loaded items.
   */
  async list<T = unknown>(
    root: string,
    namespace: string,
    parser?: (raw: string) => T,
  ): Promise<T[]> {
    const dir = join(root, namespace);
    let files: string[];
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      files = entries
        .filter((e) => e.isFile() && e.name.endsWith(".json"))
        .map((e) => e.name.replace(/\.json$/, ""));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const results: T[] = [];
    for (const id of files.sort()) {
      const item = await this.get<T>(root, namespace, id, parser);
      if (item !== null) results.push(item);
    }
    return results;
  }

  /** Reset the entire cache. */
  clear(): void {
    this.cache.clear();
    this.lruOrder.length = 0;
  }

  // ── Internals ──

  private ensureNamespace(namespace: string): Map<string, CacheEntry> {
    let nsMap = this.cache.get(namespace);
    if (!nsMap) {
      nsMap = new Map();
      this.cache.set(namespace, nsMap);
    }
    return nsMap;
  }

  /** Move `namespace:id` to the end (most recently used). */
  private recordAccess(namespace: string, id: string): void {
    const key = `${namespace}:${id}`;
    const idx = this.lruOrder.indexOf(key);
    if (idx !== -1) this.lruOrder.splice(idx, 1);
    this.lruOrder.push(key);
  }

  /** Evict oldest entries if we exceed maxEntries. */
  private evictLru(): void {
    while (this.lruOrder.length > this.maxEntries) {
      const oldest = this.lruOrder.shift()!;
      const colonIdx = oldest.indexOf(":");
      const ns = oldest.slice(0, colonIdx);
      const eid = oldest.slice(colonIdx + 1);
      const nsMap = this.cache.get(ns);
      if (nsMap) {
        nsMap.delete(eid);
        if (nsMap.size === 0) this.cache.delete(ns);
      }
    }
  }
}
