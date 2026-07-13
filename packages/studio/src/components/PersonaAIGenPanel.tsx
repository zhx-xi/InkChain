// ── AI Persona Generation Panel (Per-7) ──
// Chat-style input panel for generating persona recommendations.
// Left column: input/description, Right column: recommendation preview.
// Users can expand each agent, see full config, and batch-apply all.

import { useState, useCallback } from "react";
import { X, Send, Loader2, AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Check, Sparkles, User } from "lucide-react";
import { cn } from "../lib/utils";
import { usePersonaAIGen } from "../hooks/use-persona-ai-gen";
import { AGENTS } from "./AgentCard";
import type { PersonaConfig, AgentRole } from "@inkchain/inkchain-core/models/persona-config.js";

// ── Props ──

interface PersonaAIGenPanelProps {
  readonly onClose: () => void;
  readonly onApply: (recommendations: Partial<Record<AgentRole, PersonaConfig>>) => Promise<boolean>;
}

// ── Agent Role Display Config ──

const ROLE_DISPLAY: Record<string, { label: string; color: string }> = {
  writer: { label: "Writer · 写手", color: "#E88D3A" },
  auditor: { label: "Auditor · 审计", color: "#4A90D9" },
  editor: { label: "Editor · 编辑", color: "#5CB85C" },
  architect: { label: "Architect · 架构", color: "#8B5CF6" },
  planner: { label: "Planner · 规划", color: "#9CA3AF" },
  observer: { label: "Observer · 观察", color: "#0EA5E9" },
  reviser: { label: "Reviser · 修订", color: "#EF4444" },
};

// ── Component ──

export function PersonaAIGenPanel({ onClose, onApply }: PersonaAIGenPanelProps) {
  const [description, setDescription] = useState("");
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);

  const { recommendations, loading, error, genErrors, generate, reset } = usePersonaAIGen();

  // ── Generate handler ──
  const handleGenerate = useCallback(() => {
    if (!description.trim()) return;
    setApplied(false);
    void generate(description.trim());
  }, [description, generate]);

  // ── Toggle role expansion ──
  const toggleRole = useCallback((role: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  }, []);

  // ── Apply all handler ──
  const handleApplyAll = useCallback(async () => {
    if (!recommendations || applied) return;
    setApplying(true);
    try {
      const ok = await onApply(recommendations);
      if (ok) setApplied(true);
    } finally {
      setApplying(false);
    }
  }, [recommendations, applied, onApply]);

  // ── Reset handler ──
  const handleReset = useCallback(() => {
    reset();
    setDescription("");
    setExpandedRoles(new Set());
    setApplied(false);
  }, [reset]);

  // ── Key down handler ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  }, [handleGenerate]);

  // ── Agent info helper ──
  const agentForRole = (role: string) => AGENTS.find((a) => a.role === role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-card border border-border/60 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-lg shadow-sm">
              <Sparkles size={18} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">AI 辅助生成 Persona</h2>
              <p className="text-[11px] text-muted-foreground/60">输入描述，AI 推荐 7 Agent 配置</p>
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

        {/* ── Body ── */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Input + Chat area */}
          <div className="w-80 border-r border-border/30 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Demo suggestions */}
              {!recommendations && !loading && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wider">
                    示例描述
                  </p>
                  {[
                    "我想写一个都市悬疑小说，文风偏冷峻",
                    "创作热血玄幻修仙题材，注重战斗场面",
                    "写言情小说，文风细腻温暖，注重情感刻画",
                    "写一部硬核科幻，注重逻辑和世界构建",
                  ].map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setDescription(example)}
                      className="w-full text-left p-2.5 rounded-lg border border-border/20 hover:border-border/50 hover:bg-secondary/30 transition-all text-xs text-muted-foreground/70 hover:text-foreground"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              )}

              {/* Loading state */}
              {loading && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 size={24} className="animate-spin text-purple-500" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">AI 正在生成配置…</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-1">为 7 个 Agent 角色分别推荐 Persona 配置</p>
                  </div>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 text-destructive text-xs">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">生成失败</p>
                    <p className="text-destructive/70 mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Generation errors (partial failures) */}
              {genErrors && genErrors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-amber-600">部分角色配置验证失败：</p>
                  {genErrors.map((ge) => (
                    <p key={ge.role} className="text-[10px] text-amber-600/70">{ge.role}: {ge.message}</p>
                  ))}
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="border-t border-border/30 p-3">
              <div className="flex gap-2">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="描述你的写作风格、题材和偏好…"
                  rows={3}
                  className="flex-1 px-3 py-2 rounded-xl border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-purple-500/50 resize-none"
                  disabled={loading}
                />
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={!description.trim() || loading}
                    className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-xl transition-all shrink-0",
                      description.trim() && !loading
                        ? "bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
                        : "bg-muted-foreground/10 text-muted-foreground/30 cursor-not-allowed",
                    )}
                  >
                    {loading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                  {recommendations && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex items-center justify-center w-9 h-9 rounded-xl border border-border/30 text-muted-foreground/40 hover:text-foreground hover:bg-secondary/30 transition-all text-[10px] shrink-0"
                      title="重置"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/30 mt-1.5">Ctrl+Enter 发送</p>
            </div>
          </div>

          {/* Right: Recommendations */}
          <div className="flex-1 overflow-y-auto p-4">
            {!recommendations && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
                <Sparkles size={40} className="opacity-20 mb-3" />
                <p className="text-sm">在左侧输入描述，点击发送生成推荐配置</p>
                <p className="text-xs mt-1">或点击示例描述快速体验</p>
              </div>
            )}

            {recommendations && !loading && (
              <div className="space-y-4">
                {/* Apply button */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <span className="text-xs text-muted-foreground">
                      {Object.keys(recommendations).length} 个 Agent 配置已生成
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {applied && (
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 size={14} />
                        已应用
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleApplyAll}
                      disabled={applying || applied || Object.keys(recommendations).length === 0}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        !applied && !applying
                          ? "bg-purple-600 text-white hover:bg-purple-700 shadow-sm"
                          : "bg-muted-foreground/10 text-muted-foreground/50 cursor-not-allowed",
                      )}
                    >
                      {applying ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      <span>{applying ? "应用中…" : applied ? "已应用" : "批量应用"}</span>
                    </button>
                  </div>
                </div>

                {/* Agent recommendation list */}
                {Object.entries(recommendations).map(([role, config]) => {
                  const display = ROLE_DISPLAY[role] ?? { label: role, color: "#9CA3AF" };
                  const agent = agentForRole(role);
                  const isExpanded = expandedRoles.has(role);
                  const isEditing = editingRole === role;

                  return (
                    <div
                      key={role}
                      className="rounded-xl border border-border/20 overflow-hidden"
                    >
                      {/* Agent header (collapsed view) */}
                      <button
                        type="button"
                        onClick={() => toggleRole(role)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-sm shadow-sm"
                            style={{ backgroundColor: `${display.color}15` }}
                          >
                            <span role="img" aria-label={agent?.label}>{agent?.icon ?? "🤖"}</span>
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-semibold text-foreground">
                              {config.displayName}
                            </div>
                            <div className="text-[10px] text-muted-foreground/50">
                              {display.label}
                            </div>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-muted-foreground/40" />
                        ) : (
                          <ChevronRight size={16} className="text-muted-foreground/40" />
                        )}
                      </button>

                      {/* Expanded config */}
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-3 border-t border-border/10">
                          {/* Personality traits */}
                          {config.personalityTraits && config.personalityTraits.length > 0 && (
                            <div className="pt-3">
                              <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1.5">性格特征</p>
                              <div className="flex flex-wrap gap-1.5">
                                {config.personalityTraits.map((trait: string, i: number) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded-lg text-[11px] font-medium"
                                    style={{ backgroundColor: `${display.color}12`, color: display.color }}
                                  >
                                    {trait}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Dialogue style */}
                          {config.dialogueStyle && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1">对话风格</p>
                              <div className="grid grid-cols-3 gap-2">
                                {config.dialogueStyle.tone && (
                                  <div className="p-2 rounded-lg bg-secondary/20">
                                    <p className="text-[9px] text-muted-foreground/40">语气</p>
                                    <p className="text-[11px] text-foreground/80">{config.dialogueStyle.tone}</p>
                                  </div>
                                )}
                                {config.dialogueStyle.rhythm && (
                                  <div className="p-2 rounded-lg bg-secondary/20">
                                    <p className="text-[9px] text-muted-foreground/40">节奏</p>
                                    <p className="text-[11px] text-foreground/80">{config.dialogueStyle.rhythm}</p>
                                  </div>
                                )}
                                {config.dialogueStyle.vocabulary && (
                                  <div className="p-2 rounded-lg bg-secondary/20">
                                    <p className="text-[9px] text-muted-foreground/40">词汇</p>
                                    <p className="text-[11px] text-foreground/80">{config.dialogueStyle.vocabulary}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Behavior constraints */}
                          {config.behaviorConstraints && config.behaviorConstraints.length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1">行为规则</p>
                              <div className="space-y-1">
                                {config.behaviorConstraints.map((bc: { rule: string; style: string; priority: number }, i: number) => (
                                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/15">
                                    <span className={cn(
                                      "px-1 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 mt-0.5",
                                      bc.style === "Always" && "bg-emerald-500/10 text-emerald-600",
                                      bc.style === "Never" && "bg-red-500/10 text-red-600",
                                      bc.style === "When" && "bg-yellow-500/10 text-yellow-600",
                                    )}>
                                      {bc.style}
                                    </span>
                                    <span className="text-[11px] text-foreground/70">{bc.rule}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Free text details */}
                          {config.freeTextDetails && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1">角色设定</p>
                              <p className="text-[11px] text-foreground/60 leading-relaxed bg-secondary/10 rounded-lg p-3">
                                {config.freeTextDetails}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
