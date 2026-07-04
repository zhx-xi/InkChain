// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

// ── Mock hooks used by ProjectSettings ──
vi.mock("../../hooks/use-colors", () => ({
  useColors: vi.fn(),
}));

vi.mock("../../hooks/use-api", () => ({
  useApi: vi.fn(),
  fetchJson: vi.fn(),
  putApi: vi.fn(),
}));

import { useColors } from "../../hooks/use-colors";
import { useApi, fetchJson, putApi } from "../../hooks/use-api";

// ── Helpers ──
function createNav() {
  return { toDashboard: vi.fn(), toServices: vi.fn() };
}

function createT() {
  const fn = (key: string) => key;
  return fn as (key: string) => string;
}

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
    querySelector<E extends Element = Element>(selector: string): E | null {
      return container.querySelector<E>(selector);
    },
    querySelectorAll<E extends Element = Element>(selector: string): NodeListOf<E> {
      return container.querySelectorAll<E>(selector);
    },
    cleanup() {
      act(() => {
        root.unmount();
      });
      document.body.removeChild(container);
    },
  };
}

function findAgentTeamSection(container: HTMLElement): Element | null {
  const sections = container.querySelectorAll("section");
  for (const section of sections) {
    // t() returns the key string, so heading text is "settings.inputGovernance" etc.
    // But for agent-team the section title is the literal string "Agent Team Config"
    // because isZh is false (t("nav.connected") returns "nav.connected" !== "已连接")
    if (section.textContent?.includes("Agent Team Config")) {
      return section;
    }
  }
  return null;
}

// ── Suite ──
const nav = createNav();
const theme = "dark" as const;
const t = createT();

describe("ProjectSettings — Agent Team config", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useColors).mockReturnValue({
      link: "text-blue-500",
      btnPrimary: "bg-blue-600 text-white",
      btnSecondary: "bg-secondary/50 text-foreground",
    });

    // All useApi endpoints return null by default
    vi.mocked(useApi).mockReturnValue({ data: null, refetch: vi.fn() });

    // GET /project/agent-team returns empty config
    vi.mocked(fetchJson).mockResolvedValue({
      config: { agents: [], defaultModel: "", collaborationMode: "sequential" },
    });

    vi.mocked(putApi).mockResolvedValue(undefined);
  });

  // ──────────────────────────────────────
  //  Rendering (4 test cases)
  // ──────────────────────────────────────

  it("renders Agent Team config card with title", async () => {
    const { ProjectSettings } = await import("../ProjectSettings");
    const { queryByText, cleanup } = renderIntoContainer(
      <ProjectSettings nav={nav} theme={theme} t={t} />,
    );

    expect(queryByText("Agent Team Config")).toBe(true);
    cleanup();
  });

  it("renders 7 agent role checkboxes", async () => {
    const { ProjectSettings } = await import("../ProjectSettings");
    const { queryByText, querySelectorAll, cleanup } = renderIntoContainer(
      <ProjectSettings nav={nav} theme={theme} t={t} />,
    );

    const roles = ["writer", "architect", "planner", "editor", "auditor", "observer", "reviser"];
    for (const role of roles) {
      expect(queryByText(role)).toBe(true);
    }

    const checkboxes = querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThanOrEqual(7);
    cleanup();
  });

  it("renders default model input with placeholder", async () => {
    const { ProjectSettings } = await import("../ProjectSettings");
    const { querySelector, cleanup } = renderIntoContainer(
      <ProjectSettings nav={nav} theme={theme} t={t} />,
    );

    const input = querySelector<HTMLInputElement>('input[placeholder*="Model ID"]');
    expect(input).toBeTruthy();
    expect(input?.placeholder).toContain("Model ID");
    cleanup();
  });

  it("renders collaboration mode dropdown with all options", async () => {
    const { ProjectSettings } = await import("../ProjectSettings");
    const { queryByText, querySelector, cleanup } = renderIntoContainer(
      <ProjectSettings nav={nav} theme={theme} t={t} />,
    );

    // The select element with Sequential/Parallel/Hybrid options
    const select = querySelector<HTMLSelectElement>("select");
    expect(select).toBeTruthy();
    expect(queryByText("Sequential")).toBe(true);
    expect(queryByText("Parallel")).toBe(true);
    expect(queryByText("Hybrid")).toBe(true);
    cleanup();
  });

  // ──────────────────────────────────────
  //  Interaction (3 test cases)
  // ──────────────────────────────────────

  it("triggers PUT /project/agent-team with correct payload on save", async () => {
    const { ProjectSettings } = await import("../ProjectSettings");
    const { container, cleanup } = renderIntoContainer(
      <ProjectSettings nav={nav} theme={theme} t={t} />,
    );

    const section = findAgentTeamSection(container);
    expect(section).toBeTruthy();

    // The save button is the last button in the Agent Team section
    const btn = section!.querySelector("button");
    expect(btn).toBeTruthy();

    act(() => {
      btn!.click();
    });

    expect(vi.mocked(putApi)).toHaveBeenCalledWith(
      "/project/agent-team",
      expect.objectContaining({
        schemaVersion: "1",
        agents: expect.arrayContaining([
          expect.objectContaining({ role: expect.any(String), enabled: expect.any(Boolean) }),
        ]),
        collaborationMode: expect.any(String),
      }),
    );
    cleanup();
  });

  it("shows success notice (green) after successful save", async () => {
    const { ProjectSettings } = await import("../ProjectSettings");
    const { container, cleanup } = renderIntoContainer(
      <ProjectSettings nav={nav} theme={theme} t={t} />,
    );

    const section = findAgentTeamSection(container);
    const btn = section!.querySelector("button");

    await act(async () => {
      btn!.click();
    });

    // After the async save completes, the success notice should appear
    expect(container.textContent).toContain("Agent config saved");

    // The success notice uses emerald-500/10 background class
    const noticeDiv = [...container.querySelectorAll("div")].find(
      (d) => d.className.includes("emerald"),
    );
    expect(noticeDiv).toBeTruthy();
    cleanup();
  });

  it("shows error notice (red) after failed save", async () => {
    vi.mocked(putApi).mockRejectedValue(new Error("Network failure"));

    const { ProjectSettings } = await import("../ProjectSettings");
    const { container, cleanup } = renderIntoContainer(
      <ProjectSettings nav={nav} theme={theme} t={t} />,
    );

    const section = findAgentTeamSection(container);
    const btn = section!.querySelector("button");

    await act(async () => {
      btn!.click();
    });

    expect(container.textContent).toContain("Network failure");

    // The error notice uses destructive background class
    const noticeDiv = [...container.querySelectorAll("div")].find(
      (d) => d.className.includes("destructive"),
    );
    expect(noticeDiv).toBeTruthy();
    cleanup();
  });

  // ──────────────────────────────────────
  //  Data Loading (1 test case)
  // ──────────────────────────────────────

  it("loads existing agent-team config on mount via GET", async () => {
    const existingConfig = {
      config: {
        agents: [
          { role: "writer", enabled: true },
          { role: "architect", enabled: false },
          { role: "planner", enabled: true },
          { role: "editor", enabled: false },
          { role: "auditor", enabled: true },
          { role: "observer", enabled: true },
          { role: "reviser", enabled: false },
        ],
        defaultModel: "gpt-4",
        collaborationMode: "parallel",
      },
    };
    vi.mocked(fetchJson).mockResolvedValue(existingConfig);

    const { ProjectSettings } = await import("../ProjectSettings");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    // Use async act to flush the useEffect microtask that calls fetchJson
    await act(async () => {
      root.render(<ProjectSettings nav={nav} theme={theme} t={t} />);
    });

    // Verify the GET was called
    expect(vi.mocked(fetchJson)).toHaveBeenCalledWith("/project/agent-team");

    // Verify default model input is populated (await act flushes async state updates)
    const modelInput = container.querySelector<HTMLInputElement>('input[placeholder*="Model ID"]');
    expect(modelInput).toBeTruthy();
    expect(modelInput!.value).toBe("gpt-4");

    // Verify collaboration mode dropdown reflects loaded value ("parallel")
    const section = findAgentTeamSection(container);
    expect(section).toBeTruthy();
    const selects = section!.querySelectorAll("select");
    const collabSelect = selects[selects.length - 1] as HTMLSelectElement;
    expect(collabSelect.value).toBe("parallel");

    act(() => { root.unmount(); });
    document.body.removeChild(container);
  });
});
