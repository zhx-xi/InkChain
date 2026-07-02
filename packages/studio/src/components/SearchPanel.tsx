// ── Search Panel Component ──
// Full-text search UI for sessions, with debounced input, highlighted results,
// scope filter dropdown, and click-to-navigate callback.

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

// ── Types ──

export interface SearchMatch {
  field: string;
  snippet: string;
  positions: Array<{ start: number; end: number }>;
}

export interface SearchDoc {
  id: string;
  title: string;
  content: string;
  tags: string[];
  scope: "session" | "chapter" | "character";
  updatedAt: string;
}

export interface SearchResult {
  doc: SearchDoc;
  score: number;
  matches: SearchMatch[];
}

export interface SearchPanelProps {
  /** The book or project ID to search within. */
  bookId: string;
  /** Callback when the user clicks a result to navigate to it. */
  onNavigate: (sessionId: string) => void;
  /** Optional CSS class for the container. */
  className?: string;
  /** Optional placeholder text for the search input. */
  placeholder?: string;
}

// ── Helpers ──

/**
 * Render a text snippet with `<mark>` tags around matched positions.
 */
function HighlightedText({
  text,
  positions,
  className,
}: {
  text: string;
  positions: Array<{ start: number; end: number }>;
  className?: string;
}) {
  if (positions.length === 0) {
    return <span className={className}>{text}</span>;
  }

  // Build segments by cutting between positions
  const segments: Array<{ highlight: boolean; text: string }> = [];
  let cursor = 0;

  for (const pos of positions) {
    if (pos.start > cursor) {
      segments.push({ highlight: false, text: text.slice(cursor, pos.start) });
    }
    segments.push({ highlight: true, text: text.slice(pos.start, pos.end) });
    cursor = pos.end;
  }
  if (cursor < text.length) {
    segments.push({ highlight: false, text: text.slice(cursor) });
  }

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.highlight ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-700 text-inherit rounded-sm px-0.5"
          >
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}

/**
 * Format a timestamp string for display.
 */
function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

// ── Scope Select ──

const SCOPE_OPTIONS = [
  { value: "", label: "所有范围" },
  { value: "session", label: "会话" },
  { value: "chapter", label: "章节" },
  { value: "character", label: "角色" },
] as const;

// ── Component ──

/**
 * SearchPanel provides a full-text search interface for sessions.
 *
 * Features:
 * - Debounced search input (300ms)
 * - Scope filter dropdown
 * - Result list with highlighted snippets
 * - Click-to-navigate for session results
 * - Keyboard support (Escape to clear, Enter to search)
 */
export function SearchPanel({
  bookId,
  onNavigate,
  className,
  placeholder = "搜索会话内容…",
}: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const performSearch = useCallback(
    async (q: string, sc: string) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setResults([]);
        setHasSearched(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const params = new URLSearchParams({ q: trimmed });
        if (sc) params.set("scope", sc);

        const res = await fetch(`/api/v1/books/${encodeURIComponent(bookId)}/search?${params}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            (body as { error?: { message?: string } })?.error?.message ?? `搜索请求失败 (${res.status})`,
          );
        }

        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results ?? []);
        setHasSearched(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setResults([]);
        setHasSearched(true);
      } finally {
        setIsSearching(false);
      }
    },
    [bookId],
  );

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      performSearch(query, scope);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, scope, performSearch]);

  // Reset search state when bookId changes
  useEffect(() => {
    setQuery("");
    setScope("");
    setResults([]);
    setHasSearched(false);
    setError(null);
  }, [bookId]);

  // Focus the input when the panel mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setQuery("");
      setResults([]);
      setHasSearched(false);
      inputRef.current?.blur();
    }
  };

  const handleResultClick = (result: SearchResult) => {
    onNavigate(result.doc.id);
  };

  // ── Scope label for display ──
  const scopeLabel = SCOPE_OPTIONS.find((o) => o.value === scope)?.label ?? "所有范围";

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {/* Search Input Area */}
      <div className="shrink-0 p-3 border-b border-border">
        <div className="relative">
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label="搜索"
            className={cn(
              "w-full h-9 pl-8 pr-3 text-sm rounded-lg",
              "bg-muted/50 border border-input",
              "placeholder:text-muted-foreground/60",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "transition-colors",
            )}
          />
          {/* Search Icon */}
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>

        {/* Scope Filter + Count */}
        <div className="flex items-center justify-between mt-2">
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            aria-label="搜索范围"
            className={cn(
              "h-7 text-xs rounded-md px-2",
              "bg-muted/30 border border-input",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "cursor-pointer",
            )}
          >
            {SCOPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {hasSearched && !isSearching && (
            <span className="text-xs text-muted-foreground">
              {results.length > 0
                ? `找到 ${results.length} 个结果`
                : "无匹配结果"}
            </span>
          )}
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto">
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <svg
              className="animate-spin h-5 w-5 text-muted-foreground"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="ml-2 text-sm text-muted-foreground">搜索中…</span>
          </div>
        )}

        {error && (
          <div className="px-3 py-4 text-sm text-destructive">
            <p className="font-medium">搜索出错</p>
            <p className="mt-1 text-xs opacity-80">{error}</p>
          </div>
        )}

        {!isSearching && !error && hasSearched && results.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            <p>没有找到匹配的结果</p>
            <p className="mt-1 text-xs opacity-60">尝试使用不同的关键词</p>
          </div>
        )}

        {!isSearching && results.length > 0 && (
          <ul className="divide-y divide-border" role="listbox" aria-label="搜索结果">
            {results.map((result) => {
              const firstMatch = result.matches[0];
              const displaySnippet = firstMatch?.snippet ?? "";
              const displayPositions = firstMatch?.positions ?? [];

              return (
                <li
                  key={result.doc.id}
                  role="option"
                  aria-selected={false}
                >
                  <button
                    type="button"
                    onClick={() => handleResultClick(result)}
                    className={cn(
                      "w-full text-left px-3 py-2.5",
                      "hover:bg-accent/50 transition-colors",
                      "focus-visible:outline-none focus-visible:bg-accent/50",
                      "cursor-pointer",
                    )}
                  >
                    {/* Title */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {result.matches.some((m) => m.field === "title") ? (
                          <HighlightedText
                            text={result.doc.title}
                            positions={
                              result.matches.find((m) => m.field === "title")?.positions ?? []
                            }
                          />
                        ) : (
                          result.doc.title
                        )}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                          "bg-muted text-muted-foreground",
                        )}
                      >
                        {scopeLabel}
                      </span>
                    </div>

                    {/* Tags */}
                    {result.doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {result.doc.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/80"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Snippet */}
                    {displaySnippet && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        <HighlightedText
                          text={displaySnippet}
                          positions={displayPositions}
                        />
                      </p>
                    )}

                    {/* Timestamp */}
                    {result.doc.updatedAt && (
                      <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                        {formatTime(result.doc.updatedAt)}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Initial state when no search was performed */}
        {!isSearching && !hasSearched && !error && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground/60">
            <p>输入关键词搜索会话内容</p>
          </div>
        )}
      </div>
    </div>
  );
}
