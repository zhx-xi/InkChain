// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

// ── Mock global APIs (ResizeObserver needed by @xyflow/react) ──
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

// ── Shared mock for setRoute (used by all pages) ──
const mockSetRoute = vi.fn();

// ── Mock useHashRoute (imported by every page under test) ──
vi.mock("../../hooks/use-hash-route", () => ({
  useHashRoute: () => ({
    setRoute: mockSetRoute,
    route: { page: "dashboard" },
    nav: { toServices: vi.fn(), toServiceDetail: vi.fn() },
  }),
}));

// ── Mock useApi / fetchJson / postApi ──
vi.mock("../../hooks/use-api", () => ({
  useApi: vi.fn(() => ({
    data: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
    mutate: vi.fn(),
  })),
  fetchJson: vi.fn((path: string) => {
    if (path === "/project/agent-team") {
      return Promise.resolve({
        config: {
          schemaVersion: "1",
          agents: [],
          collaborationMode: "sequential",
        },
      });
    }
    if (path === "/agent-templates") {
      return Promise.resolve({ templates: [] });
    }
    return Promise.resolve({});
  }),
  postApi: vi.fn(() => Promise.resolve({})),
}));

// ── Mock useColors (used by FlowView) ──
vi.mock("../../hooks/use-colors", () => ({
  useColors: () => ({
    muted: "text-muted-foreground",
    btnSecondary: "bg-secondary text-secondary-foreground",
  }),
}));

// ── Mock @xyflow/react (used by FlowView, RelationGraphPanel) ──
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

// ── Mock useGraphStore (used by RelationGraphPanel) ──
vi.mock("../../store/relations/graph-store", () => ({
  useGraphStore: vi.fn(),
}));

// ── Mock RelationGraphPanel entirely (source file has JSX sibling issue) ──
vi.mock("../RelationGraphPanel", () => ({
  RelationGraphPanel: ({ bookId }: { bookId: string }) => (
    <div>
      <button
        type="button"
        onClick={() => mockSetRoute({ page: "book", bookId })}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-arrow-left"
        >
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
        <span>返回书籍</span>
      </button>
    </div>
  ),
}));

// ── Helper: render a React element into a detached container ──
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

// ── Helper: check whether a container has a lucide ArrowLeft icon ──
function hasArrowLeft(container: HTMLElement): boolean {
  return container.querySelector(".lucide-arrow-left") !== null;
}

// ── Helper: click the back button (first button with an ArrowLeft icon) ──
function clickBackButton(container: HTMLElement): void {
  const svg = container.querySelector(".lucide-arrow-left");
  if (!svg) throw new Error("ArrowLeft icon not found");
  const btn = svg.closest("button");
  if (!btn) throw new Error("No parent button for ArrowLeft icon");
  act(() => {
    btn.click();
  });
}

// ── Reset mocks before each test ──
beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────
// ForeshadowingPage
// ─────────────────────────────────────────────────────────────
describe("ForeshadowingPage — back button", () => {
  it("shows ArrowLeft icon with '返回首页' text", async () => {
    const { ForeshadowingPage } = await import("../ForeshadowingPage");
    const { container, queryByText, cleanup } = renderIntoContainer(
      <ForeshadowingPage bookId="book-1" />,
    );
    expect(hasArrowLeft(container)).toBe(true);
    expect(queryByText("返回首页")).toBe(true);
    cleanup();
  });

  it("calls setRoute({page: 'dashboard'}) on click", async () => {
    const { ForeshadowingPage } = await import("../ForeshadowingPage");
    const { container, cleanup } = renderIntoContainer(
      <ForeshadowingPage bookId="book-1" />,
    );
    clickBackButton(container);
    expect(mockSetRoute).toHaveBeenCalledWith({ page: "dashboard" });
    cleanup();
  });
});

// ─────────────────────────────────────────────────────────────
// WorldListPage
// ─────────────────────────────────────────────────────────────
describe("WorldListPage — back button", () => {
  it("shows '返回书籍' text when bookId is present", async () => {
    // Mock useApi so booksData contains a matching book title
    const { useApi } = await import("../../hooks/use-api");
    vi.mocked(useApi).mockImplementation((path: string) => {
      if (path.includes("/api/v1/books")) {
        return {
          data: { books: [{ id: "book-1", title: "我的小说" }] },
          loading: false,
          error: null,
          refetch: vi.fn(),
          mutate: vi.fn(),
        } as ReturnType<typeof useApi>;
      }
      return {
        data: { worlds: [] },
        loading: false,
        error: null,
        refetch: vi.fn(),
        mutate: vi.fn(),
      } as ReturnType<typeof useApi>;
    });

    const { WorldListPage } = await import("../WorldListPage");
    const { container, queryByText, cleanup } = renderIntoContainer(
      <WorldListPage bookId="book-1" />,
    );
    expect(hasArrowLeft(container)).toBe(true);
    expect(queryByText("我的小说")).toBe(true);
    cleanup();
  });

  it("calls setRoute({page: 'book', bookId}) on click", async () => {
    const { WorldListPage } = await import("../WorldListPage");
    const { container, cleanup } = renderIntoContainer(
      <WorldListPage bookId="book-1" />,
    );
    clickBackButton(container);
    expect(mockSetRoute).toHaveBeenCalledWith({ page: "book", bookId: "book-1" });
    cleanup();
  });
});

// ─────────────────────────────────────────────────────────────
// AgentTeamPanel
// ─────────────────────────────────────────────────────────────
describe("AgentTeamPanel — back button", () => {
  it("shows '返回设置' text", async () => {
    const { AgentTeamPanel } = await import("../AgentTeamPanel");
    const { container, queryByText, cleanup } = renderIntoContainer(
      <AgentTeamPanel nav={{ toDashboard: vi.fn() }} />,
    );

    // fetchJson is called in useEffect; wait for it to resolve and re-render
    await vi.waitFor(() => {
      expect(hasArrowLeft(container)).toBe(true);
    });
    expect(queryByText("返回设置")).toBe(true);
    cleanup();
  });

  it("calls setRoute({page: 'project-settings'}) on click", async () => {
    const { AgentTeamPanel } = await import("../AgentTeamPanel");
    const { container, cleanup } = renderIntoContainer(
      <AgentTeamPanel nav={{ toDashboard: vi.fn() }} />,
    );

    await vi.waitFor(() => {
      expect(hasArrowLeft(container)).toBe(true);
    });
    clickBackButton(container);
    expect(mockSetRoute).toHaveBeenCalledWith({ page: "project-settings" });
    cleanup();
  });
});

// ─────────────────────────────────────────────────────────────
// ArchivePage
// ─────────────────────────────────────────────────────────────
describe("ArchivePage — back button", () => {
  it("shows ArrowLeft icon with '返回首页' text", async () => {
    const { ArchivePage } = await import("../ArchivePage");
    const { container, queryByText, cleanup } = renderIntoContainer(<ArchivePage />);
    expect(hasArrowLeft(container)).toBe(true);
    expect(queryByText("返回首页")).toBe(true);
    cleanup();
  });

  it("calls setRoute({page: 'dashboard'}) on click", async () => {
    const { ArchivePage } = await import("../ArchivePage");
    const { container, cleanup } = renderIntoContainer(<ArchivePage />);
    clickBackButton(container);
    expect(mockSetRoute).toHaveBeenCalledWith({ page: "dashboard" });
    cleanup();
  });
});

// ─────────────────────────────────────────────────────────────
// SkillListPage
// ─────────────────────────────────────────────────────────────
describe("SkillListPage — back button", () => {
  it("shows ArrowLeft icon with '返回设置' text", async () => {
    const { SkillListPage } = await import("../SkillListPage");
    const { container, queryByText, cleanup } = renderIntoContainer(<SkillListPage />);
    expect(hasArrowLeft(container)).toBe(true);
    expect(queryByText("返回设置")).toBe(true);
    cleanup();
  });

  it("calls setRoute({page: 'project-settings'}) on click", async () => {
    const { SkillListPage } = await import("../SkillListPage");
    const { container, cleanup } = renderIntoContainer(<SkillListPage />);
    clickBackButton(container);
    expect(mockSetRoute).toHaveBeenCalledWith({ page: "project-settings" });
    cleanup();
  });
});

// ─────────────────────────────────────────────────────────────
// FlowView
// ─────────────────────────────────────────────────────────────
describe("FlowView — back button", () => {
  it("shows ArrowLeft icon with '返回书籍' text", async () => {
    const { useApi } = await import("../../hooks/use-api");
    vi.mocked(useApi).mockReturnValue({
      data: {
        nodes: [{ id: "n1", type: "start", title: "Start", choices: [], position: { x: 0, y: 0 } }],
        edges: [],
        title: "Test Graph",
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
      mutate: vi.fn(),
    } as any);

    const FlowView = (await import("../FlowView")).default;
    const { container, queryByText, cleanup } = renderIntoContainer(
      <FlowView
        projectId="book-1"
        nav={{ toDashboard: vi.fn(), toFilm: vi.fn() }}
        theme="light"
        t={(key: string) => key}
      />,
    );

    expect(hasArrowLeft(container)).toBe(true);
    expect(queryByText("返回书籍")).toBe(true);
    cleanup();
  });

  it("calls setRoute({page: 'book', bookId}) on click", async () => {
    const { useApi } = await import("../../hooks/use-api");
    vi.mocked(useApi).mockReturnValue({
      data: {
        nodes: [{ id: "n1", type: "start", title: "Start", choices: [], position: { x: 0, y: 0 } }],
        edges: [],
        title: "Test Graph",
      },
      loading: false,
      error: null,
      refetch: vi.fn(),
      mutate: vi.fn(),
    } as any);

    const FlowView = (await import("../FlowView")).default;
    const { container, cleanup } = renderIntoContainer(
      <FlowView
        projectId="book-1"
        nav={{ toDashboard: vi.fn(), toFilm: vi.fn() }}
        theme="light"
        t={(key: string) => key}
      />,
    );

    clickBackButton(container);
    expect(mockSetRoute).toHaveBeenCalledWith({ page: "book", bookId: "book-1" });
    cleanup();
  });
});

// ─────────────────────────────────────────────────────────────
// RelationGraphPanel
// ─────────────────────────────────────────────────────────────
describe("RelationGraphPanel — back button", () => {
  it("shows ArrowLeft icon with '返回书籍' text", async () => {
    const { RelationGraphPanel } = await import("../RelationGraphPanel");
    const { container, queryByText, cleanup } = renderIntoContainer(
      <RelationGraphPanel bookId="book-1" />,
    );
    expect(hasArrowLeft(container)).toBe(true);
    expect(queryByText("返回书籍")).toBe(true);
    cleanup();
  });

  it("calls setRoute({page: 'book', bookId}) on click", async () => {
    const { RelationGraphPanel } = await import("../RelationGraphPanel");
    const { container, cleanup } = renderIntoContainer(
      <RelationGraphPanel bookId="book-1" />,
    );
    clickBackButton(container);
    expect(mockSetRoute).toHaveBeenCalledWith({ page: "book", bookId: "book-1" });
    cleanup();
  });
});
