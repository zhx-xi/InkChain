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
//   evict(root, namespace, id?)            → drop one or all entries from cache
//   list<T>(root, namespace)              → list all items in a namespace
//   clear()                               → reset entire cache

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

interface CacheEntry {
  data: unknown;
}

export class IndexManager {
  private static instance: IndexManager;
  /** 3-level cache: root → namespace → id → CacheEntry */
  private readonly cache = new Map<string, Map<string, Map<string, CacheEntry>>>();
  /** Ordered list of "root\x00namespace\x00id" keys, oldest first, for LRU eviction. */
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
   * Get a cached value by root + namespace + id. On cache miss, load from file
   * `<root>/<namespace>/<id>.json`, parse with `parser` (default JSON.parse),
   * cache the result, and return it. Returns `null` if the file does not exist.
   */
  async get<T = unknown>(
    root: string,
    namespace: string,
    id: string,
    parser?: (raw: string) => T,
  ): Promise<T | null> {
    const nsMap = this.ensureNamespace(root, namespace);
    const existing = nsMap.get(id);
    if (existing !== undefined) {
      this.recordAccess(root, namespace, id);
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
    this.recordAccess(root, namespace, id);
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
    const nsMap = this.ensureNamespace(root, namespace);
    nsMap.set(id, { data });
    this.recordAccess(root, namespace, id);
    this.evictLru();
  }

  /**
   * Evict one entry or an entire namespace from cache.
   * - With `id`: evict only that entry.
   * - Without `id`: evict the whole namespace.
   */
  evict(root: string, namespace: string, id?: string): void {
    const lruPrefix = this.lruKey(root, namespace);
    const rootMap = this.cache.get(root);
    if (!rootMap) return;

    if (id !== undefined) {
      const nsMap = rootMap.get(namespace);
      if (nsMap) {
        nsMap.delete(id);
        const key = `${lruPrefix}\x00${id}`;
        const idx = this.lruOrder.indexOf(key);
        if (idx !== -1) this.lruOrder.splice(idx, 1);
        if (nsMap.size === 0) rootMap.delete(namespace);
      }
    } else {
      rootMap.delete(namespace);
      // Remove all keys for this root+namespace from LRU order
      for (let i = this.lruOrder.length - 1; i >= 0; i--) {
        if (this.lruOrder[i]!.startsWith(lruPrefix)) {
          this.lruOrder.splice(i, 1);
        }
      }
    }

    if (rootMap.size === 0) this.cache.delete(root);
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

  /** Get or create the namespace-level map under `root → namespace`. */
  private ensureNamespace(root: string, namespace: string): Map<string, CacheEntry> {
    let rootMap = this.cache.get(root);
    if (!rootMap) {
      rootMap = new Map();
      this.cache.set(root, rootMap);
    }
    let nsMap = rootMap.get(namespace);
    if (!nsMap) {
      nsMap = new Map();
      rootMap.set(namespace, nsMap);
    }
    return nsMap;
  }

  /** Build the LRU key prefix (root + namespace, separated by NUL). */
  private lruKey(root: string, namespace: string): string {
    return `${root}\x00${namespace}`;
  }

  /** Move `root\x00namespace\x00id` to the end (most recently used). */
  private recordAccess(root: string, namespace: string, id: string): void {
    const key = `${root}\x00${namespace}\x00${id}`;
    const idx = this.lruOrder.indexOf(key);
    if (idx !== -1) this.lruOrder.splice(idx, 1);
    this.lruOrder.push(key);
  }

  /** Evict oldest entries if we exceed maxEntries. */
  private evictLru(): void {
    while (this.lruOrder.length > this.maxEntries) {
      const oldest = this.lruOrder.shift()!;
      // Format: root\x00namespace\x00id — find the last NUL separator
      const lastSep = oldest.lastIndexOf("\x00");
      const secondLastSep = oldest.lastIndexOf("\x00", lastSep - 1);
      if (secondLastSep === -1) continue; // malformed
      const root = oldest.slice(0, secondLastSep);
      const namespace = oldest.slice(secondLastSep + 1, lastSep);
      const id = oldest.slice(lastSep + 1);
      const rootMap = this.cache.get(root);
      if (rootMap) {
        const nsMap = rootMap.get(namespace);
        if (nsMap) {
          nsMap.delete(id);
          if (nsMap.size === 0) rootMap.delete(namespace);
        }
        if (rootMap.size === 0) this.cache.delete(root);
      }
    }
  }
}
