// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

// ── Mock global APIs needed by @xyflow/react ──
beforeEach(() => {
  // Mock ResizeObserver (used by @xyflow/react)
  vi.stubGlobal(
    "ResizeObserver",
    vi.fn(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Mock the useTimelineSegments hook ──
vi.mock("../../hooks/use-timeline-segments", () => ({
  useTimelineSegments: vi.fn(),
}));

import { useTimelineSegments } from "../../hooks/use-timeline-segments";

const mockEvents = [
  {
    id: "evt-1",
    timestamp: "2025-01-15T10:00:00.000Z",
    eventType: "plot",
    title: "主角进入森林",
    description: "主角为了寻找失踪的同伴，进入迷雾森林。",
    relatedCharacters: ["林夕", "阿诺"],
    chapter: 1,
    importance: 4,
    tags: ["探险", "森林"],
  },
  {
    id: "evt-2",
    timestamp: "2025-01-20T14:00:00.000Z",
    eventType: "character",
    title: "林夕回忆过去",
    description: "林夕在篝火旁讲述自己的身世。",
    relatedCharacters: ["林夕"],
    chapter: 2,
    importance: 3,
  },
  {
    id: "evt-3",
    timestamp: "2025-02-01T08:00:00.000Z",
    eventType: "world",
    title: "古堡出现",
    description: "迷雾中浮现出一座古老的城堡。",
    relatedCharacters: ["林夕", "阿诺", "苏瑶"],
    chapter: 2,
    importance: 5,
    tags: ["古堡", "关键场景"],
  },
];

function buildDefaultMock(overrides: Record<string, unknown> = {}) {
  return {
    volumes: [],
    selectedVolumeId: null,
    setSelectedVolumeId: vi.fn(),
    events: [],
    allEvents: [],
    totalFilteredCount: 0,
    loadedCount: 0,
    totalCount: 0,
    hasMore: false,
    loadMore: vi.fn(),
    resetPagination: vi.fn(),
    loading: false,
    error: null,
    refetch: vi.fn(),
    isLightweightMode: false,
    ...overrides,
  };
}

/**
 * Helper: render a React element into a detached container and return utils.
 */
function renderIntoContainer(element: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    root,
    queryByText(text: string): boolean {
      return container.textContent?.includes(text) ?? false;
    },
    querySelector(selector: string): Element | null {
      return container.querySelector(selector);
    },
    cleanup() {
      act(() => {
        root.unmount();
      });
      document.body.removeChild(container);
    },
  };
}

describe("TimelinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner while fetching data", async () => {
    vi.mocked(useTimelineSegments).mockReturnValue(
      buildDefaultMock({ loading: true }) as ReturnType<typeof useTimelineSegments>,
    );

    const { TimelinePage } = await import("../TimelinePage");
    const { querySelector, queryByText, cleanup } = renderIntoContainer(
      <TimelinePage bookId="test-book" />,
    );

    expect(querySelector(".animate-spin")).toBeTruthy();
    expect(queryByText("加载时间线…")).toBe(true);
    cleanup();
  });

  it("shows error state when API fails", async () => {
    vi.mocked(useTimelineSegments).mockReturnValue(
      buildDefaultMock({ error: "Network error" }) as ReturnType<typeof useTimelineSegments>,
    );

    const { TimelinePage } = await import("../TimelinePage");
    const { queryByText, cleanup } = renderIntoContainer(
      <TimelinePage bookId="test-book" />,
    );

    expect(queryByText("无法加载时间线数据")).toBe(true);
    expect(queryByText("Network error")).toBe(true);
    expect(queryByText("重试")).toBe(true);
    cleanup();
  });

  it("shows empty state when there are no events", async () => {
    vi.mocked(useTimelineSegments).mockReturnValue(
      buildDefaultMock() as ReturnType<typeof useTimelineSegments>,
    );

    const { TimelinePage } = await import("../TimelinePage");
    const { queryByText, cleanup } = renderIntoContainer(
      <TimelinePage bookId="test-book" />,
    );

    expect(queryByText("暂无时间线事件")).toBe(true);
    cleanup();
  });

  it("renders timeline with events and shows header info", async () => {
    vi.mocked(useTimelineSegments).mockReturnValue(
      buildDefaultMock({
        events: mockEvents,
        allEvents: mockEvents,
        totalFilteredCount: 3,
        loadedCount: 3,
        totalCount: 3,
      }) as ReturnType<typeof useTimelineSegments>,
    );

    const { TimelinePage } = await import("../TimelinePage");
    const { container, queryByText, cleanup } = renderIntoContainer(
      <TimelinePage bookId="test-book" />,
    );

    expect(queryByText("时间线")).toBe(true);
    expect(container.textContent?.includes("3 个事件")).toBe(true);
    expect(container.textContent?.includes("2 章")).toBe(true);
    expect(container.textContent?.includes("3 个角色")).toBe(true);

    // Legend
    expect(queryByText("剧情")).toBe(true);
    expect(queryByText("角色")).toBe(true);
    expect(queryByText("世界观")).toBe(true);

    cleanup();
  });
});
