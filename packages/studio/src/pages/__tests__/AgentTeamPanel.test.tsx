// @vitest-environment jsdom
// ── AgentTeamPanel Unit Tests ──
// Tests that AgentTeamPanel renders gracefully in all states:
//  - Loading state (API in-flight)
//  - Error state (API failure)
//  - Normal state (API success)
// Without crashing or producing blank pages.

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { AgentTeamPanel } from "../AgentTeamPanel";
import { fetchJson } from "../../hooks/use-api";

// ── Mock dependencies ──

vi.mock("../../hooks/use-api", () => ({
  fetchJson: vi.fn(),
}));

vi.mock("../../components/AgentCard", () => ({
  AgentCard: ({ agent }: { agent: { role: string; label: string } }) =>
    React.createElement("div", {
      "data-testid": `agent-card-${agent.role}`,
      "data-role": agent.role,
    }, agent.label),
  AGENTS: [
    { role: "writer", label: "执笔者", description: "test", color: "#E88D3A", icon: "✍️" },
    { role: "auditor", label: "审核者", description: "test", color: "#4A90D9", icon: "🔍" },
    { role: "editor", label: "Editor", description: "test", color: "#5CB85C", icon: "✏️" },
    { role: "architect", label: "架构师", description: "test", color: "#8B5CF6", icon: "🏗️" },
    { role: "planner", label: "规划师", description: "test", color: "#9CA3AF", icon: "📋" },
    { role: "observer", label: "Observer", description: "test", color: "#0EA5E9", icon: "👁️" },
    { role: "reviser", label: "修订者", description: "test", color: "#EF4444", icon: "🔄" },
  ] as Array<{ role: string; label: string; description: string; color: string; icon: string; isCustom?: boolean }>,
}));

vi.mock("../../components/AgentFlowEditor", () => ({
  AgentFlowEditor: () =>
    React.createElement("div", { "data-testid": "agent-flow-editor" }, "Flow Editor"),
}));

vi.mock("../../components/PersonaEditPanel", () => ({
  PersonaEditPanel: ({ agentRole }: { agentRole: string }) =>
    React.createElement("div", { "data-testid": "persona-edit-panel" }, `Editing: ${agentRole}`),
}));

vi.mock("../../hooks/use-hash-route", () => ({
  useHashRoute: () => ({ setRoute: vi.fn() }),
}));

// ── Shared test data ──

const VALID_AGENT_TEAM_RESPONSE = {
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
    collaborationMode: "sequential" as const,
  },
};

const VALID_AGENT_ORDER_RESPONSE = {
  order: ["writer", "auditor", "editor", "architect", "planner", "observer", "reviser"],
};

const VALID_TEMPLATES_RESPONSE = { templates: [] };
const VALID_CUSTOM_AGENTS_RESPONSE = { agents: [] };

const mockNav = { toDashboard: vi.fn() };
const mockFetchJson = vi.mocked(fetchJson);

// ── Setup: default mock returns valid data for ALL calls ──

function setupDefaultMocks() {
  mockFetchJson.mockReset();
  // Return appropriate data based on URL path
  mockFetchJson.mockImplementation((path: string) => {
    if (path.includes("agent-team")) {
      return Promise.resolve(VALID_AGENT_TEAM_RESPONSE);
    }
    if (path.includes("agent-order") || path.includes("/order")) {
      return Promise.resolve(VALID_AGENT_ORDER_RESPONSE);
    }
    if (path.includes("agent-templates") || path.includes("template")) {
      return Promise.resolve(VALID_TEMPLATES_RESPONSE);
    }
    if (path.includes("custom-agents")) {
      return Promise.resolve(VALID_CUSTOM_AGENTS_RESPONSE);
    }
    return Promise.resolve(VALID_AGENT_TEAM_RESPONSE);
  });
}

function setupWithAgentTeamError() {
  mockFetchJson.mockReset();
  // Only agent-team calls fail; all others succeed with valid data
  mockFetchJson.mockImplementation((path: string) => {
    if (path.includes("agent-team")) {
      return Promise.reject(new Error("API connection refused"));
    }
    if (path.includes("agent-order") || path.includes("/order")) {
      return Promise.resolve(VALID_AGENT_ORDER_RESPONSE);
    }
    if (path.includes("agent-templates") || path.includes("template")) {
      return Promise.resolve(VALID_TEMPLATES_RESPONSE);
    }
    if (path.includes("custom-agents")) {
      return Promise.resolve(VALID_CUSTOM_AGENTS_RESPONSE);
    }
    return Promise.resolve(VALID_AGENT_TEAM_RESPONSE);
  });
}

function setupLoadingMocks() {
  mockFetchJson.mockReset();
  // Never resolve any call — component stays in loading state
  mockFetchJson.mockReturnValue(new Promise(() => {}));
}

// ── Tests ──

describe("AgentTeamPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  // ── Loading state ──

  it("renders loading state when API is in-flight", () => {
    setupLoadingMocks();

    render(React.createElement(AgentTeamPanel, { nav: mockNav }));
    expect(screen.getByTestId("ag-state-empty")).toBeDefined();
  });

  // ── Normal state ──

  it("renders content when API succeeds", async () => {
    render(React.createElement(AgentTeamPanel, { nav: mockNav }));

    // Wait for content to appear (loading state should be gone)
    await waitFor(() => {
      expect(screen.getByText("团队配置")).toBeDefined();
    }, { timeout: 5000 });

    // Should have substantial content
    expect(document.body.textContent!.length).toBeGreaterThan(5);
  });

  // ── Error state ──

  it("renders error state with retry button when API fails", async () => {
    setupWithAgentTeamError();

    render(React.createElement(AgentTeamPanel, { nav: mockNav }));

    await waitFor(() => {
      expect(screen.getByText(/加载失败/)).toBeDefined();
    }, { timeout: 5000 });

    expect(screen.getByText("重试")).toBeDefined();
    expect(document.body.textContent!.length).toBeGreaterThan(5);
  });

  // ── Empty config ──

  it("renders content when config has zero agents", async () => {
    // Override default mock: return empty config for agent-team
    mockFetchJson.mockImplementation((path: string) => {
      if (path.includes("agent-team")) {
        return Promise.resolve({
          config: {
            schemaVersion: "1.0",
            agents: [],
            collaborationMode: "sequential" as const,
          },
        });
      }
      if (path.includes("agent-order") || path.includes("/order")) {
        return Promise.resolve({ order: [] });
      }
      if (path.includes("agent-templates") || path.includes("template")) {
        return Promise.resolve({ templates: [] });
      }
      if (path.includes("custom-agents")) {
        return Promise.resolve({ agents: [] });
      }
      return Promise.resolve({ config: { schemaVersion: "1.0", agents: [], collaborationMode: "sequential" as const } });
    });

    render(React.createElement(AgentTeamPanel, { nav: mockNav }));

    // Wait for content to appear (no loading or error state)
    await waitFor(() => {
      expect(screen.getByText("团队配置")).toBeDefined();
    }, { timeout: 5000 });

    expect(screen.queryByTestId("ag-state-error")).toBeNull();
  });

  // ── Network error ──

  it("handles network failure gracefully", async () => {
    setupWithAgentTeamError();

    render(React.createElement(AgentTeamPanel, { nav: mockNav }));

    await waitFor(() => {
      expect(screen.getByText(/加载失败/)).toBeDefined();
    }, { timeout: 5000 });

    expect(document.body.textContent!.length).toBeGreaterThan(5);
  });
});
