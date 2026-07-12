// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

// ── Mock global APIs ──
beforeEach(() => {
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

// ── Mock hooks at top level ──
const mockSetRoute = vi.fn();

vi.mock("../../hooks/use-hash-route", () => ({
  useHashRoute: vi.fn(() => ({
    setRoute: mockSetRoute,
    route: { page: "dashboard" },
    nav: { toServices: vi.fn(), toServiceDetail: vi.fn() },
  })),
}));

vi.mock("../../hooks/use-api", () => ({
  useApi: vi.fn(),
  fetchJson: vi.fn(),
  postApi: vi.fn(),
}));

// ── Mock @xyflow/react (used by AgentFlowEditor imported from AgentTeamPanel) ──
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  Handle: () => null,
  Position: { Left: "left", Right: "right" },
  useNodesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  useEdgesState: vi.fn(() => [[], vi.fn(), vi.fn()]),
  BackgroundVariant: { Dots: "dots" },
  MarkerType: { ArrowClosed: "arrowclosed" },
  BaseEdge: () => null,
  getBezierPath: vi.fn(() => ["", ""]),
}));

// ── Mock inkos-core models (used by ForeshadowingPage) ──
vi.mock("@actalk/inkchain-core/models/foreshadowing.js", () => ({
  FORESHADOWING_TYPE_LABELS: {
    "情节伏笔": "情节伏笔",
    "角色伏笔": "角色伏笔",
    "物品伏笔": "物品伏笔",
    "设定伏笔": "设定伏笔",
  },
  FORESHADOWING_STATUS_LABELS: {
    active: "活跃",
    paid_off: "已回收",
    abandoned: "已废弃",
  },
  ForeshadowingTypeEnum: {
    options: ["情节伏笔", "角色伏笔", "物品伏笔", "设定伏笔"],
  },
  ForeshadowingStatusEnum: {
    options: ["active", "paid_off", "abandoned"],
  },
}));

import { useApi, fetchJson } from "../../hooks/use-api";

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

function buildApiMock(overrides: Record<string, unknown> = {}) {
  return {
    data: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
    mutate: vi.fn(),
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// ForeshadowingPage (6 test cases)
// ────────────────────────────────────────────────────────────────────────────

describe("ForeshadowingPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. loading skeleton — shows animate-pulse skeleton when loading=true", async () => {
    vi.mocked(useApi).mockReturnValue(buildApiMock({ loading: true }));
    const { ForeshadowingPage } = await import("../ForeshadowingPage");
    const { querySelector, cleanup } = renderIntoContainer(
      <ForeshadowingPage bookId="test-book" />,
    );

    expect(querySelector(".animate-pulse")).toBeTruthy();
    cleanup();
  });

  it("2. empty state — shows '暂无伏笔' with Sparkles icon when data is empty", async () => {
    vi.mocked(useApi).mockReturnValue(
      buildApiMock({ data: { foreshadowing: [], total: 0, currentChapter: null } }),
    );
    const { ForeshadowingPage } = await import("../ForeshadowingPage");
    const { queryByText, cleanup } = renderIntoContainer(
      <ForeshadowingPage bookId="test-book" />,
    );

    expect(queryByText("暂无伏笔")).toBe(true);
    cleanup();
  });

  it("3. list rendering — 2 items with titles and type badges", async () => {
    const mockData = {
      foreshadowing: [
        {
          id: "fs-1",
          title: "迷雾森林",
          description: "主角进入迷雾森林",
          type: "情节伏笔",
          status: "active",
          createdChapter: 1,
          lastMentionedChapter: 2,
          expectedPayoffChapter: 10,
          _forgotten: false,
        },
        {
          id: "fs-2",
          title: "神秘戒指",
          description: "一枚古老戒指",
          type: "物品伏笔",
          status: "paid_off",
          createdChapter: 3,
          lastMentionedChapter: 5,
          payoffChapter: 8,
          _forgotten: false,
        },
      ],
      total: 2,
      currentChapter: 15,
    };
    vi.mocked(useApi).mockReturnValue(buildApiMock({ data: mockData }));
    const { ForeshadowingPage } = await import("../ForeshadowingPage");
    const { queryByText, cleanup } = renderIntoContainer(
      <ForeshadowingPage bookId="test-book" />,
    );

    expect(queryByText("迷雾森林")).toBe(true);
    expect(queryByText("神秘戒指")).toBe(true);
    expect(queryByText("情节伏笔")).toBe(true);
    expect(queryByText("物品伏笔")).toBe(true);
    cleanup();
  });

  it("4. error state — shows error message in red", async () => {
    vi.mocked(useApi).mockReturnValue(buildApiMock({ error: "Network error" }));
    const { ForeshadowingPage } = await import("../ForeshadowingPage");
    const { queryByText, querySelector, cleanup } = renderIntoContainer(
      <ForeshadowingPage bookId="test-book" />,
    );

    expect(queryByText("无法加载伏笔数据")).toBe(true);
    expect(querySelector(".text-destructive")).toBeTruthy();
    cleanup();
  });

  it("5. bookId passed through encodeURIComponent in API call", async () => {
    // Mock book data first (for chapter count), then foreshadowing data (main call)
    vi.mocked(useApi)
      .mockReturnValueOnce(buildApiMock({ data: { nextChapter: 31 } })) // first call: book data with 30 chapters
      .mockReturnValue(buildApiMock()); // subsequent calls: foreshadowing data

    const { ForeshadowingPage } = await import("../ForeshadowingPage");
    const { cleanup } = renderIntoContainer(
      <ForeshadowingPage bookId="special/book?id" />,
    );

    // Book API call (first useApi call)
    expect(vi.mocked(useApi)).toHaveBeenNthCalledWith(
      1,
      `/api/v1/books/${encodeURIComponent("special/book?id")}`,
    );
    // Foreshadowing API call uses dynamic chapter count (nextChapter - 1 = 30)
    expect(vi.mocked(useApi)).toHaveBeenNthCalledWith(
      2,
      `/api/foreshadowing?bookId=${encodeURIComponent("special/book?id")}&currentChapter=30`,
    );
    cleanup();
  });

  it("6. back button calls setRoute({page:'dashboard'})", async () => {
    vi.mocked(useApi).mockReturnValue(buildApiMock());
    const { ForeshadowingPage } = await import("../ForeshadowingPage");
    const { container, cleanup } = renderIntoContainer(
      <ForeshadowingPage bookId="test-book" />,
    );

    const backBtn = container.querySelector("button") as HTMLButtonElement;
    expect(backBtn).toBeTruthy();
    act(() => {
      backBtn.click();
    });
    expect(mockSetRoute).toHaveBeenCalledWith({ page: "dashboard" });
    cleanup();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// WorldListPage (5 test cases)
// ────────────────────────────────────────────────────────────────────────────

describe("WorldListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("7. bookId passed — calls /api/books/<bookId>/worlds", async () => {
    vi.mocked(useApi)
      .mockReturnValueOnce(buildApiMock())
      .mockReturnValueOnce(buildApiMock());
    const { WorldListPage } = await import("../WorldListPage");
    const { cleanup } = renderIntoContainer(<WorldListPage bookId="book-123" />);

    expect(vi.mocked(useApi)).toHaveBeenNthCalledWith(2, "/api/books/book-123/worlds");
    cleanup();
  });

  it("8. no bookId — calls /api/worlds", async () => {
    vi.mocked(useApi)
      .mockReturnValueOnce(buildApiMock())
      .mockReturnValueOnce(buildApiMock());
    const { WorldListPage } = await import("../WorldListPage");
    const { cleanup } = renderIntoContainer(<WorldListPage />);

    expect(vi.mocked(useApi)).toHaveBeenNthCalledWith(2, "/api/worlds");
    cleanup();
  });

  it("9. empty data shows different text based on bookId presence", async () => {
    // Without bookId
    vi.mocked(useApi)
      .mockReturnValueOnce(buildApiMock())
      .mockReturnValueOnce(buildApiMock({ data: { worlds: [] } }));
    const { WorldListPage } = await import("../WorldListPage");
    const { queryByText: q1, cleanup: c1 } = renderIntoContainer(<WorldListPage />);
    expect(q1("还没有创建任何世界设定")).toBe(true);
    c1();

    // With bookId
    vi.clearAllMocks();
    vi.mocked(useApi)
      .mockReturnValueOnce(
        buildApiMock({ data: { books: [{ id: "book-123", title: "Test Book" }] } }),
      )
      .mockReturnValueOnce(buildApiMock({ data: { worlds: [] } }));
    const { queryByText: q2, cleanup: c2 } = renderIntoContainer(
      <WorldListPage bookId="book-123" />,
    );
    expect(q2("该书还没有关联任何世界设定")).toBe(true);
    c2();
  });

  it("10. back button navigates correctly based on bookId", async () => {
    // Without bookId → dashboard
    vi.mocked(useApi)
      .mockReturnValueOnce(buildApiMock())
      .mockReturnValueOnce(buildApiMock());
    const { WorldListPage: WLP1 } = await import("../WorldListPage");
    const { container: c1, cleanup: cl1 } = renderIntoContainer(<WLP1 />);
    const btn1 = c1.querySelector("button") as HTMLButtonElement;
    act(() => {
      btn1.click();
    });
    expect(mockSetRoute).toHaveBeenCalledWith({ page: "dashboard" });
    cl1();

    // With bookId → book detail
    vi.clearAllMocks();
    vi.mocked(useApi)
      .mockReturnValueOnce(buildApiMock())
      .mockReturnValueOnce(buildApiMock());
    const { WorldListPage: WLP2 } = await import("../WorldListPage");
    const { container: c2, cleanup: cl2 } = renderIntoContainer(
      <WLP2 bookId="book-123" />,
    );
    const btn2 = c2.querySelector("button") as HTMLButtonElement;
    act(() => {
      btn2.click();
    });
    expect(mockSetRoute).toHaveBeenCalledWith({ page: "book", bookId: "book-123" });
    cl2();
  });

  it("11. AI Extract button exists", async () => {
    vi.mocked(useApi)
      .mockReturnValueOnce(buildApiMock())
      .mockReturnValueOnce(buildApiMock());
    const { WorldListPage } = await import("../WorldListPage");
    const { queryByText, cleanup } = renderIntoContainer(<WorldListPage />);

    expect(queryByText("AI 提取")).toBe(true);
    cleanup();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// AgentTeamPanel (5 test cases)
// ────────────────────────────────────────────────────────────────────────────

describe("AgentTeamPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("12. loading spinner shown while fetching data", async () => {
    vi.mocked(fetchJson).mockReturnValue(new Promise(() => {}));
    const { AgentTeamPanel } = await import("../AgentTeamPanel");
    const { querySelector, queryByText, cleanup } = renderIntoContainer(
      <AgentTeamPanel nav={{ toDashboard: vi.fn() }} />,
    );

    expect(querySelector(".animate-spin")).toBeTruthy();
    expect(queryByText("加载 Agent Team…")).toBe(true);
    cleanup();
  });

  it("13. load error + retry button when fetchJson rejects", async () => {
    vi.mocked(fetchJson).mockRejectedValue(new Error("API error"));
    const { AgentTeamPanel } = await import("../AgentTeamPanel");
    const { queryByText, cleanup } = renderIntoContainer(
      <AgentTeamPanel nav={{ toDashboard: vi.fn() }} />,
    );

    await vi.waitFor(() => {
      expect(queryByText("加载失败：API error")).toBe(true);
    });
    expect(queryByText("重试")).toBe(true);
    cleanup();
  });

  it("14. renders 7 Agent cards when data loads successfully", async () => {
    vi.mocked(fetchJson).mockImplementation((path: string) => {
      if (path.includes("/project/agent-team")) {
        return Promise.resolve({
          config: {
            schemaVersion: "1.0",
            agents: [
              { role: "writer", enabled: true },
              { role: "auditor", enabled: true },
              { role: "editor", enabled: true },
              { role: "architect", enabled: true },
              { role: "planner", enabled: true },
              { role: "observer", enabled: true },
              { role: "reviser", enabled: true },
            ],
            defaultModel: "gpt-4",
            collaborationMode: "sequential" as const,
          },
        });
      }
      if (path.includes("/agent-order")) {
        return Promise.resolve({ order: ["writer", "auditor", "editor", "architect", "planner", "observer", "reviser"] });
      }
      if (path.includes("/agent-templates")) {
        return Promise.resolve({ templates: [] });
      }
      if (path.includes("/custom-agents")) {
        return Promise.resolve({ agents: [] });
      }
      return Promise.resolve(null);
    });
    const { AgentTeamPanel } = await import("../AgentTeamPanel");
    const { container, queryByText, cleanup } = renderIntoContainer(
      <AgentTeamPanel nav={{ toDashboard: vi.fn() }} />,
    );

    await vi.waitFor(() => {
      expect(queryByText("执笔者")).toBe(true);
    });
    expect(queryByText("审核者")).toBe(true);
    expect(queryByText("Editor")).toBe(true);
    expect(queryByText("架构师")).toBe(true);
    expect(queryByText("规划师")).toBe(true);
    expect(queryByText("Observer")).toBe(true);
    expect(queryByText("修订者")).toBe(true);

    const grid = container.querySelector(".grid");
    expect(grid?.children.length).toBe(7);
    cleanup();
  });

  it("15. back button navigates to project-settings", async () => {
    vi.mocked(fetchJson).mockImplementation((path: string) => {
      if (path.includes("/project/agent-team")) {
        return Promise.resolve({ config: { schemaVersion: "1.0", agents: [], defaultModel: "gpt-4", collaborationMode: "sequential" as const } });
      }
      if (path.includes("/agent-order")) {
        return Promise.resolve({ order: [] });
      }
      if (path.includes("/agent-templates")) {
        return Promise.resolve({ templates: [] });
      }
      if (path.includes("/custom-agents")) {
        return Promise.resolve({ agents: [] });
      }
      return Promise.resolve(null);
    });
    const { AgentTeamPanel } = await import("../AgentTeamPanel");
    const { container, cleanup } = renderIntoContainer(
      <AgentTeamPanel nav={{ toDashboard: vi.fn() }} />,
    );

    await vi.waitFor(() => {
      expect(container.textContent?.includes("默认预设")).toBe(true);
    });

    const backBtn = container.querySelector("button") as HTMLButtonElement;
    act(() => {
      backBtn.click();
    });
    expect(mockSetRoute).toHaveBeenCalledWith({ page: "project-settings" });
    cleanup();
  });

  it("16. preset selector exists", async () => {
    vi.mocked(fetchJson).mockImplementation((path: string) => {
      if (path.includes("/project/agent-team")) {
        return Promise.resolve({ config: { schemaVersion: "1.0", agents: [], defaultModel: "gpt-4", collaborationMode: "sequential" as const } });
      }
      if (path.includes("/agent-order")) {
        return Promise.resolve({ order: [] });
      }
      if (path.includes("/agent-templates")) {
        return Promise.resolve({ templates: [] });
      }
      if (path.includes("/custom-agents")) {
        return Promise.resolve({ agents: [] });
      }
      return Promise.resolve(null);
    });
    const { AgentTeamPanel } = await import("../AgentTeamPanel");
    const { queryByText, cleanup } = renderIntoContainer(
      <AgentTeamPanel nav={{ toDashboard: vi.fn() }} />,
    );

    await vi.waitFor(() => {
      expect(queryByText("默认预设")).toBe(true);
    });
    cleanup();
  });
});
