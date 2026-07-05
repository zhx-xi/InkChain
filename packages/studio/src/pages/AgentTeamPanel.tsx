// ── Agent Team Panel (Issue #326) ──
// 预设+用户模板合并列表 + 自定义Agent CRUD + 流程配置管理

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { useHashRoute } from "../hooks/use-hash-route";
import {
  RefreshCw,
  RotateCcw,
  ChevronDown,
  Loader2,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Check,
  AlertTriangle,
  UserPlus,
  Settings,
  GripVertical,
  Undo2,
} from "lucide-react";
import {
  AgentCard,
  AGENTS,
  type AgentRole,
  type AgentStatus,
  type AgentMetadata,
} from "../components/AgentCard";
import { AgentFlowEditor } from "../components/AgentFlowEditor";
import { PersonaEditPanel } from "../components/PersonaEditPanel";
import { cn } from "../lib/utils";
import { fetchJson } from "../hooks/use-api";

// ── Props ──

interface Nav {
  toDashboard: () => void;
}

interface AgentTeamPanelProps {
  readonly nav: Nav;
}

// ── Preset Data ──

interface Preset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly genre?: string;
}

const PRESETS: ReadonlyArray<Preset> = [
  { id: "default",   name: "默认预设",     description: "通用的默认 Agent 配置", genre: "通用" },
  { id: "xianxia",   name: "热血玄幻",     description: "适合玄幻/修仙题材创作，战斗升级驱动", genre: "玄幻" },
  { id: "romance",   name: "言情",         description: "适合言情/都市题材创作，情感细腻", genre: "言情" },
  { id: "mystery",   name: "悬疑推理",     description: "适合悬疑/推理题材创作，逻辑严密", genre: "悬疑" },
];

// ── Config types ──

interface AgentRoleConfig {
  readonly role: string;
  readonly enabled: boolean;
  readonly model?: string;
  readonly systemPromptOverride?: string;
}

interface AgentTeamConfig {
  readonly schemaVersion: string;
  readonly agents: ReadonlyArray<AgentRoleConfig>;
  readonly defaultModel?: string;
  readonly collaborationMode: "sequential" | "parallel" | "hybrid";
}

interface AgentTeamResponse {
  readonly config: AgentTeamConfig;
}

// ── Template Types ──

interface AgentTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly preset: string;
  readonly config: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface TemplateListResponse {
  readonly templates: ReadonlyArray<AgentTemplate>;
}

interface TemplateResponse {
  readonly template: AgentTemplate;
}

// ── Custom Agent Types ──

interface CustomAgent {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly description: string;
  readonly color: string;
  readonly icon: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly modelRouter?: string;
  readonly persona?: string;
  readonly skills?: ReadonlyArray<string>;
}

interface CustomAgentListResponse {
  readonly agents: ReadonlyArray<CustomAgent>;
}

type TemplateDialogMode = "create" | "edit";

// ── Preset flow configs (each preset has independent flow settings) ──

interface PresetFlowConfig {
  readonly agentOrder: ReadonlyArray<string>;
  readonly collaborationMode: "sequential" | "parallel" | "hybrid";
}

const PRESET_FLOW_CONFIGS: Record<string, PresetFlowConfig> = {
  default: {
    agentOrder: ["writer", "auditor", "editor", "architect", "planner", "observer", "reviser"],
    collaborationMode: "sequential",
  },
  xianxia: {
    agentOrder: ["writer", "architect", "planner", "editor", "auditor", "observer", "reviser"],
    collaborationMode: "hybrid",
  },
  romance: {
    agentOrder: ["planner", "writer", "editor", "observer", "auditor", "reviser", "architect"],
    collaborationMode: "sequential",
  },
  mystery: {
    agentOrder: ["architect", "planner", "observer", "writer", "auditor", "editor", "reviser"],
    collaborationMode: "hybrid",
  },
};

function getDefaultFlowConfig(presetId: string): PresetFlowConfig {
  return PRESET_FLOW_CONFIGS[presetId] ?? PRESET_FLOW_CONFIGS.default;
}

// ── Initial Agent States ──

function initialAgentStatuses(allRoles: ReadonlyArray<string>): Record<string, AgentStatus> {
  return Object.fromEntries(
    allRoles.map((r) => [r, "ready" as AgentStatus]),
  );
}

function statusFromEnabled(enabled: boolean): AgentStatus {
  return enabled ? "ready" : "disabled";
}

// ── All built-in agent roles as strings (for dynamic custom support) ──

const BUILTIN_ROLES: ReadonlyArray<string> = AGENTS.map((a) => a.role);

function getAllAgentRoles(customAgents: ReadonlyArray<CustomAgent> | undefined | null): ReadonlyArray<string> {
  return [...BUILTIN_ROLES, ...(customAgents ?? []).map((a) => a.id)];
}

function getAgentMetadata(
  role: string,
  customAgents: ReadonlyArray<CustomAgent>,
): AgentMetadata | CustomAgent | undefined {
  const builtin = AGENTS.find((a) => a.role === role);
  if (builtin) return builtin;
  return customAgents.find((a) => a.id === role);
}

// ── Template item type for unified list ──

type TemplateItem =
  | { kind: "preset"; id: string; name: string; description: string; genre?: string }
  | { kind: "user"; id: string; name: string; description: string; preset: string; updatedAt: string };

// ── Component ──

export function AgentTeamPanel({ nav }: AgentTeamPanelProps) {
  const { setRoute } = useHashRoute();
  const [activeTab, setActiveTab] = useState<string>("team");

  // Agent state
  const [agentStatuses, setAgentStatuses] = useState<Record<string, AgentStatus>>({});
  const [agentConfigs, setAgentConfigs] = useState<Map<string, AgentRoleConfig>>(new Map());
  const [selectedPreset, setSelectedPreset] = useState("default");
  const [isResetting, setIsResetting] = useState(false);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<string | null>(null);

  // Flow state
  const [agentOrder, setAgentOrder] = useState<ReadonlyArray<string>>([]);
  const [collaborationMode, setCollaborationMode] = useState<"sequential" | "parallel" | "hybrid">("sequential");

  // Template state
  const [templates, setTemplates] = useState<ReadonlyArray<AgentTemplate>>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateDialogMode, setTemplateDialogMode] = useState<TemplateDialogMode>("create");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateFormName, setTemplateFormName] = useState("");
  const [templateFormDesc, setTemplateFormDesc] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Custom agent state
  const [customAgents, setCustomAgents] = useState<ReadonlyArray<CustomAgent>>([]);
  const [isLoadingCustomAgents, setIsLoadingCustomAgents] = useState(false);
  const [customAgentLoadError, setCustomAgentLoadError] = useState<string | null>(null);
  const [showCustomAgentDialog, setShowCustomAgentDialog] = useState(false);
  const [editingCustomAgentId, setEditingCustomAgentId] = useState<string | null>(null);
  const [customAgentForm, setCustomAgentForm] = useState({
    name: "",
    role: "",
    description: "",
    color: "#6366F1",
    icon: "🤖",
  });
  const [isSavingCustomAgent, setIsSavingCustomAgent] = useState(false);
  const [customAgentSaveError, setCustomAgentSaveError] = useState<string | null>(null);

  // ── Combined agent role list ──
  const allRoles = getAllAgentRoles(customAgents);

  // ── Load real config from backend ──
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    fetchJson<AgentTeamResponse>("/project/agent-team")
      .then((data) => {
        if (cancelled) return;
        const config = data.config;
        const configMap = new Map<string, AgentRoleConfig>();
        for (const agent of config.agents) {
          configMap.set(agent.role, agent);
        }
        setAgentConfigs(configMap);

        const availableRoles = getAllAgentRoles(customAgents);
        setAgentStatuses((prev) => {
          const next: Record<string, AgentStatus> = {};
          for (const role of availableRoles) {
            const cfg = config.agents.find((a) => a.role === role);
            next[role] = cfg ? statusFromEnabled(cfg.enabled) : "ready";
          }
          return next;
        });

        setCollaborationMode(config.collaborationMode ?? "sequential");
        setIsLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : String(error));
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [customAgents]);

  // ── Load agent order from backend ──
  useEffect(() => {
    let cancelled = false;
    fetchJson<{ order: ReadonlyArray<string> }>("/agent-order")
      .then((data) => {
        if (cancelled) return;
        if (data.order && data.order.length > 0) {
          setAgentOrder(data.order);
        } else {
          // Fall back to preset flow config
          const presetFlow = getDefaultFlowConfig(selectedPreset);
          setAgentOrder(presetFlow.agentOrder);
        }
      })
      .catch(() => {
        // Fall back to default order
        const presetFlow = getDefaultFlowConfig(selectedPreset);
        setAgentOrder(presetFlow.agentOrder);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load templates from backend ──
  useEffect(() => {
    let cancelled = false;
    setIsLoadingTemplates(true);
    setTemplateLoadError(null);

    fetchJson<TemplateListResponse>("/agent-templates")
      .then((data) => {
        if (cancelled) return;
        setTemplates(data.templates);
        setIsLoadingTemplates(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setTemplateLoadError(error instanceof Error ? error.message : String(error));
        setIsLoadingTemplates(false);
      });

    return () => { cancelled = true; };
  }, []);

  // ── Load custom agents from backend ──
  useEffect(() => {
    let cancelled = false;
    setIsLoadingCustomAgents(true);
    setCustomAgentLoadError(null);

    fetchJson<CustomAgentListResponse>("/custom-agents")
      .then((data) => {
        if (cancelled) return;
        setCustomAgents(data?.agents ?? []);
        setIsLoadingCustomAgents(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setCustomAgentLoadError(error instanceof Error ? error.message : String(error));
        setIsLoadingCustomAgents(false);
      });

    return () => { cancelled = true; };
  }, []);

  // ── Template handlers ──

  const handleSaveAsTemplate = useCallback(() => {
    setTemplateDialogMode("create");
    setTemplateFormName("");
    setTemplateFormDesc("");
    setTemplateSaveError(null);
    setShowTemplateDialog(true);
  }, []);

  const handleEditTemplate = useCallback((tmpl: AgentTemplate) => {
    setTemplateDialogMode("edit");
    setEditingTemplateId(tmpl.id);
    setTemplateFormName(tmpl.name);
    setTemplateFormDesc(tmpl.description);
    setTemplateSaveError(null);
    setShowTemplateDialog(true);
  }, []);

  const handleTemplateDialogClose = useCallback(() => {
    setShowTemplateDialog(false);
    setEditingTemplateId(null);
    setTemplateFormName("");
    setTemplateFormDesc("");
    setTemplateSaveError(null);
  }, []);

  const handleTemplateSubmit = useCallback(async () => {
    const name = templateFormName.trim();
    if (!name) {
      setTemplateSaveError("模板名称不能为空");
      return;
    }

    setIsSavingTemplate(true);
    setTemplateSaveError(null);

    try {
      const configPayload = {
        preset: selectedPreset,
        agentsConfig: Object.fromEntries(agentConfigs),
        agentOrder: [...agentOrder],
        collaborationMode,
      };

      if (templateDialogMode === "create") {
        const result = await fetchJson<TemplateResponse>("/agent-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: templateFormDesc.trim(),
            preset: selectedPreset,
            config: configPayload,
          }),
        });
        setTemplates((prev) => [...prev, result.template]);
      } else {
        if (!editingTemplateId) return;
        const result = await fetchJson<TemplateResponse>(`/agent-templates/${editingTemplateId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description: templateFormDesc.trim(),
          }),
        });
        setTemplates((prev) =>
          prev.map((t) => (t.id === editingTemplateId ? result.template : t)),
        );
      }

      setIsSavingTemplate(false);
      handleTemplateDialogClose();
    } catch (error) {
      setTemplateSaveError(error instanceof Error ? error.message : String(error));
      setIsSavingTemplate(false);
    }
  }, [templateFormName, templateFormDesc, templateDialogMode, editingTemplateId, selectedPreset, agentConfigs, agentOrder, collaborationMode, handleTemplateDialogClose]);

  const handleDeleteTemplate = useCallback(async (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      return;
    }

    try {
      await fetchJson(`/agent-templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setDeleteConfirmId(null);
    } catch (error) {
      setTemplateLoadError(error instanceof Error ? error.message : String(error));
    }
  }, [deleteConfirmId]);

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirmId(null);
  }, []);

  // ── Restore preset to default ──
  const handleRestorePreset = useCallback((presetId: string) => {
    setSelectedPreset(presetId);
    const presetFlow = getDefaultFlowConfig(presetId);
    setAgentOrder(presetFlow.agentOrder);
    setCollaborationMode(presetFlow.collaborationMode);

    // Reset all agents to ready
    const defaultStatuses = initialAgentStatuses(allRoles);
    setAgentStatuses({ ...defaultStatuses, ...Object.fromEntries(allRoles.map((r) => [r, "ready"])) });
  }, [allRoles]);

  // ── Apply preset (with brief busy animation) ──
  const handleApplyPreset = useCallback((presetId: string) => {
    setSelectedPreset(presetId);
    setShowPresetDropdown(false);
    handleRestorePreset(presetId);

    // Brief busy animation
    const busyStatuses = Object.fromEntries(
      allRoles.map((r) => [r, "busy" as AgentStatus]),
    );
    setAgentStatuses(busyStatuses as Record<string, AgentStatus>);

    setTimeout(() => {
      setAgentStatuses(initialAgentStatuses(allRoles));
    }, 1500);
  }, [allRoles, handleRestorePreset]);

  // ── Apply a user template ──
  const handleApplyTemplate = useCallback((tmpl: AgentTemplate) => {
    setSelectedPreset(tmpl.preset);
    const config = tmpl.config as Record<string, unknown> | undefined;

    if (config?.agentOrder && Array.isArray(config.agentOrder)) {
      setAgentOrder(config.agentOrder as ReadonlyArray<string>);
    } else {
      const presetFlow = getDefaultFlowConfig(tmpl.preset);
      setAgentOrder(presetFlow.agentOrder);
    }

    if (config?.collaborationMode) {
      setCollaborationMode(config.collaborationMode as "sequential" | "parallel" | "hybrid");
    }

    // Busy animation
    const busyStatuses = Object.fromEntries(
      allRoles.map((r) => [r, "busy" as AgentStatus]),
    );
    setAgentStatuses(busyStatuses as Record<string, AgentStatus>);

    setTimeout(() => {
      setAgentStatuses(initialAgentStatuses(allRoles));
    }, 1500);
  }, [allRoles]);

  const handleReset = useCallback(() => {
    if (isResetting) return;
    setIsResetting(true);

    handleRestorePreset("default");

    // Busy animation
    const busyStatuses = Object.fromEntries(
      allRoles.map((r) => [r, "busy" as AgentStatus]),
    );
    setAgentStatuses(busyStatuses as Record<string, AgentStatus>);

    setTimeout(() => {
      setAgentStatuses(initialAgentStatuses(allRoles));
      setIsResetting(false);
    }, 2000);
  }, [isResetting, allRoles, handleRestorePreset]);

  const handleAgentClick = useCallback((role: string) => {
    setEditingAgent(role);
  }, []);

  const handleClosePanel = useCallback(() => {
    setEditingAgent(null);
  }, []);

  // ── Custom Agent handlers ──

  const handleOpenCustomAgentDialog = useCallback((agent?: CustomAgent) => {
    if (agent) {
      setEditingCustomAgentId(agent.id);
      setCustomAgentForm({
        name: agent.name,
        role: agent.role,
        description: agent.description,
        color: agent.color,
        icon: agent.icon,
      });
    } else {
      setEditingCustomAgentId(null);
      setCustomAgentForm({
        name: "",
        role: "",
        description: "",
        color: "#6366F1",
        icon: "🤖",
      });
    }
    setCustomAgentSaveError(null);
    setShowCustomAgentDialog(true);
  }, []);

  const handleCloseCustomAgentDialog = useCallback(() => {
    setShowCustomAgentDialog(false);
    setEditingCustomAgentId(null);
  }, []);

  const handleSaveCustomAgent = useCallback(async () => {
    const { name, role, description, color, icon } = customAgentForm;
    if (!name.trim()) {
      setCustomAgentSaveError("名称不能为空");
      return;
    }
    if (!role.trim()) {
      setCustomAgentSaveError("角色标识不能为空");
      return;
    }

    setIsSavingCustomAgent(true);
    setCustomAgentSaveError(null);

    try {
      if (editingCustomAgentId) {
        // Update existing
        const result = await fetchJson<{ agent: CustomAgent }>(`/custom-agents/${editingCustomAgentId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            role: role.trim(),
            description: description.trim(),
            color,
            icon,
          }),
        });
        setCustomAgents((prev) =>
          prev.map((a) => (a.id === editingCustomAgentId ? result.agent : a)),
        );
      } else {
        // Create new
        const result = await fetchJson<{ agent: CustomAgent }>("/custom-agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            role: role.trim(),
            description: description.trim(),
            color,
            icon,
          }),
        });
        setCustomAgents((prev) => [...prev, result.agent]);
        // Add to agent order
        setAgentOrder((prev) => [...prev, result.agent.id]);
      }

      setIsSavingCustomAgent(false);
      handleCloseCustomAgentDialog();
    } catch (error) {
      setCustomAgentSaveError(error instanceof Error ? error.message : String(error));
      setIsSavingCustomAgent(false);
    }
  }, [customAgentForm, editingCustomAgentId, handleCloseCustomAgentDialog]);

  const handleDeleteCustomAgent = useCallback(async (id: string) => {
    try {
      await fetchJson(`/custom-agents/${id}`, { method: "DELETE" });
      setCustomAgents((prev) => prev.filter((a) => a.id !== id));
      setAgentOrder((prev) => prev.filter((o) => o !== id));
    } catch (error) {
      setCustomAgentLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const getPresetLabel = (id: string): string => {
    return PRESETS.find((p) => p.id === id)?.name ?? "默认预设";
  };

  const getPresetGenre = (id: string): string => {
    return PRESETS.find((p) => p.id === id)?.genre ?? "";
  };

  // ── Get agent metadata for display ──
  const getAgentInfo = (role: string): { label: string; description: string; color: string; icon: string } => {
    const meta = getAgentMetadata(role, customAgents);
    if (!meta) return { label: role, description: "", color: "#9CA3AF", icon: "🤖" };
    if ("label" in meta) return meta;
    return { label: meta.name, description: meta.description, color: meta.color, icon: meta.icon };
  };

  // ── Build unified template list ──
  const unifiedTemplates: TemplateItem[] = [
    ...PRESETS.map((p) => ({
      kind: "preset" as const,
      id: p.id,
      name: p.name,
      description: p.description,
      genre: p.genre,
    })),
    ...templates.map((t) => ({
      kind: "user" as const,
      id: t.id,
      name: t.name,
      description: t.description || `基于预设: ${getPresetLabel(t.preset)}`,
      preset: t.preset,
      updatedAt: t.updatedAt,
    })),
  ];

  // ── Determine which agents to show in the grid (built-in + custom) ──
  const displayAgents = [
    ...AGENTS.map((a) => ({ ...a, isCustom: false })),
    ...customAgents.map((a) => ({
      role: a.id,
      label: a.name,
      description: a.description,
      color: a.color,
      icon: a.icon,
      isCustom: true,
    })),
  ];

  // ── Loading State ──

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4" style={{ backgroundColor: "#FDF6F0" }}>
        <Loader2 size={24} className="animate-spin" style={{ color: "#8B3A3A" }} />
        <span className="text-sm" style={{ color: "#8a7a6a" }}>加载 Agent Team…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4" style={{ backgroundColor: "#FDF6F0" }}>
        <span className="text-sm" style={{ color: "#dc2626" }}>加载失败：{loadError}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg px-4 py-2 text-sm font-medium border"
          style={{ borderColor: "#E8D8C8", color: "#3a2a1a" }}
        >
          重试
        </button>
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="fade-in pt-12" style={{ backgroundColor: "#FDF6F0", minHeight: "100%" }}>
      {/* Back button */}
      <button
        type="button"
        onClick={() => setRoute({ page: "project-settings" })}
        className="flex items-center gap-1.5 text-sm mb-4 transition-colors"
        style={{ color: "#8a7a6a" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#3a2a1a"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "#8a7a6a"; }}
      >
        <ArrowLeft size={16} />
        <span>返回设置</span>
      </button>

      {/* Tabs */}
      <div className="flex gap-0 border-b mb-6" style={{ borderColor: "#E8D8C8" }}>
        <button
          type="button"
          onClick={() => setActiveTab("team")}
          className="px-5 py-2.5 text-sm font-medium transition-all relative"
          style={{
            color: activeTab === "team" ? "#8B3A3A" : "#8a7a6a",
          }}
        >
          <span className="flex items-center gap-2">
            <Settings size={14} />
            团队配置
          </span>
          {activeTab === "team" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: "#8B3A3A" }} />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("flow")}
          className="px-5 py-2.5 text-sm font-medium transition-all relative"
          style={{
            color: activeTab === "flow" ? "#8B3A3A" : "#8a7a6a",
          }}
        >
          <span className="flex items-center gap-2">
            <RefreshCw size={14} />
            流程编辑
          </span>
          {activeTab === "flow" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ backgroundColor: "#8B3A3A" }} />
          )}
        </button>
      </div>

      {activeTab === "team" && (
        <div className="space-y-8" style={{ color: "#3a2a1a" }}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: "#3a2a1a" }}>
                <span style={{ fontFamily: "Georgia,serif", fontStyle: "italic" }}>Agent Team</span>
              </h1>
              <p className="text-sm mt-1" style={{ color: "#8a7a6a" }}>
                {BUILTIN_ROLES.length + customAgents.length} 个协作 Agent · 一键切换预设 · 支持自定义角色
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Apply template dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPresetDropdown((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all",
                  )}
                  style={{
                    borderColor: "#E8D8C8",
                    backgroundColor: "#FFFBF7",
                    color: "#3a2a1a",
                  }}
                >
                  <RefreshCw size={14} style={{ color: "#8a7a6a" }} />
                  <span>{getPresetLabel(selectedPreset)}</span>
                  <ChevronDown
                    size={14}
                    className={cn(
                      "transition-transform",
                      showPresetDropdown && "rotate-180",
                    )}
                    style={{ color: "#8a7a6a" }}
                  />
                </button>

                {showPresetDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowPresetDropdown(false)}
                    />
                    <div
                      className="absolute right-0 top-full mt-1 z-20 w-64 rounded-xl border shadow-lg overflow-hidden"
                      style={{
                        borderColor: "#E8D8C8",
                        backgroundColor: "#FFFBF7",
                      }}
                    >
                      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#8a7a6a" }}>
                        选择配置
                      </div>
                      {PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyPreset(preset.id)}
                          className="w-full flex flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors"
                          style={{
                            backgroundColor: selectedPreset === preset.id ? "rgba(139,58,58,0.08)" : "transparent",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(139,58,58,0.05)"; }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = selectedPreset === preset.id ? "rgba(139,58,58,0.08)" : "transparent";
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: "#3a2a1a" }}>
                              {preset.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(139,58,58,0.1)", color: "#8B3A3A" }}>
                              预设
                            </span>
                          </div>
                          <span className="text-[11px]" style={{ color: "#8a7a6a" }}>
                            {preset.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Reset button */}
              <button
                type="button"
                onClick={handleReset}
                disabled={isResetting}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
                  "border",
                  isResetting && "opacity-50 cursor-not-allowed",
                )}
                style={{
                  borderColor: "rgba(139,58,58,0.3)",
                  color: "#8B3A3A",
                  backgroundColor: "transparent",
                }}
              >
                <RotateCcw
                  size={14}
                  className={cn(isResetting && "animate-spin")}
                />
                <span>重置为默认</span>
              </button>

              {/* Save as Template button */}
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all"
                style={{
                  border: "1px solid #E8D8C8",
                  backgroundColor: "#FFFBF7",
                  color: "#3a2a1a",
                }}
              >
                <Save size={14} style={{ color: "#8a7a6a" }} />
                <span>另存为模板</span>
              </button>
            </div>
          </div>

          {/* Agent Grid — built-in + custom */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8a7a6a" }}>
                Agent 角色列表
              </h3>
              <button
                type="button"
                onClick={() => handleOpenCustomAgentDialog()}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
                style={{ color: "#8B3A3A" }}
              >
                <UserPlus size={12} />
                <span>添加自定义</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {AGENTS.map((agent) => (
                <AgentCard
                  key={agent.role}
                  agent={agent}
                  status={agentStatuses[agent.role] ?? "ready"}
                  onClick={() => handleAgentClick(agent.role)}
                />
              ))}
              {customAgents.map((agent) => (
                <div key={agent.id} className="relative group">
                  <AgentCard
                    agent={{
                      role: agent.id as AgentRole,
                      label: agent.name,
                      description: agent.description,
                      color: agent.color,
                      icon: agent.icon,
                      isCustom: true,
                    }}
                    status={agentStatuses[agent.id] ?? "ready"}
                    displayName={agent.name}
                    onClick={() => handleAgentClick(agent.id)}
                    className="border-dashed"
                  />
                  {/* Delete custom agent button */}
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomAgent(agent.id)}
                    className="absolute -top-2 -right-2 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: "#8B3A3A", color: "#fff" }}
                    title="删除自定义 Agent"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Collaboration Mode Selector */}
          <div className="rounded-xl p-4" style={{ border: "1px solid #E8D8C8", backgroundColor: "rgba(255,251,247,0.7)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8a7a6a" }}>
              协作模式
            </h3>
            <div className="flex gap-3">
              {(["sequential", "parallel", "hybrid"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setCollaborationMode(mode)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  )}
                  style={{
                    backgroundColor: collaborationMode === mode ? "#8B3A3A" : "#FFFBF7",
                    color: collaborationMode === mode ? "#fff" : "#3a2a1a",
                    border: collaborationMode === mode ? "1px solid #8B3A3A" : "1px solid #E8D8C8",
                  }}
                >
                  {mode === "sequential" && "顺序执行"}
                  {mode === "parallel" && "并行执行"}
                  {mode === "hybrid" && "混合模式"}
                </button>
              ))}
            </div>
          </div>

          {/* Status Legend */}
          <div className="rounded-xl p-4" style={{ border: "1px solid #E8D8C8", backgroundColor: "rgba(255,251,247,0.7)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8a7a6a" }}>
              状态图例
            </h3>
            <div className="flex flex-wrap gap-4">
              {(["ready", "busy", "error", "disabled"] as const).map((status) => (
                <div key={status} className="flex items-center gap-2 text-xs" style={{ color: "#8a7a6a" }}>
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      status === "ready" && "bg-emerald-500",
                      status === "busy" && "bg-amber-500",
                      status === "error" && "bg-red-500",
                      status === "disabled" && "bg-zinc-300",
                    )}
                  />
                  <span>
                    {status === "ready" && "就绪"}
                    {status === "busy" && "忙碌"}
                    {status === "error" && "错误"}
                    {status === "disabled" && "禁用"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Unified Template List ── */}
          <div className="rounded-xl p-4" style={{ border: "1px solid #E8D8C8", backgroundColor: "rgba(255,251,247,0.7)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8a7a6a" }}>
                模板库
                <span className="ml-2 text-[10px] font-normal" style={{ color: "#a08060" }}>
                  ({unifiedTemplates.length} 个模板)
                </span>
              </h3>
              <button
                type="button"
                onClick={handleSaveAsTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
                style={{ color: "#8B3A3A" }}
              >
                <Plus size={12} />
                <span>新建模板</span>
              </button>
            </div>

            {isLoadingTemplates && (
              <div className="flex items-center gap-2 py-3">
                <Loader2 size={14} className="animate-spin" style={{ color: "#8a7a6a" }} />
                <span className="text-xs" style={{ color: "#8a7a6a" }}>加载模板…</span>
              </div>
            )}

            {templateLoadError && (
              <div className="flex items-center gap-2 py-3">
                <AlertTriangle size={14} className="shrink-0" style={{ color: "#dc2626" }} />
                <span className="text-xs" style={{ color: "#dc2626" }}>{templateLoadError}</span>
              </div>
            )}

            <div className="space-y-2">
              {unifiedTemplates.map((item) => {
                if (item.kind === "preset") {
                  const isActive = selectedPreset === item.id;
                  return (
                    <div
                      key={`preset-${item.id}`}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2.5 transition-all",
                      )}
                      style={{
                        border: isActive ? "1px solid #8B3A3A" : "1px solid transparent",
                        backgroundColor: isActive ? "rgba(139,58,58,0.06)" : "#FFFBF7",
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex items-center gap-2"
                          style={{ color: item.genre ? "#8B3A3A" : "#8a7a6a" }}
                        >
                          <GripVertical size={14} />
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate" style={{ color: "#3a2a1a" }}>
                              {item.name}
                            </span>
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                              style={{
                                backgroundColor: "rgba(139,58,58,0.1)",
                                color: "#8B3A3A",
                              }}
                            >
                              预设
                            </span>
                            {isActive && (
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                                style={{
                                  backgroundColor: "rgba(34,197,94,0.1)",
                                  color: "#16a34a",
                                }}
                              >
                                使用中
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] truncate" style={{ color: "#8a7a6a" }}>
                            {item.description}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isActive && (
                          <button
                            type="button"
                            onClick={() => handleApplyPreset(item.id)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
                            style={{
                              color: "#fff",
                              backgroundColor: "#8B3A3A",
                            }}
                          >
                            应用
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRestorePreset(item.id)}
                          className="rounded-lg p-1.5 transition-colors"
                          style={{ color: "#8a7a6a" }}
                          title="一键还原预设"
                        >
                          <Undo2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                }

                // User template
                return (
                  <div
                    key={`user-${item.id}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5"
                    style={{ border: "1px solid #E8D8C8", backgroundColor: "#FFFBF7" }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div style={{ color: "#D4A855" }}>
                        <Save size={14} />
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-sm font-medium truncate" style={{ color: "#3a2a1a" }}>
                          {item.name}
                        </span>
                        <span className="text-[11px] truncate" style={{ color: "#8a7a6a" }}>
                          {item.description}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const tmpl = templates.find((t) => t.id === item.id);
                          if (tmpl) handleApplyTemplate(tmpl);
                        }}
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
                        style={{
                          color: "#fff",
                          backgroundColor: "#8B3A3A",
                        }}
                      >
                        应用
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const tmpl = templates.find((t) => t.id === item.id);
                          if (tmpl) handleEditTemplate(tmpl);
                        }}
                        className="rounded-lg p-1.5 transition-colors"
                        style={{ color: "#8a7a6a" }}
                        title="编辑模板"
                      >
                        <Edit3 size={14} />
                      </button>

                      {deleteConfirmId === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(item.id)}
                            className="rounded-lg p-1.5 transition-colors"
                            style={{ color: "#dc2626" }}
                            title="确认删除"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelDelete}
                            className="rounded-lg p-1.5 transition-colors"
                            style={{ color: "#8a7a6a" }}
                            title="取消"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(item.id)}
                          className="rounded-lg p-1.5 transition-colors"
                          style={{ color: "#8a7a6a" }}
                          title="删除模板"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Custom Agent Dialog ── */}
          {showCustomAgentDialog && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                onClick={handleCloseCustomAgentDialog}
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                  className="w-full max-w-md rounded-2xl p-6 shadow-xl"
                  style={{
                    border: "1px solid #E8D8C8",
                    backgroundColor: "#FFFBF7",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold" style={{ color: "#3a2a1a" }}>
                      {editingCustomAgentId ? "编辑自定义 Agent" : "添加自定义 Agent"}
                    </h3>
                    <button
                      type="button"
                      onClick={handleCloseCustomAgentDialog}
                      className="rounded-lg p-1.5 transition-colors"
                      style={{ color: "#8a7a6a" }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "#8a7a6a" }}>
                          名称 *
                        </label>
                        <input
                          type="text"
                          value={customAgentForm.name}
                          onChange={(e) => setCustomAgentForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="例如: 文风分析师"
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                          style={{
                            border: "1px solid #E8D8C8",
                            backgroundColor: "#FDF6F0",
                            color: "#3a2a1a",
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "#8a7a6a" }}>
                          角色标识 *
                        </label>
                        <input
                          type="text"
                          value={customAgentForm.role}
                          onChange={(e) => setCustomAgentForm((f) => ({ ...f, role: e.target.value }))}
                          placeholder="例如: style-analyst"
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                          style={{
                            border: "1px solid #E8D8C8",
                            backgroundColor: "#FDF6F0",
                            color: "#3a2a1a",
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "#8a7a6a" }}>
                        描述
                      </label>
                      <textarea
                        value={customAgentForm.description}
                        onChange={(e) => setCustomAgentForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="简短描述此 Agent 的功能…"
                        rows={2}
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 resize-none"
                        style={{
                          border: "1px solid #E8D8C8",
                          backgroundColor: "#FDF6F0",
                          color: "#3a2a1a",
                        }}
                      />
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "#8a7a6a" }}>
                          图标 (Emoji)
                        </label>
                        <input
                          type="text"
                          value={customAgentForm.icon}
                          onChange={(e) => setCustomAgentForm((f) => ({ ...f, icon: e.target.value }))}
                          placeholder="🤖"
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                          style={{
                            border: "1px solid #E8D8C8",
                            backgroundColor: "#FDF6F0",
                            color: "#3a2a1a",
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium mb-1.5" style={{ color: "#8a7a6a" }}>
                          颜色
                        </label>
                        <div className="flex gap-2 flex-wrap">
                          {["#6366F1", "#E88D3A", "#4A90D9", "#5CB85C", "#8B5CF6", "#0EA5E9", "#EF4444", "#F59E0B", "#10B981", "#EC4899", "#14B8A6", "#9CA3AF"].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setCustomAgentForm((f) => ({ ...f, color: c }))}
                              className="h-7 w-7 rounded-full border-2 transition-transform"
                              style={{
                                backgroundColor: c,
                                borderColor: customAgentForm.color === c ? "#3a2a1a" : "transparent",
                                transform: customAgentForm.color === c ? "scale(1.2)" : "scale(1)",
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {customAgentSaveError && (
                      <div
                        className="flex items-center gap-2 rounded-lg px-3 py-2"
                        style={{ backgroundColor: "rgba(239,68,68,0.05)" }}
                      >
                        <AlertTriangle size={14} className="shrink-0" style={{ color: "#dc2626" }} />
                        <span className="text-xs" style={{ color: "#dc2626" }}>{customAgentSaveError}</span>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleCloseCustomAgentDialog}
                        className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                        style={{
                          border: "1px solid #E8D8C8",
                          color: "#3a2a1a",
                          backgroundColor: "#FFFBF7",
                        }}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCustomAgent}
                        disabled={isSavingCustomAgent || !customAgentForm.name.trim() || !customAgentForm.role.trim()}
                        className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: "#8B3A3A",
                          color: "#fff",
                          opacity: (isSavingCustomAgent || !customAgentForm.name.trim() || !customAgentForm.role.trim()) ? 0.5 : 1,
                        }}
                      >
                        {isSavingCustomAgent ? (
                          <span className="flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            保存中…
                          </span>
                        ) : (
                          editingCustomAgentId ? "更新" : "添加"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Template Save/Edit Dialog ── */}
          {showTemplateDialog && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                onClick={handleTemplateDialogClose}
              />
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div
                  className="w-full max-w-md rounded-2xl p-6 shadow-xl"
                  style={{
                    border: "1px solid #E8D8C8",
                    backgroundColor: "#FFFBF7",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold" style={{ color: "#3a2a1a" }}>
                      {templateDialogMode === "create" ? "另存为模板" : "编辑模板"}
                    </h3>
                    <button
                      type="button"
                      onClick={handleTemplateDialogClose}
                      className="rounded-lg p-1.5 transition-colors"
                      style={{ color: "#8a7a6a" }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "#8a7a6a" }}>
                        模板名称
                      </label>
                      <input
                        type="text"
                        value={templateFormName}
                        onChange={(e) => setTemplateFormName(e.target.value)}
                        placeholder="输入模板名称…"
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
                        style={{
                          border: "1px solid #E8D8C8",
                          backgroundColor: "#FDF6F0",
                          color: "#3a2a1a",
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: "#8a7a6a" }}>
                        描述（可选）
                      </label>
                      <textarea
                        value={templateFormDesc}
                        onChange={(e) => setTemplateFormDesc(e.target.value)}
                        placeholder="简短描述此模板…"
                        rows={3}
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 resize-none"
                        style={{
                          border: "1px solid #E8D8C8",
                          backgroundColor: "#FDF6F0",
                          color: "#3a2a1a",
                        }}
                      />
                    </div>

                    {templateDialogMode === "create" && (
                      <div
                        className="rounded-lg px-3 py-2"
                        style={{ backgroundColor: "rgba(139,58,58,0.06)" }}
                      >
                        <span className="text-xs" style={{ color: "#8a7a6a" }}>
                          当前预设：<strong style={{ color: "#3a2a1a" }}>{getPresetLabel(selectedPreset)}</strong>
                          <span className="ml-1">（保存后不可修改预设）</span>
                        </span>
                      </div>
                    )}

                    {templateSaveError && (
                      <div
                        className="flex items-center gap-2 rounded-lg px-3 py-2"
                        style={{ backgroundColor: "rgba(239,68,68,0.05)" }}
                      >
                        <AlertTriangle size={14} className="shrink-0" style={{ color: "#dc2626" }} />
                        <span className="text-xs" style={{ color: "#dc2626" }}>{templateSaveError}</span>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleTemplateDialogClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                        style={{
                          border: "1px solid #E8D8C8",
                          color: "#3a2a1a",
                          backgroundColor: "#FFFBF7",
                        }}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleTemplateSubmit}
                        disabled={isSavingTemplate || !templateFormName.trim()}
                        className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: "#8B3A3A",
                          color: "#fff",
                          opacity: (isSavingTemplate || !templateFormName.trim()) ? 0.5 : 1,
                        }}
                      >
                        {isSavingTemplate ? (
                          <span className="flex items-center gap-2">
                            <Loader2 size={14} className="animate-spin" />
                            保存中…
                          </span>
                        ) : (
                          templateDialogMode === "create" ? "保存" : "更新"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Persona Edit Panel (modal) */}
          {editingAgent && (
            <PersonaEditPanel
              agentRole={editingAgent as AgentRole}
              onClose={handleClosePanel}
            />
          )}
        </div>
      )}

      {activeTab === "flow" && (
        <div className="space-y-6">
          {/* Flow editor header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold" style={{ color: "#3a2a1a" }}>
                <span style={{ fontFamily: "Georgia,serif", fontStyle: "italic" }}>流程编辑</span>
              </h2>
              <p className="text-sm mt-1" style={{ color: "#8a7a6a" }}>
                当前预设：{getPresetLabel(selectedPreset)} · 协作模式：{collaborationMode === "sequential" ? "顺序" : collaborationMode === "parallel" ? "并行" : "混合"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={collaborationMode}
                onChange={(e) => setCollaborationMode(e.target.value as "sequential" | "parallel" | "hybrid")}
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  border: "1px solid #E8D8C8",
                  backgroundColor: "#FFFBF7",
                  color: "#3a2a1a",
                }}
              >
                <option value="sequential">顺序执行</option>
                <option value="parallel">并行执行</option>
                <option value="hybrid">混合模式</option>
              </select>
            </div>
          </div>

          {/* Built-in flow config selector */}
          <div className="flex gap-2 flex-wrap">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset.id)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
                style={{
                  backgroundColor: selectedPreset === preset.id ? "#8B3A3A" : "#FFFBF7",
                  color: selectedPreset === preset.id ? "#fff" : "#3a2a1a",
                  border: selectedPreset === preset.id ? "1px solid #8B3A3A" : "1px solid #E8D8C8",
                }}
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* ReactFlow Agent Flow Editor */}
          {agentOrder.length > 0 ? (
            <AgentFlowEditor
              builtinAgents={AGENTS}
              customAgents={customAgents.map((a) => ({
                id: a.id,
                name: a.name,
                role: a.role,
                description: a.description,
                color: a.color,
                icon: a.icon,
              }))}
              agentOrder={agentOrder}
              collaborationMode={collaborationMode}
              onOrderChange={(newOrder) => setAgentOrder(newOrder)}
            />
          ) : (
            <div
              className="flex items-center justify-center rounded-xl"
              style={{ height: 420, border: "1px solid #E8D8C8", backgroundColor: "rgba(255,251,247,0.7)" }}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#8B3A3A] border-t-transparent" />
                <span className="text-sm" style={{ color: "#8a7a6a" }}>加载流程编辑器中…</span>
              </div>
            </div>
          )}

          {/* Agent order list */}
          <div className="rounded-xl p-4" style={{ border: "1px solid #E8D8C8", backgroundColor: "rgba(255,251,247,0.7)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8a7a6a" }}>
              Agent 执行顺序
            </h3>
            <div className="flex flex-wrap gap-2">
              {agentOrder.map((role, idx) => {
                const info = getAgentInfo(role);
                return (
                  <div
                    key={role}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                    style={{
                      backgroundColor: "#FFFBF7",
                      border: "1px solid #E8D8C8",
                    }}
                  >
                    <span className="text-[10px] font-mono font-bold" style={{ color: "#a08060" }}>
                      #{idx + 1}
                    </span>
                    <span>{info.icon}</span>
                    <span style={{ color: "#3a2a1a" }}>{info.label}</span>
                    {role.startsWith("agent_") && (
                      <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: `${info.color}18`, color: info.color }}>
                        自定义
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
