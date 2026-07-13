// ── useTimelineSegments ──
// Hook for segmented / paginated timeline data loading with volume-based filtering.
// Supports: volume selection → filter events by volume chapters,
//           client-side pagination (initial 100, load-more),
//           lightweight mode flag for 500+ events.

import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchJson } from "./use-api";

// ── Types ──

export interface Volume {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: "draft" | "active" | "completed";
  readonly order: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TimelineEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly eventType: string;
  readonly title: string;
  readonly description: string;
  readonly relatedCharacters: readonly string[];
  readonly chapter: number;
  readonly importance: number;
  readonly tags?: readonly string[];
}

interface TimelineResponse {
  readonly events: readonly TimelineEvent[];
}

interface VolumeChaptersResponse {
  readonly volumeId: string;
  readonly chapters: ReadonlyArray<{
    readonly number: number;
    readonly title: string;
    readonly status: string;
    readonly wordCount: number;
    readonly volumeId: string | null;
  }>;
}

// ── Constants ──

const INITIAL_PAGE_SIZE = 100;
const LOAD_MORE_SIZE = 100;

// ── Hook ──

export function useTimelineSegments(bookId: string) {
  // Volumes
  const [volumes, setVolumes] = useState<readonly Volume[]>([]);
  const [volumesLoading, setVolumesLoading] = useState(true);
  const [volumesError, setVolumesError] = useState<string | null>(null);

  // Volume selection — null means "all volumes" (no filter)
  const [selectedVolumeId, setSelectedVolumeId] = useState<string | null>(null);

  // All timeline events (from API)
  const [allEvents, setAllEvents] = useState<readonly TimelineEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // Chapters per volume (for filtering)
  const [volumeChaptersMap, setVolumeChaptersMap] = useState<Map<string, readonly number[]>>(new Map());

  // Pagination
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);

  // ── Fetch volumes ──

  const fetchVolumes = useCallback(async () => {
    setVolumesLoading(true);
    setVolumesError(null);
    try {
      const data = await fetchJson<{ volumes: readonly Volume[] }>(`/books/${bookId}/volumes`);
      setVolumes(data.volumes);
      // Always default to "all volumes" (null) instead of auto-selecting the first volume
      if (data.volumes.length === 0) {
        setSelectedVolumeId(null);
      }
    } catch (err) {
      // Volume API may not exist for older projects — treat as no volumes
      setVolumes([]);
      setSelectedVolumeId(null);
      setVolumesError(err instanceof Error ? err.message : String(err));
    } finally {
      setVolumesLoading(false);
    }
  }, [bookId]);

  // ── Fetch volume chapters (to know which chapters belong to a volume) ──

  const fetchVolumeChapters = useCallback(
    async (volumeId: string) => {
      try {
        const data = await fetchJson<VolumeChaptersResponse>(
          `/books/${bookId}/volumes/${volumeId}/chapters`,
        );
        const chapterNumbers = data.chapters.map((ch) => ch.number);
        setVolumeChaptersMap((prev) => {
          const next = new Map(prev);
          next.set(volumeId, chapterNumbers);
          return next;
        });
      } catch {
        // Silently fail — volume chapters may not be available
        setVolumeChaptersMap((prev) => {
          const next = new Map(prev);
          next.set(volumeId, []);
          return next;
        });
      }
    },
    [bookId],
  );

  // ── Fetch all timeline events ──

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const data = await fetchJson<TimelineResponse>(`/books/${bookId}/timelines`);
      setAllEvents(data.events);
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : String(err));
    } finally {
      setEventsLoading(false);
    }
  }, [bookId]);

  // ── Combined refetch ──

  const refetch = useCallback(() => {
    setVisibleCount(INITIAL_PAGE_SIZE);
    void fetchVolumes();
    void fetchEvents();
  }, [fetchVolumes, fetchEvents]);

  // ── Initial load ──

  useEffect(() => {
    void fetchVolumes();
    void fetchEvents();
  }, [fetchVolumes, fetchEvents]);

  // ── When selected volume changes, fetch its chapters ──

  useEffect(() => {
    if (selectedVolumeId && volumes.length > 0) {
      void fetchVolumeChapters(selectedVolumeId);
    }
  }, [selectedVolumeId, volumes.length, fetchVolumeChapters]);

  // ── Filtered events (by volume) ──

  const filteredEvents = useMemo<readonly TimelineEvent[]>(() => {
    if (!selectedVolumeId || volumes.length === 0) {
      // No volume selected or no volumes exist → show all
      return allEvents;
    }

    const chapters = volumeChaptersMap.get(selectedVolumeId);
    if (chapters === undefined) {
      // Chapters not loaded yet → show all (transient, will be fixed on next render)
      return allEvents;
    }
    if (chapters.length === 0) {
      // Volume has no chapters → show no events (correct)
      return [];
    }

    const chapterSet = new Set(chapters);
    return allEvents.filter((e) => chapterSet.has(e.chapter));
  }, [allEvents, selectedVolumeId, volumes.length, volumeChaptersMap]);

  // ── Paginated events (slice) ──

  const paginatedEvents = useMemo<readonly TimelineEvent[]>(() => {
    return filteredEvents.slice(0, visibleCount);
  }, [filteredEvents, visibleCount]);

  const totalFilteredCount = filteredEvents.length;
  const loadedCount = paginatedEvents.length;
  const hasMore = loadedCount < totalFilteredCount;

  // ── Load more ──

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + LOAD_MORE_SIZE, totalFilteredCount));
  }, [totalFilteredCount]);

  // ── Handle volume change ──

  const handleVolumeChange = useCallback(
    (volumeId: string | null) => {
      setSelectedVolumeId(volumeId);
      setVisibleCount(INITIAL_PAGE_SIZE);
      if (volumeId && !volumeChaptersMap.has(volumeId)) {
        void fetchVolumeChapters(volumeId);
      }
    },
    [fetchVolumeChapters, volumeChaptersMap],
  );

  // ── Lightweight mode (no avatars, less decoration) for 500+ events ──

  const totalEventCount = allEvents.length;
  const isLightweightMode = totalEventCount >= 500;

  const loading = eventsLoading || volumesLoading;
  const error = eventsError ?? volumesError;

  return {
    // Volumes
    volumes,
    selectedVolumeId,
    setSelectedVolumeId: handleVolumeChange,

    // Events (paginated, filtered by volume)
    events: paginatedEvents,
    allEvents,
    totalFilteredCount,
    loadedCount,
    totalCount: totalEventCount,

    // Pagination
    hasMore,
    loadMore,
    resetPagination: useCallback(() => setVisibleCount(INITIAL_PAGE_SIZE), []),

    // Status
    loading,
    error,
    refetch,

    // Lightweight mode
    isLightweightMode,
  } as const;
}
