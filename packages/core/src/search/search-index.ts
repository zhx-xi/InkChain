// ── Simple Inverted-Index Full-Text Search ──
// Tokenizes Chinese text by character, English/Latin by whitespace,
// and builds/manages an in-memory inverted index with on-disk persistence.
//
// Storage: {projectRoot}/.inkos/search_index.json

import { readFile, writeFile, mkdir, readdir as fsReaddir } from "node:fs/promises";
import { join, dirname } from "node:path";

// ── Types ──

export interface SearchDoc {
  id: string;
  title: string;
  content: string;
  tags: string[];
  scope: "session" | "chapter" | "character";
  updatedAt: string;
}

export interface SearchMatch {
  field: string;
  snippet: string;
  positions: Array<{ start: number; end: number }>;
}

export interface SearchResult {
  doc: SearchDoc;
  score: number;
  matches: SearchMatch[];
}

export interface SearchIndex {
  version: number;
  /** docId -> SearchDoc */
  docs: Record<string, SearchDoc>;
  /** term -> docId -> term frequency within that doc */
  index: Record<string, Record<string, number>>;
}

// ── Storage path ──

const SEARCH_INDEX_REL = ".inkos/search_index.json";

export function searchIndexPath(projectRoot: string): string {
  return join(projectRoot, SEARCH_INDEX_REL);
}

// ── Tokenization ──

/**
 * Tokenize text for indexing and search.
 *
 * Strategy:
 * - CJK characters (U+4E00–U+9FFF, U+3000–U+303F, U+FF00–U+FFEF) are each indexed
 *   as a separate single-character token (unigram).
 * - Latin/English text is split by whitespace and punctuation.
 * - All tokens are lowercased.
 * - Tokens shorter than 1 character are discarded.
 * - Maximum token length is capped at 40 characters.
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const lower = text.toLowerCase();
  const len = lower.length;

  let latinBuf = "";
  for (let i = 0; i < len; i++) {
    const ch = lower[i]!;
    const code = ch.charCodeAt(0);

    // CJK range
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      // Flush Latin buffer
      if (latinBuf) {
        tokens.push(latinBuf);
        latinBuf = "";
      }
      tokens.push(ch);
    } else if (/[a-z0-9]/.test(ch)) {
      latinBuf += ch;
    } else if (/[\s\-_]/.test(ch)) {
      if (latinBuf) {
        tokens.push(latinBuf);
        latinBuf = "";
      }
    }
    // Other characters (punctuation, etc.) are skipped
  }
  if (latinBuf) {
    tokens.push(latinBuf);
  }

  return tokens
    .map((t) => t.slice(0, 40))
    .filter((t) => t.length >= 1);
}

/**
 * Compute term frequencies for a text.
 */
function termFrequencies(text: string): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const term of tokenize(text)) {
    tf[term] = (tf[term] ?? 0) + 1;
  }
  return tf;
}

// ── Index Management ──

/**
 * Create a fresh, empty search index.
 */
export function createSearchIndex(): SearchIndex {
  return { version: 1, docs: {}, index: {} };
}

/**
 * Add or update a document in the index, returning a new SearchIndex.
 *
 * If the doc already exists (by id), it is replaced: the old terms are
 * removed and the new terms are indexed.
 */
export function addToIndex(index: SearchIndex, doc: SearchDoc): SearchIndex {
  // Clone to avoid mutation
  const newIndex: SearchIndex = {
    version: index.version,
    docs: { ...index.docs, [doc.id]: { ...doc } },
    index: {},
  };

  // Build new inverted index entry for this doc
  const docTermFreq: Record<string, number> = {};
  const addTerms = (text: string) => {
    for (const term of tokenize(text)) {
      docTermFreq[term] = (docTermFreq[term] ?? 0) + 1;
    }
  };

  addTerms(doc.title);
  addTerms(doc.content);
  for (const tag of doc.tags) {
    addTerms(tag);
  }

  // Rebuild the full index: copy all entries from the old index,
  // replace this doc's terms, and skip removed docs
  const docIds = new Set([...Object.keys(index.docs), doc.id]);
  for (const did of docIds) {
    if (did === doc.id) {
      // Use the new term frequencies
      for (const [term, freq] of Object.entries(docTermFreq)) {
        if (!newIndex.index[term]) {
          newIndex.index[term] = {};
        }
        newIndex.index[term]![did] = freq;
      }
    } else {
      // Copy existing term entries
      const oldTf = index.index;
      for (const [term, docMap] of Object.entries(oldTf)) {
        if (docMap[did] !== undefined) {
          if (!newIndex.index[term]) {
            newIndex.index[term] = {};
          }
          newIndex.index[term]![did] = docMap[did]!;
        }
      }
    }
  }

  return newIndex;
}

/**
 * Remove a document from the index by its id.
 */
export function removeFromIndex(index: SearchIndex, docId: string): SearchIndex {
  if (!index.docs[docId]) {
    return index; // Nothing to remove
  }

  const newDocs: Record<string, SearchDoc> = {};
  for (const [id, doc] of Object.entries(index.docs)) {
    if (id !== docId) {
      newDocs[id] = doc;
    }
  }

  const newIndex: Record<string, Record<string, number>> = {};
  for (const [term, docMap] of Object.entries(index.index)) {
    if (docMap[docId] !== undefined) {
      // Remove this doc's entry from this term
      const filtered: Record<string, number> = {};
      let hasAny = false;
      for (const [did, freq] of Object.entries(docMap)) {
        if (did !== docId) {
          filtered[did] = freq;
          hasAny = true;
        }
      }
      if (hasAny) {
        newIndex[term] = filtered;
      }
    } else {
      newIndex[term] = docMap;
    }
  }

  return { version: index.version, docs: newDocs, index: newIndex };
}

// ── Query Parsing ──

/**
 * Parse a user query into search terms.
 * Splits by whitespace; each term is tokenized.
 */
function parseQuery(query: string): string[] {
  const terms = new Set<string>();
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  // Try to split by whitespace first (AND semantics between words)
  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);
  for (const part of parts) {
    const tokens = tokenize(part);
    for (const token of tokens) {
      terms.add(token);
    }
  }

  return [...terms];
}

/**
 * Compute relevance score for a document against the query terms.
 *
 * Scoring: sum of TF (term frequency) for each matched term across fields,
 * with field weight multipliers:
 *   - title:  ×3
 *   - tags:   ×2
 *   - content: ×1
 */
function scoreDoc(
  doc: SearchDoc,
  queryTerms: string[],
  indexEntry: Record<string, number> | undefined,
): number {
  if (!queryTerms.length) return 0;
  if (!indexEntry) return 0;

  // We only have combined TF in the index; approximate by using the raw
  // index TF. We also do a direct text check for title/tag weighting.
  let score = 0;
  const titleLower = doc.title.toLowerCase();
  const tagsLower = doc.tags.map((t) => t.toLowerCase());
  const contentLower = doc.content.toLowerCase();

  for (const term of queryTerms) {
    // Index TF contribution
    const tf = indexEntry[term];
    if (tf && tf > 0) {
      score += tf;
    }

    // Field weight bonus: check if the term appears in certain fields
    // by doing a simple substring check on the tokenized representation
    const tokenizedTitle = tokenize(titleLower).join(" ");
    const tokenizedTags = tagsLower.map((t) => tokenize(t).join(" ")).join(" ");
    const tokenizedContent = tokenize(contentLower).join(" ");
    const tokenizedTerm = tokenize(term)
      .map((t) => t.toLowerCase())
      .filter((t) => t.length >= 1)
      .join(" ");

    if (tokenizedTitle.includes(tokenizedTerm)) {
      score += 2; // Title bonus
    }
    if (tokenizedTags.includes(tokenizedTerm)) {
      score += 1.5; // Tag bonus
    }
  }

  return score;
}

// ── Snippet Generation ──

/**
 * Generate a highlighted snippet from text, finding all positions where
 * query terms appear.
 *
 * Returns the original text string (or a truncated window around the
 * first match) along with character-level positions of query term matches.
 *
 * @param text      The full text to search within.
 * @param query     The raw user query.
 * @param maxLength Optional max snippet length (default 200). If the
 *                  snippet would exceed this, it returns a window centered
 *                  on the first match.
 */
export function highlightSnippet(
  text: string,
  query: string,
  maxLength = 200,
): { text: string; positions: Array<{ start: number; end: number }> } {
  const queryTerms = parseQuery(query);
  if (!queryTerms.length || !text) {
    return {
      text: text.slice(0, maxLength),
      positions: [],
    };
  }

  const lower = text.toLowerCase();
  const positions: Array<{ start: number; end: number }> = [];

  // Find all occurrences of any query term in the lowercased text
  for (const term of queryTerms) {
    if (term.length === 0) continue;
    let startIdx = 0;
    while (true) {
      const found = lower.indexOf(term, startIdx);
      if (found === -1) break;
      positions.push({ start: found, end: found + term.length });
      startIdx = found + term.length;
    }
  }

  // Sort positions by start index and merge overlapping ranges
  positions.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [];
  for (const pos of positions) {
    if (merged.length === 0) {
      merged.push({ ...pos });
    } else {
      const last = merged[merged.length - 1]!;
      if (pos.start <= last.end) {
        last.end = Math.max(last.end, pos.end);
      } else {
        merged.push({ ...pos });
      }
    }
  }

  // If the text is short enough, return it all
  if (text.length <= maxLength) {
    return { text, positions: merged };
  }

  // Truncate to a window around the first match
  if (merged.length > 0) {
    const firstMatch = merged[0]!;
    const windowStart = Math.max(0, firstMatch.start - Math.floor(maxLength * 0.3));
    const windowEnd = Math.min(text.length, windowStart + maxLength);
    // Adjust start if we are near the end
    const adjustedStart = windowEnd - windowStart < maxLength
      ? Math.max(0, windowEnd - maxLength)
      : windowStart;

    const snippet = text.slice(adjustedStart, windowEnd);

    // Recalculate positions relative to the snippet
    const relPositions = merged
      .map((pos) => ({
        start: Math.max(0, pos.start - adjustedStart),
        end: Math.min(snippet.length, pos.end - adjustedStart),
      }))
      .filter((pos) => pos.start < snippet.length && pos.end > 0);

    return { text: snippet, positions: relPositions };
  }

  // No matches — return the beginning
  return {
    text: text.slice(0, maxLength),
    positions: [],
  };
}

// ── Search ──

/**
 * Search the index for documents matching the given query.
 *
 * Returns results sorted by relevance score (descending), limited to
 * the top 50 results. Each result includes match positions for highlighting.
 *
 * @param index  The search index.
 * @param query  The raw user query string.
 * @param scope  Optional scope filter ("session", "chapter", "character").
 */
export function search(
  index: SearchIndex,
  query: string,
  scope?: string,
): SearchResult[] {
  const queryTerms = parseQuery(query);
  if (!queryTerms.length) return [];

  // Score each doc
  const scored: Array<{ doc: SearchDoc; score: number }> = [];

  for (const doc of Object.values(index.docs)) {
    if (scope && doc.scope !== scope) continue;

    const entry = index.index;
    // Find the combined TF from the index for all query terms
    let totalScore = 0;
    for (const term of queryTerms) {
      const docMap = entry[term];
      if (docMap) {
        const tf = docMap[doc.id];
        if (tf !== undefined) {
          totalScore += tf;
        }
      }
    }

    // Bonus for matching in title / tags
    const titleLower = doc.title.toLowerCase();
    const tagsLower = doc.tags.map((t) => t.toLowerCase());

    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        totalScore += 2;
      }
      if (tagsLower.some((t) => t.includes(term))) {
        totalScore += 1.5;
      }
    }

    if (totalScore > 0) {
      scored.push({ doc, score: totalScore });
    }
  }

  // Sort by score desc
  scored.sort((a, b) => b.score - a.score);

  // Build results with snippets
  const topResults = scored.slice(0, 50);
  return topResults.map(({ doc, score }) => {
    const matches: SearchMatch[] = [];

    // Title match
    const titleSnippet = highlightSnippet(doc.title, query);
    if (titleSnippet.positions.length > 0) {
      matches.push({
        field: "title",
        snippet: titleSnippet.text,
        positions: titleSnippet.positions,
      });
    }

    // Content match
    const contentSnippet = highlightSnippet(doc.content, query);
    if (contentSnippet.positions.length > 0) {
      matches.push({
        field: "content",
        snippet: contentSnippet.text,
        positions: contentSnippet.positions,
      });
    }

    // Tags match
    for (const tag of doc.tags) {
      const tagSnippet = highlightSnippet(tag, query);
      if (tagSnippet.positions.length > 0) {
        matches.push({
          field: "tags",
          snippet: tagSnippet.text,
          positions: tagSnippet.positions,
        });
      }
    }

    // If no field-level matches but we scored >0, include content anyway
    if (matches.length === 0) {
      const fallback = highlightSnippet(doc.content, query);
      matches.push({
        field: "content",
        snippet: fallback.text,
        positions: fallback.positions,
      });
    }

    return { doc, score, matches };
  });
}

// ── Persistence ──

/**
 * Load the search index from disk.
 * Returns an empty index if the file doesn't exist or is corrupted.
 */
export async function loadSearchIndex(projectRoot: string): Promise<SearchIndex> {
  const path = searchIndexPath(projectRoot);
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      version: typeof parsed.version === "number" ? parsed.version : 1,
      docs: parsed.docs ?? {},
      index: parsed.index ?? {},
    };
  } catch {
    return createSearchIndex();
  }
}

/**
 * Persist the search index to disk.
 */
export async function persistSearchIndex(
  projectRoot: string,
  index: SearchIndex,
): Promise<void> {
  const path = searchIndexPath(projectRoot);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(index, null, 2), "utf-8");
}

/**
 * Index all sessions from the JSONL files in the sessions directory.
 *
 * Reads each `.jsonl` file, extracts:
 *   - title from SessionCreatedEvent or session_metadata_updated events
 *   - content from message events (user + assistant)
 *   - scope is always "session"
 *   - tags loaded from session-tags.json
 *
 * @param projectRoot  The project root directory.
 * @param sessionsDirPath  The sessions directory (e.g., {projectRoot}/.inkos/sessions).
 * @param tagsById     Optional map of sessionId -> tag names for tagging docs.
 */
export async function buildIndexFromSessions(
  projectRoot: string,
  sessionsDirPath: string,
  tagsById?: Record<string, string[]>,
): Promise<SearchIndex> {
  let index = createSearchIndex();

  let files: string[];
  try {
    files = await fsReaddir(sessionsDirPath);
  } catch {
    return index;
  }

  const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

  for (const file of jsonlFiles) {
    const sessionId = file.replace(/\.jsonl$/, "");
    let raw: string;
    try {
      raw = await readFile(join(sessionsDirPath, file), "utf-8");
    } catch {
      continue;
    }

    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) continue;

    let title = sessionId;
    const contentParts: string[] = [];
    let updatedAt: string | undefined;

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (!event || typeof event !== "object") continue;

        const evt = event as Record<string, unknown>;

        if (evt.type === "session_created" || evt.type === "session_metadata_updated") {
          const rawTitle = evt.title;
          if (typeof rawTitle === "string" && rawTitle.length > 0) {
            title = rawTitle;
          }
          const rawUpdatedAt = evt.updatedAt;
          if (typeof rawUpdatedAt === "number") {
            updatedAt = new Date(rawUpdatedAt).toISOString();
          }
        }

        if (evt.type === "message") {
          const msg = evt.message as Record<string, unknown> | undefined;
          if (msg && typeof msg === "object") {
            const content = msg.content;
            if (typeof content === "string") {
              contentParts.push(content);
            } else if (Array.isArray(content)) {
              for (const part of content) {
                if (part && typeof part === "object" && (part as Record<string, unknown>).type === "text") {
                  const text = (part as Record<string, unknown>).text;
                  if (typeof text === "string") {
                    contentParts.push(text);
                  }
                }
              }
            }
          }
        }
      } catch {
        continue;
      }
    }

    const tags = tagsById?.[sessionId] ?? [];
    const content = contentParts.join("\n");

    index = addToIndex(index, {
      id: sessionId,
      title,
      content,
      tags,
      scope: "session",
      updatedAt: updatedAt ?? new Date(0).toISOString(),
    });
  }

  return index;
}

/**
 * Rebuild the search index from session data on disk and persist it.
 * Convenience function that loads tags and sessions in one pass.
 */
export async function rebuildSearchIndex(projectRoot: string): Promise<SearchIndex> {
  const sessionsDirPath = join(projectRoot, ".inkos", "sessions");

  // Try to load tags
  let tagsById: Record<string, string[]> = {};
  try {
    const tagsRaw = await readFile(join(projectRoot, ".inkos", "session-tags.json"), "utf-8");
    const tagsParsed = JSON.parse(tagsRaw);
    const tagsData = tagsParsed?.tags as Record<string, Array<{ name: string }>> | undefined;
    if (tagsData) {
      for (const [sessionId, tagList] of Object.entries(tagsData)) {
        if (Array.isArray(tagList)) {
          tagsById[sessionId] = tagList.map((t) => t.name).filter(Boolean);
        }
      }
    }
  } catch {
    // No tags file, proceed without
  }

  const index = await buildIndexFromSessions(projectRoot, sessionsDirPath, tagsById);
  await persistSearchIndex(projectRoot, index);
  return index;
}

/**
 * Search sessions within a project. Loads the index (or builds it if needed)
 * and performs the search.
 */
export async function searchSessions(
  projectRoot: string,
  query: string,
  scope?: string,
): Promise<SearchResult[]> {
  let index = await loadSearchIndex(projectRoot);

  // If index is empty, rebuild it
  if (Object.keys(index.docs).length === 0) {
    index = await rebuildSearchIndex(projectRoot);
  }

  return search(index, query, scope);
}
