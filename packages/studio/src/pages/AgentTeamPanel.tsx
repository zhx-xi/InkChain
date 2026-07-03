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
} from "lucide-react";
import {
  AgentCard,
  AGENTS,
  type AgentRole,
  type AgentStatus,
  type AgentMetadata,
} from "../components/AgentCard";
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
}

const PRESETS: ReadonlyArray<Preset> = [
  { id: "default",   name: "默认预设",     description: "通用的默认 Agent 配置" },
  { id: "xianxia",   name: "热血玄幻",     description: "适合玄幻/修仙题材创作" },
  { id: "romance",   name: "言情",         description: "适合言情/都市题材创作" },
  { id: "mystery",   name: "悬疑推理",     description: "适合悬疑/推理题材创作" },
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

type TemplateDialogMode = "create" | "edit";

// ── Initial Agent States ──

function initialAgentStatuses(): Record<AgentRole, AgentStatus> {
  return Object.fromEntries(
    AGENTS.map((a) => [a.role, "ready" as AgentStatus]),
  ) as Record<AgentRole, AgentStatus>;
}

function statusFromEnabled(enabled: boolean): AgentStatus {
  return enabled ? "ready" : "disabled";
}

// ── Component ──

export function AgentTeamPanel({ nav }: AgentTeamPanelProps) {
  const { setRoute } = useHashRoute();
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentRole, AgentStatus>>(initialAgentStatuses);
  const [agentConfigs, setAgentConfigs] = useState<Map<string, AgentRoleConfig>>(new Map());
  const [selectedPreset, setSelectedPreset] = useState("default");
  const [isResetting, setIsResetting] = useState(false);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingAgent, setEditingAgent] = useState<AgentRole | null>(null);

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

  // Load real config from backend
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
        setAgentStatuses((prev) => {
          const next = { ...prev };
          for (const agent of config.agents) {
            const role = agent.role as AgentRole;
            if (AGENTS.some((a) => a.role === role)) {
              next[role] = statusFromEnabled(agent.enabled);
            }
          }
          return next;
        });
        setIsLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : String(error));
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Load templates from backend
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
  }, [templateFormName, templateFormDesc, templateDialogMode, editingTemplateId, selectedPreset, agentConfigs, handleTemplateDialogClose]);

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

  const handlePresetChange = useCallback((presetId: string) => {
    setSelectedPreset(presetId);
    setShowPresetDropdown(false);

    // Apply preset: briefly set all to busy, then back to ready
    const busyStatuses = Object.fromEntries(
      AGENTS.map((a) => [a.role, "busy" as AgentStatus]),
    ) as Record<AgentRole, AgentStatus>;
    setAgentStatuses(busyStatuses);

    setTimeout(() => {
      setAgentStatuses(initialAgentStatuses());
    }, 1500);
  }, []);

  const handleReset = useCallback(() => {
    if (isResetting) return;
    setIsResetting(true);

    // Reset: all agents go busy briefly
    const busyStatuses = Object.fromEntries(
      AGENTS.map((a) => [a.role, "busy" as AgentStatus]),
    ) as Record<AgentRole, AgentStatus>;
    setAgentStatuses(busyStatuses);
    setSelectedPreset("default");

    setTimeout(() => {
      setAgentStatuses(initialAgentStatuses());
      setIsResetting(false);
    }, 2000);
  }, [isResetting]);

  const handleAgentClick = useCallback((agentRole: AgentRole) => {
    setEditingAgent(agentRole);
  }, []);

  const handleClosePanel = useCallback(() => {
    setEditingAgent(null);
  }, []);

  const getPresetLabel = (id: string): string => {
    return PRESETS.find((p) => p.id === id)?.name ?? "默认预设";
  };

  // ── Loading State ──

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">加载 Agent Team…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <span className="text-sm text-destructive">加载失败：{loadError}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg px-4 py-2 text-sm font-medium border border-border/60 hover:bg-secondary/50"
        >
          重试
        </button>
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="fade-in space-y-8">
      {/* Back button */}
      <button
        type="button"
        onClick={() => setRoute({ page: "project-settings" })}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={16} />
        <span>返回设置</span>
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agent Team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            7 个协作 Agent 的 Persona 配置面板
          </p>
        </div>

        {/* Preset selector */}
        <div className="flex items-center gap-3">
          {/* Preset dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPresetDropdown((v) => !v)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all",
                "border-border/60 bg-card/50 hover:bg-secondary/50 text-foreground",
              )}
            >
              <RefreshCw size={14} className="text-muted-foreground" />
              <span>{getPresetLabel(selectedPreset)}</span>
              <ChevronDown
                size={14}
                className={cn(
                  "text-muted-foreground transition-transform",
                  showPresetDropdown && "rotate-180",
                )}
              />
            </button>

            {showPresetDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowPresetDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 w-56 rounded-xl border border-border/60 bg-popover shadow-lg overflow-hidden">
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    选择 Persona 预设
                  </div>
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetChange(preset.id)}
                      className={cn(
                        "w-full flex flex-col items-start gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50",
                        selectedPreset === preset.id && "bg-secondary/50",
                      )}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {preset.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground/60">
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
              "border border-destructive/30 text-destructive hover:bg-destructive/5",
              isResetting && "opacity-50 cursor-not-allowed",
            )}
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
            className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card/50 hover:bg-secondary/50 px-3.5 py-2 text-sm font-medium text-foreground transition-all"
          >
            <Save size={14} className="text-muted-foreground" />
            <span>另存为模板</span>
          </button>
        </div>
      </div>

      {/* Agent Grid — clickable cards open Persona edit panel */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {AGENTS.map((agent) => (
          <AgentCard
            key={agent.role}
            agent={agent}
            status={agentStatuses[agent.role]}
            onClick={() => handleAgentClick(agent.role)}
          />
        ))}
      </div>

      {/* Legend / Status Guide */}
      <div className="rounded-xl border border-border/30 bg-card/30 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-3">
          状态图例
        </h3>
        <div className="flex flex-wrap gap-4">
          {(["ready", "busy", "error", "disabled"] as const).map((status) => (
            <div key={status} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  status === "ready" && "bg-emerald-500",
                  status === "busy" && "bg-yellow-500",
                  status === "error" && "bg-red-500",
                  status === "disabled" && "bg-muted-foreground/30",
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

      {/* ── Templates Section ── */}
      <div className="rounded-xl border border-border/30 bg-card/30 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            用户模板
          </h3>
          <button
            type="button"
            onClick={handleSaveAsTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            <Plus size={12} />
            <span>新建</span>
          </button>
        </div>

        {isLoadingTemplates && (
          <div className="flex items-center gap-2 py-3">
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">加载模板…</span>
          </div>
        )}

        {templateLoadError && (
          <div className="flex items-center gap-2 py-3">
            <AlertTriangle size={14} className="text-destructive shrink-0" />
            <span className="text-xs text-destructive">{templateLoadError}</span>
          </div>
        )}

        {!isLoadingTemplates && !templateLoadError && templates.length === 0 && (
          <p className="text-xs text-muted-foreground/60 py-2">
            暂无保存的模板。可先选择预设后点击"另存为模板"。
          </p>
        )}

        {templates.length > 0 && (
          <div className="space-y-2">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="flex items-center justify-between rounded-lg border border-border/20 bg-card/40 px-3 py-2"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {tmpl.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground/60 truncate">
                    {tmpl.description || `基于预设: ${tmpl.preset}`}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditTemplate(tmpl)}
                    className="rounded-lg p-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-secondary/50 transition-colors"
                    title="编辑模板"
                  >
                    <Edit3 size={14} />
                  </button>

                  {deleteConfirmId === tmpl.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tmpl.id)}
                        className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                        title="确认删除"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelDelete}
                        className="rounded-lg p-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-secondary/50 transition-colors"
                        title="取消"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      className="rounded-lg p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/5 transition-colors"
                      title="删除模板"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Template Save/Edit Dialog ── */}
      {showTemplateDialog && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={handleTemplateDialogClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-2xl border border-border/60 bg-popover p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {templateDialogMode === "create" ? "另存为模板" : "编辑模板"}
                </h3>
                <button
                  type="button"
                  onClick={handleTemplateDialogClose}
                  className="rounded-lg p-1.5 text-muted-foreground/50 hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    模板名称
                  </label>
                  <input
                    type="text"
                    value={templateFormName}
                    onChange={(e) => setTemplateFormName(e.target.value)}
                    placeholder="输入模板名称…"
                    className="w-full rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    描述（可选）
                  </label>
                  <textarea
                    value={templateFormDesc}
                    onChange={(e) => setTemplateFormDesc(e.target.value)}
                    placeholder="简短描述此模板…"
                    rows={3}
                    className="w-full rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  />
                </div>

                {templateDialogMode === "create" && (
                  <div className="rounded-lg bg-secondary/30 px-3 py-2">
                    <span className="text-xs text-muted-foreground">
                      当前预设：<strong>{getPresetLabel(selectedPreset)}</strong>
                      （保存后不可修改预设）
                    </span>
                  </div>
                )}

                {templateSaveError && (
                  <div className="flex items-center gap-2 rounded-lg bg-destructive/5 px-3 py-2">
                    <AlertTriangle size={14} className="text-destructive shrink-0" />
                    <span className="text-xs text-destructive">{templateSaveError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleTemplateDialogClose}
                    className="rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleTemplateSubmit}
                    disabled={isSavingTemplate || !templateFormName.trim()}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                      (isSavingTemplate || !templateFormName.trim()) && "opacity-50 cursor-not-allowed",
                    )}
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
          agentRole={editingAgent}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}
