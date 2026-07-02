// ── Persona Edit Panel (Per-5) ──
// Main 3-tab panel for editing an Agent's Persona configuration.
// Tabs: Persona (人格编辑) / 模型路由 / Skill 绑定

import { useState, useCallback, useRef } from "react";
import { X, Save, RotateCcw, Loader2, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";
import { cn } from "../lib/utils";
import { PersonaEditTab } from "./PersonaEditTab";
import { ModelRouteTab } from "./ModelRouteTab";
import { SkillBindTab } from "./SkillBindTab";
import { usePersona } from "../hooks/use-persona-api";
import { AGENTS } from "./AgentCard";
import { TestDialog } from "./TestDialog";
import type { PersonaConfig, AgentRole } from "@actalk/inkos-core/models/persona-config.js";

// ── Tab definitions ──

interface TabDef {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

const TABS: ReadonlyArray<TabDef> = [
  { id: "persona", label: "Persona", description: "人格设定" },
  { id: "model", label: "模型路由", description: "LLM 配置" },
  { id: "skill", label: "Skill 绑定", description: "扩展能力" },
];

// ── Save Status ──

type SaveStatus = "idle" | "saving" | "success" | "error";

// ── Props ──

interface PersonaEditPanelProps {
  readonly agentRole: AgentRole;
  readonly onClose: () => void;
}

// ── Component ──

export function PersonaEditPanel({ agentRole, onClose }: PersonaEditPanelProps) {
  const [activeTab, setActiveTab] = useState("persona");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [dirty, setDirty] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testDialogLoading, setTestDialogLoading] = useState(false);

  // Load persona data
  const { config, body, loading, error, setConfig, setBody, save, resetToDefault, refetch } = usePersona(agentRole);

  // Track dirty state
  const handleConfigChange = useCallback((newConfig: PersonaConfig) => {
    setConfig(newConfig);
    setDirty(true);
  }, [setConfig]);

  const handleBodyChange = useCallback((newBody: string) => {
    setBody(newBody);
    setDirty(true);
  }, [setBody]);

  // ── Agent Info ──
  const agent = AGENTS.find((a) => a.role === agentRole);
  const agentLabel = agent?.label ?? agentRole;
  const agentColor = agent?.color ?? "#9CA3AF";
  const agentIcon = agent?.icon ?? "🤖";
  const agentDescription = agent?.description ?? "";

  // ── Save Handler ──
  const handleSave = useCallback(async () => {
    if (!config || saveStatus === "saving") return;
    setSaveStatus("saving");
    try {
      const ok = await save(config, body);
      setSaveStatus(ok ? "success" : "error");
      if (ok) setDirty(false);
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [config, body, save, saveStatus]);

  // ── Reset Handler ──
  const handleReset = useCallback(async () => {
    const ok = await resetToDefault();
    if (ok) {
      setDirty(false);
    }
  }, [resetToDefault]);

  // ── Test Dialog Handler (auto-save then open) ──
  const handleOpenTestDialog = useCallback(async () => {
    if (!config) return;
    // Auto-save if dirty
    if (dirty) {
      setTestDialogLoading(true);
      const ok = await save(config, body);
      setTestDialogLoading(false);
      if (!ok) return; // Save failed — don't open test dialog
      setDirty(false);
    }
    setShowTestDialog(true);
  }, [config, body, dirty, save]);

  // ── Keyboard shortcut: Ctrl+S to save ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      void handleSave();
    }
  }, [handleSave]);

  // ── Loading State ──
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">加载 {agentLabel} 配置…</span>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error && !config) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center">
          <AlertCircle size={24} className="text-destructive" />
          <p className="text-sm text-muted-foreground">加载失败</p>
          <p className="text-xs text-muted-foreground/60">{error}</p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
            >
              重试
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-border/40 text-xs text-muted-foreground"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty State (shouldn't happen) ──
  if (!config) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3">
          <AlertCircle size={24} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">无可用的配置数据</p>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border/40 text-xs text-muted-foreground"
          >
            关闭
          </button>
        </div>
      </div>
    );
  }

  // ── Render ──

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
    >
      {/* Overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Panel */}
      <div
        className={cn(
          "relative w-full max-w-2xl max-h-[85vh] flex flex-col",
          "bg-card border border-border/60 rounded-2xl shadow-2xl",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            {/* Agent icon */}
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-lg shadow-sm"
              style={{ backgroundColor: `${agentColor}15` }}
            >
              <span role="img" aria-label={agentLabel}>{agentIcon}</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">编辑 {agentLabel} Persona</h2>
              <p className="text-[11px] text-muted-foreground/60">{agentDescription}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-border/30 px-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative px-4 py-3 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "text-foreground"
                  : "text-muted-foreground/50 hover:text-muted-foreground",
              )}
            >
              {tab.label}
              <span className="block text-[10px] font-normal text-muted-foreground/40">
                {tab.description}
              </span>
              {activeTab === tab.id && (
                <span
                  className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                  style={{ backgroundColor: agentColor }}
                />
              )}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {activeTab === "persona" && (
            <PersonaEditTab
              config={config}
              onChange={handleConfigChange}
              agentLabel={agentLabel}
            />
          )}
          {activeTab === "model" && (
            <ModelRouteTab
              config={config}
              onChange={handleConfigChange}
            />
          )}
          {activeTab === "skill" && (
            <SkillBindTab
              config={config}
              onChange={handleConfigChange}
            />
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border/30">
          {/* Left actions */}
          <div className="flex items-center gap-2">
            {/* Reset button */}
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-destructive/70 hover:text-destructive hover:bg-destructive/5 transition-colors"
            >
              <RotateCcw size={14} />
              <span>重置为默认</span>
            </button>

            {/* Test dialog button */}
            <button
              type="button"
              onClick={handleOpenTestDialog}
              disabled={testDialogLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-foreground/70 hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50"
            >
              {testDialogLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <MessageSquare size={14} />
              )}
              <span>{testDialogLoading ? "保存中…" : "测试对话"}</span>
            </button>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-2">
            {/* Save status indicator */}
            {saveStatus === "success" && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 size={14} />
                已保存
              </span>
            )}
            {saveStatus === "error" && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle size={14} />
                保存失败
              </span>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === "saving" || !dirty}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                dirty && saveStatus !== "saving"
                  ? "bg-primary text-primary-foreground hover:opacity-90 shadow-sm"
                  : "bg-muted-foreground/10 text-muted-foreground/50 cursor-not-allowed",
                saveStatus === "saving" && "opacity-70",
              )}
            >
              {saveStatus === "saving" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              <span>{saveStatus === "saving" ? "保存中…" : "保存"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Test Dialog */}
      {showTestDialog && (
        <TestDialog
          agentRole={agentRole}
          agentLabel={agentLabel}
          agentIcon={agentIcon}
          agentColor={agentColor}
          onClose={() => {
            setShowTestDialog(false);
            void refetch(); // Refresh config in case test changed something
          }}
        />
      )}
    </div>
  );
}
