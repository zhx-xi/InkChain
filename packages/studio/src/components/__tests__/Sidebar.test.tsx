// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

// ── Mock globals ──
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

// ── Shared mock data ──
const mockApiResponses: Record<string, unknown> = {};
const mockNav = {
  toDashboard: vi.fn(),
  toChat: vi.fn(),
  toBook: vi.fn(),
  toBookCreate: vi.fn(),
  toServices: vi.fn(),
  toProjectSettings: vi.fn(),
  toDaemon: vi.fn(),
  toLogs: vi.fn(),
  toGenres: vi.fn(),
  toStyle: vi.fn(),
  toImport: vi.fn(),
  toRadar: vi.fn(),
  toDoctor: vi.fn(),
  toRelations: vi.fn(),
  toTimeline: vi.fn(),
  toFilmStudio: vi.fn(),
  toAgents: vi.fn(),
  toArchive: vi.fn(),
  toSkills: vi.fn(),
  toForeshadowing: vi.fn(),
  toWorlds: vi.fn(),
  toWorldDetail: vi.fn(),
  toWorldCreate: vi.fn(),
  toPublish: vi.fn(),
  toBookWorlds: vi.fn(),
};

const mockStoreState: Record<string, unknown> = {};

// ── Mock hooks ──
vi.mock("../../hooks/use-api", () => ({
  useApi: vi.fn((path: string) => {
    const response = mockApiResponses[path];
    return {
      data: response ?? null,
      loading: false,
      error: null,
      refetch: vi.fn(),
      mutate: vi.fn(),
    };
  }),
}));

vi.mock("../../hooks/use-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, lang: "zh" }),
}));

// ── Mock UI components that render in portals ──
vi.mock("../ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children, ...props }: Record<string, unknown>) => (
    <button {...props} data-testid="dropdown-trigger" type="button">
      {children as React.ReactNode}
    </button>
  ),
  DropdownMenuContent: ({ children, ...props }: Record<string, unknown>) => (
    <div {...props} data-testid="dropdown-content">
      {children as React.ReactNode}
    </div>
  ),
  DropdownMenuItem: ({ children, onClick, ...props }: Record<string, unknown>) => (
    <button
      {...props}
      data-testid="dropdown-item"
      type="button"
      onClick={onClick as React.MouseEventHandler}
    >
      {children as React.ReactNode}
    </button>
  ),
  DropdownMenuSeparator: () => <hr data-testid="dropdown-separator" />,
}));

vi.mock("../ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children, ...props }: Record<string, unknown>) => (
    <div {...props} data-testid="dialog-content">
      {children as React.ReactNode}
    </div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-title">{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

vi.mock("../ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <div data-testid="confirm-title">{title}</div>
        <div data-testid="confirm-message">{message}</div>
        <button data-testid="confirm-yes" onClick={onConfirm} type="button">
          {confirmLabel}
        </button>
        <button data-testid="confirm-no" onClick={onCancel} type="button">
          {cancelLabel}
        </button>
      </div>
    ) : null,
}));

// ── Helper: render into a detached container ──
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
    queryAllByText(text: string): boolean {
      return (container.textContent?.match(new RegExp(text, "g")) ?? []).length >= 1;
    },
    cleanup() {
      act(() => {
        root.unmount();
      });
      document.body.removeChild(container);
    },
  };
}

// ── Shared test data ──
const mockBook1 = { id: "book-1", title: "测试书籍一", genre: "fantasy", status: "active", chaptersWritten: 5 };
const mockBook2 = { id: "book-2", title: "测试书籍二", genre: "sci-fi", status: "active", chaptersWritten: 3 };

const mockSession1 = {
  sessionId: "1710000000000-sess-1",
  bookId: "book-1",
  title: "第一个会话",
  messages: [],
  isStreaming: false,
  isDraft: false,
  stream: null,
  lastError: null,
  sessionKind: "chat",
};

const mockSession2 = {
  sessionId: "1710000100000-sess-2",
  bookId: "book-1",
  title: null,
  messages: [{ role: "user" as const, content: "帮我写一个开头" }],
  isStreaming: false,
  isDraft: false,
  stream: null,
  lastError: null,
  sessionKind: "chat",
};

const mockSession3 = {
  sessionId: "1710000200000-sess-3",
  bookId: "book-1",
  title: "已归档会话",
  messages: [],
  isStreaming: false,
  isDraft: false,
  stream: null,
  lastError: null,
  sessionKind: "chat",
};

function setupDefaultMockData() {
  mockApiResponses["/books"] = { books: [mockBook1, mockBook2] };
  mockApiResponses["/interactive-films"] = { films: [] };
  mockApiResponses["/daemon"] = { running: true };

  mockStoreState.sessions = {
    [mockSession1.sessionId]: mockSession1,
    [mockSession2.sessionId]: mockSession2,
    [mockSession3.sessionId]: mockSession3,
  };
  mockStoreState.sessionIdsByBook = {
    "book-1": [mockSession1.sessionId, mockSession2.sessionId, mockSession3.sessionId],
    "book-2": [],
  };
  mockStoreState.activeSessionId = null;
  mockStoreState.bookDataVersion = 0;
  mockStoreState.loadSessionList = vi.fn();
  mockStoreState.loadSessionDetail = vi.fn();
  mockStoreState.activateSession = vi.fn();
  mockStoreState.createDraftSession = vi.fn().mockReturnValue("new-session-id");
  mockStoreState.renameSession = vi.fn();
  mockStoreState.archiveSession = vi.fn();
  mockStoreState.deleteSession = vi.fn();
  mockStoreState.setInput = vi.fn();
}

// ── Mock zustand store ──
vi.mock("../../store/chat", () => ({
  useChatStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mockStoreState),
}));

vi.mock("../InkosLogo", () => ({
  InkosLogo: () => <svg data-testid="inkos-logo" />,
}));

// ── Tests ──
describe("Sidebar — Session Menu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMockData();
  });

  it("1. DropdownMenu contains rename/archive/delete options", async () => {
    mockStoreState.activeSessionId = mockSession1.sessionId;
    const { Sidebar } = await import("../Sidebar");
    const { container, queryByText, cleanup } = renderIntoContainer(
      <Sidebar
        nav={mockNav as unknown as import("../Sidebar").Nav}
        activePage={`book:${mockBook1.id}`}
        sse={{ messages: [] }}
        t={(key: string) => key}
      />,
    );

    // Verify the session label appears
    expect(queryByText("第一个会话")).toBe(true);

    // Find and click the dropdown trigger (MoreHorizontal button)
    // With our mock, the dropdown content is rendered inline, so items are always visible
    expect(queryByText("改名")).toBe(true);
    expect(queryByText("归档")).toBe(true);
    expect(queryByText("删除")).toBe(true);

    cleanup();
  });

  it("2. Click archive triggers archiveSession(session.sessionId)", async () => {
    mockStoreState.activeSessionId = mockSession1.sessionId;
    const { Sidebar } = await import("../Sidebar");
    const { container, cleanup } = renderIntoContainer(
      <Sidebar
        nav={mockNav as unknown as import("../Sidebar").Nav}
        activePage={`book:${mockBook1.id}`}
        sse={{ messages: [] }}
        t={(key: string) => key}
      />,
    );

    // Find the archive button and click it
    const archiveButtons = container.querySelectorAll(
      'button[data-testid="dropdown-item"]',
    );
    // Archive is the second dropdown item
    const archiveBtn = Array.from(archiveButtons).find(
      (btn) => btn.textContent?.includes("归档"),
    );
    expect(archiveBtn).toBeTruthy();
    act(() => {
      (archiveBtn as HTMLButtonElement).click();
    });

    expect(mockStoreState.archiveSession).toHaveBeenCalledWith(mockSession1.sessionId);

    cleanup();
  });

  it("3. Click delete opens ConfirmDialog then calls deleteSession", async () => {
    const { Sidebar } = await import("../Sidebar");
    const { container, cleanup } = renderIntoContainer(
      <Sidebar
        nav={mockNav as unknown as import("../Sidebar").Nav}
        activePage={`book:${mockBook1.id}`}
        sse={{ messages: [] }}
        t={(key: string) => key}
      />,
    );

    // Find and click the delete dropdown item
    const deleteBtn = Array.from(
      container.querySelectorAll('button[data-testid="dropdown-item"]'),
    ).find((btn) => btn.textContent?.includes("删除"));
    expect(deleteBtn).toBeTruthy();
    act(() => {
      (deleteBtn as HTMLButtonElement).click();
    });

    // Verify ConfirmDialog appears
    const confirmDialog = container.querySelector('[data-testid="confirm-dialog"]');
    expect(confirmDialog).toBeTruthy();
    expect(confirmDialog?.textContent).toContain("删除会话");
    expect(confirmDialog?.textContent).toContain("删除");

    // Click confirm
    const confirmYes = container.querySelector(
      '[data-testid="confirm-yes"]',
    );
    expect(confirmYes).toBeTruthy();
    act(() => {
      (confirmYes as HTMLButtonElement).click();
    });

    expect(mockStoreState.deleteSession).toHaveBeenCalledWith(mockSession1.sessionId);

    cleanup();
  });

  it("4. Click rename opens rename Dialog with input, saving calls renameSession", async () => {
    const { Sidebar } = await import("../Sidebar");
    const { container, cleanup } = renderIntoContainer(
      <Sidebar
        nav={mockNav as unknown as import("../Sidebar").Nav}
        activePage={`book:${mockBook1.id}`}
        sse={{ messages: [] }}
        t={(key: string) => key}
      />,
    );

    // Find and click the rename dropdown item
    const renameBtn = Array.from(
      container.querySelectorAll('button[data-testid="dropdown-item"]'),
    ).find((btn) => btn.textContent?.includes("改名"));
    expect(renameBtn).toBeTruthy();
    act(() => {
      (renameBtn as HTMLButtonElement).click();
    });

    // Verify rename dialog opened
    const dialog = container.querySelector('[data-testid="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("重命名会话");

    // Find input and change value
    const input = container.querySelector("#session-rename-input") as HTMLInputElement;
    expect(input).toBeTruthy();
    act(() => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(input, "新标题");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // Find save button and click
    const saveBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("保存"),
    );
    expect(saveBtn).toBeTruthy();
    act(() => {
      (saveBtn as HTMLButtonElement).click();
    });

    expect(mockStoreState.renameSession).toHaveBeenCalledWith(
      mockSession1.sessionId,
      "新标题",
    );

    cleanup();
  });

  it("5. After archive, session removed from list (state update)", async () => {
    // Initially show session1
    mockStoreState.activeSessionId = mockSession1.sessionId;
    const { Sidebar } = await import("../Sidebar");
    const { container, queryByText, cleanup } = renderIntoContainer(
      <Sidebar
        nav={mockNav as unknown as import("../Sidebar").Nav}
        activePage={`book:${mockBook1.id}`}
        sse={{ messages: [] }}
        t={(key: string) => key}
      />,
    );

    // Verify session is present
    expect(queryByText("第一个会话")).toBe(true);

    // Simulate state update: remove session1 from sessionIdsByBook
    // Re-render is simulated by a new render since we can't easily
    // trigger a zustand subscription update from outside the mock
    cleanup();

    mockStoreState.sessionIdsByBook = {
      "book-1": [mockSession2.sessionId, mockSession3.sessionId],
    };

    const { container: container2, queryByText: query2, cleanup: cleanup2 } = renderIntoContainer(
      <Sidebar
        nav={mockNav as unknown as import("../Sidebar").Nav}
        activePage={`book:${mockBook1.id}`}
        sse={{ messages: [] }}
        t={(key: string) => key}
      />,
    );

    // After removal, session1 should not appear
    expect(query2("第一个会话")).toBe(false);
    cleanup2();
  });

  it("6. Session list filters by active status (no archived)", async () => {
    // Only show active (non-archived) sessions
    mockStoreState.sessionIdsByBook = {
      "book-1": [mockSession1.sessionId], // only unarchived
    };
    mockStoreState.activeSessionId = mockSession1.sessionId;

    const { Sidebar } = await import("../Sidebar");
    const { queryByText, cleanup } = renderIntoContainer(
      <Sidebar
        nav={mockNav as unknown as import("../Sidebar").Nav}
        activePage={`book:${mockBook1.id}`}
        sse={{ messages: [] }}
        t={(key: string) => key}
      />,
    );

    // Active session is visible
    expect(queryByText("第一个会话")).toBe(true);
    // Archived session is NOT in sessionIdsByBook, so not rendered
    expect(queryByText("已归档会话")).toBe(false);

    cleanup();
  });
});

describe("Sidebar — Book Expand Area", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMockData();
  });

  it("7. Expanded book shows relation graph entry → toRelations(book.id)", async () => {
    const { Sidebar } = await import("../Sidebar");
    const { container, cleanup } = renderIntoContainer(
      <Sidebar
        nav={mockNav as unknown as import("../Sidebar").Nav}
        activePage={`book:${mockBook1.id}`}
        sse={{ messages: [] }}
        t={(key: string) => key}
      />,
    );

    // Click the expand button for book-1
    const expandBtn = container.querySelector(
      `button[aria-label="展开 ${mockBook1.title}"]`,
    );
    expect(expandBtn).toBeTruthy();
    act(() => {
      (expandBtn as HTMLButtonElement).click();
    });

    // Verify "关系图谱" entry is present and clickable
    expect(container.textContent).toContain("关系图谱");

    const relationBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("关系图谱"),
    );
    expect(relationBtn).toBeTruthy();
    act(() => {
      (relationBtn as HTMLButtonElement).click();
    });

    expect(mockNav.toRelations).toHaveBeenCalledWith(mockBook1.id);

    cleanup();
  });

  it("8. Expanded book shows timeline entry → toTimeline(book.id)", async () => {
    const { Sidebar } = await import("../Sidebar");
    const { container, cleanup } = renderIntoContainer(
      <Sidebar
        nav={mockNav as unknown as import("../Sidebar").Nav}
        activePage={`book:${mockBook1.id}`}
        sse={{ messages: [] }}
        t={(key: string) => key}
      />,
    );

    // Expand book-1
    const expandBtn = container.querySelector(
      `button[aria-label="展开 ${mockBook1.title}"]`,
    );
    expect(expandBtn).toBeTruthy();
    act(() => {
      (expandBtn as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("时间线");

    const timelineBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("时间线"),
    );
    expect(timelineBtn).toBeTruthy();
    act(() => {
      (timelineBtn as HTMLButtonElement).click();
    });

    expect(mockNav.toTimeline).toHaveBeenCalledWith(mockBook1.id);

    cleanup();
  });

  it("9. Expanded book shows book worlds entry → toBookWorlds(book.id)", async () => {
    const { Sidebar } = await import("../Sidebar");
    const { container, cleanup } = renderIntoContainer(
      <Sidebar
        nav={mockNav as unknown as import("../Sidebar").Nav}
        activePage={`book:${mockBook1.id}`}
        sse={{ messages: [] }}
        t={(key: string) => key}
      />,
    );

    const expandBtn = container.querySelector(
      `button[aria-label="展开 ${mockBook1.title}"]`,
    );
    expect(expandBtn).toBeTruthy();
    act(() => {
      (expandBtn as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("本书世界");

    const worldsBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("本书世界"),
    );
    expect(worldsBtn).toBeTruthy();
    act(() => {
      (worldsBtn as HTMLButtonElement).click();
    });

    expect(mockNav.toBookWorlds).toHaveBeenCalledWith(mockBook1.id);

    cleanup();
  });

  it("10. Expanded book shows foreshadowing entry → toForeshadowing(book.id)", async () => {
    const { Sidebar } = await import("../Sidebar");
    const { container, cleanup } = renderIntoContainer(
      <Sidebar
        nav={mockNav as unknown as import("../Sidebar").Nav}
        activePage={`book:${mockBook1.id}`}
        sse={{ messages: [] }}
        t={(key: string) => key}
      />,
    );

    const expandBtn = container.querySelector(
      `button[aria-label="展开 ${mockBook1.title}"]`,
    );
    expect(expandBtn).toBeTruthy();
    act(() => {
      (expandBtn as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("伏笔追踪");

    const foreshadowBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("伏笔追踪"),
    );
    expect(foreshadowBtn).toBeTruthy();
    act(() => {
      (foreshadowBtn as HTMLButtonElement).click();
    });

    expect(mockNav.toForeshadowing).toHaveBeenCalledWith(mockBook1.id);

    cleanup();
  });

  it("11. Click foreshadowing navigates to {page: foreshadowing, bookId}", async () => {
    const { Sidebar } = await import("../Sidebar");
    const { container, cleanup } = renderIntoContainer(
      <Sidebar
        nav={mockNav as unknown as import("../Sidebar").Nav}
        activePage={`book:${mockBook1.id}`}
        sse={{ messages: [] }}
        t={(key: string) => key}
      />,
    );

    const expandBtn = container.querySelector(
      `button[aria-label="展开 ${mockBook1.title}"]`,
    );
    expect(expandBtn).toBeTruthy();
    act(() => {
      (expandBtn as HTMLButtonElement).click();
    });

    const foreshadowBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("伏笔追踪"),
    );
    expect(foreshadowBtn).toBeTruthy();
    act(() => {
      (foreshadowBtn as HTMLButtonElement).click();
    });

    // Verify the correct navigation function was called
    expect(mockNav.toForeshadowing).toHaveBeenCalledWith("book-1");

    cleanup();
  });
});

describe("Sidebar — Tools Area", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMockData();
  });

  it("12. Tools section contains Agent Team / 世界设定 / 会话归档 / Skill 库 entries", async () => {
    const { Sidebar } = await import("../Sidebar");
    const { container, cleanup } = renderIntoContainer(
      <Sidebar
        nav={mockNav as unknown as import("../Sidebar").Nav}
        activePage="chat"
        sse={{ messages: [] }}
        t={(key: string) => key}
      />,
    );

    const text = container.textContent ?? "";

    // Tools section header — the t() mock returns the key itself,
    // so "nav.tools" is the rendered text
    expect(container.textContent).toContain("nav.tools");

    // Verify the four specific entries exist
    expect(text).toContain("Agent Team");
    expect(text).toContain("世界设定");
    expect(text).toContain("会话归档");
    expect(text).toContain("Skill 库");

    cleanup();
  });
});
