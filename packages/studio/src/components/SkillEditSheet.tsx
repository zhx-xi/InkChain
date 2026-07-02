import { useEffect, useMemo, useState, useCallback } from "react";
import { X, Save, Loader2, Plus, Trash2, Search, Bot } from "lucide-react";
import { cn } from "../lib/utils";
import { fetchJson } from "../hooks/use-api";
import type { SkillConfig, SkillCategory, TriggerConfig, InjectionConfig } from "@actalk/inkos-core/models/skill-config.js";
import type { AgentRole } from "@actalk/inkos-core/models/persona-config.js";
import { SKILL_CATEGORY_LABELS } from "@actalk/inkos-core/models/skill-config.js";
import { AGENT_ROLE_LABELS, AgentRoleEnum } from "@actalk/inkos-core/models/persona-config.js";
import { AGENTS } from "./AgentCard";

interface ApiSkillResponse {
  readonly config: SkillConfig;
  readonly source: "project" | "builtin";
  readonly path?: string;
}

interface SkillEditSheetProps {
  readonly skillId: string | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSaved?: () => void;
  readonly createDraft?: Partial<SkillConfig>;
}

const INJECTION_TARGET_LABELS: Record<InjectionConfig["target"], string> = {
  system_prompt: "System Prompt",
  user_prompt: "User Prompt",
  context: "Context",
};

const TRIGGER_TYPE_LABELS: Record<TriggerConfig["type"], string> = {
  manual: "Manual",
  condition: "Condition",
};

function makeEmptySkill(id: string): SkillConfig {
  return {
    id,
    category: "utility",
    triggers: [],
    injection: { mode: "append", target: "system_prompt", priority: 50 },
    params: {},
    enabled: true,
    description: "",
    prompt: "",
    agents: [],
  };
}

export function SkillEditSheet({ skillId, isOpen, onClose, onSaved, createDraft }: SkillEditSheetProps) {
  const [original, setOriginal] = useState<SkillConfig | null>(null);
  const [draft, setDraft] = useState<SkillConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentQuery, setAgentQuery] = useState("");

  const isCreateMode = skillId === "__create__";

  useEffect(() => {
    if (!isOpen || !skillId) {
      setOriginal(null);
      setDraft(null);
      setError(null);
      setAgentQuery("");
      return;
    }

    // Create mode: initialize draft from createDraft
    if (isCreateMode) {
      const newSkill: SkillConfig = {
        id: createDraft?.id || `skill-${Date.now()}`,
        category: (createDraft?.category as SkillCategory) || "utility",
        triggers: createDraft?.triggers ?? [],
        injection: createDraft?.injection ?? { mode: "append", target: "system_prompt", priority: 50 },
        params: createDraft?.params ?? {},
        enabled: true,
        description: createDraft?.description || "",
        prompt: createDraft?.prompt || "",
        agents: [],
      };
      setOriginal(newSkill);
      setDraft(newSkill);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchJson<{ skill: ApiSkillResponse }>(`/api/skills/${encodeURIComponent(skillId)}`)
      .then((data) => {
        if (cancelled) return;
        setOriginal(data.skill.config);
        setDraft(data.skill.config);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, skillId, createDraft, isCreateMode]);

  const hasChanges = useMemo(() => {
    if (!original || !draft) return false;
    return JSON.stringify(original) !== JSON.stringify(draft);
  }, [original, draft]);

  const handleClose = useCallback(() => {
    if (hasChanges && !window.confirm("有未保存的更改，确定要关闭吗？")) {
      return;
    }
    onClose();
  }, [hasChanges, onClose]);

  const handleSave = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      if (isCreateMode) {
        // POST for create
        await fetchJson<{ skill: ApiSkillResponse }>("/api/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
      } else {
        // PUT for update
        if (!skillId) return;
        const update = {
          category: draft.category,
          triggers: draft.triggers,
          injection: draft.injection,
          params: draft.params,
          enabled: draft.enabled,
          description: draft.description,
          prompt: draft.prompt,
          agents: draft.agents,
        };
        await fetchJson<{ skill: ApiSkillResponse }>(`/api/skills/${encodeURIComponent(skillId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(update),
        });
      }
      setOriginal(draft);
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [draft, skillId, onSaved, onClose, isCreateMode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-background/35 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="关闭 Skill 编辑面板"
        className="absolute inset-0 cursor-default"
        onClick={handleClose}
      />
      <aside className="relative flex h-full w-[min(680px,calc(100vw-24px))] flex-col border-l border-border/55 bg-background shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-border/45 px-6 py-5">
          <div className="min-w-0">
            <div className="text-[13px] font-medium uppercase tracking-[0.18em] text-muted-foreground/65">
              Skill 编辑
            </div>
            <h2 className="mt-1 truncate text-[22px] font-semibold text-foreground">
              {draft?.id ?? skillId ?? "—"}
            </h2>
            {draft && (
              <span className="mt-1 inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                {SKILL_CATEGORY_LABELS[draft.category]}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !draft || !hasChanges}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-[14px] font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              保存
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-border/50 p-2 text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground"
              aria-label="关闭"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {error && (
          <div className="mx-6 mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[14px] leading-6 text-destructive">
            <span>{error}</span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-8">
          {loading || !draft ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Loader2 size={22} className="mr-2 animate-spin" />
              正在加载 Skill…
            </div>
          ) : (
            <>
              {/* Description */}
              <section className="space-y-2">
                <label className="text-[13px] font-medium text-foreground">描述</label>
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Skill 用途描述"
                  className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
                />
              </section>

              {/* Triggers */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[13px] font-medium text-foreground">触发条件</label>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, triggers: [...draft.triggers, { type: "manual" }] })
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-border/50 px-2 py-1 text-[12px] text-muted-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <Plus size={12} />
                    添加
                  </button>
                </div>
                <div className="space-y-2">
                  {draft.triggers.map((trigger, idx) => (
                    <div key={idx} className="flex items-start gap-2 rounded-lg border border-border/40 bg-card p-3">
                      <select
                        value={trigger.type}
                        onChange={(e) => {
                          const next = [...draft.triggers];
                          next[idx] = {
                            type: e.target.value as TriggerConfig["type"],
                            ...(e.target.value === "condition" ? { condition: "" } : {}),
                          } as TriggerConfig;
                          setDraft({ ...draft, triggers: next });
                        }}
                        className="rounded-md border border-border/40 bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/50"
                      >
                        {Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      {trigger.type === "condition" && (
                        <input
                          type="text"
                          value={trigger.condition ?? ""}
                          onChange={(e) => {
                            const next = [...draft.triggers];
                            next[idx] = { ...trigger, condition: e.target.value };
                            setDraft({ ...draft, triggers: next });
                          }}
                          placeholder="例如 session.kind === 'book'"
                          className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/50"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const next = draft.triggers.filter((_, i) => i !== idx);
                          setDraft({ ...draft, triggers: next });
                        }}
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label="删除触发器"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {draft.triggers.length === 0 && (
                    <p className="text-xs text-muted-foreground/60">暂无触发条件</p>
                  )}
                </div>
              </section>

              {/* Injection */}
              <section className="space-y-3">
                <label className="text-[13px] font-medium text-foreground">注入配置</label>
                <div className="grid grid-cols-2 gap-4 rounded-lg border border-border/40 bg-card p-4">
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">模式</span>
                    <select
                      value={draft.injection.mode}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          injection: { ...draft.injection, mode: e.target.value as InjectionConfig["mode"] },
                        })
                      }
                      className="w-full rounded-md border border-border/40 bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/50"
                    >
                      <option value="append">Append</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-muted-foreground">目标</span>
                    <select
                      value={draft.injection.target}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          injection: { ...draft.injection, target: e.target.value as InjectionConfig["target"] },
                        })
                      }
                      className="w-full rounded-md border border-border/40 bg-background px-2 py-1.5 text-sm outline-none focus:border-primary/50"
                    >
                      {Object.entries(INJECTION_TARGET_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>优先级</span>
                      <span>{draft.injection.priority}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={100}
                      value={draft.injection.priority}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          injection: { ...draft.injection, priority: Number(e.target.value) },
                        })
                      }
                      className="w-full accent-primary"
                    />
                  </div>
                </div>
              </section>

              {/* Agent binding */}
              <section className="space-y-3">
                <label className="text-[13px] font-medium text-foreground">绑定 Agent</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
                  <input
                    type="text"
                    value={agentQuery}
                    onChange={(e) => setAgentQuery(e.target.value)}
                    placeholder="搜索 Agent…"
                    className="w-full rounded-lg border border-border/40 bg-background pl-9 pr-3 py-2 text-sm outline-none focus:border-primary/50 transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {AGENTS.filter((agent) => {
                    const q = agentQuery.toLowerCase();
                    return agent.label.toLowerCase().includes(q) || agent.description.toLowerCase().includes(q);
                  }).map((agent) => {
                    const checked = draft.agents.includes(agent.role);
                    return (
                      <label
                        key={agent.role}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border border-border/40 p-2.5 cursor-pointer transition-colors",
                          checked ? "bg-primary/5 border-primary/30" : "bg-card hover:bg-secondary/30"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...draft.agents, agent.role]
                              : draft.agents.filter((r) => r !== agent.role);
                            setDraft({ ...draft, agents: next });
                          }}
                          className="rounded border-border/40 text-primary focus:ring-primary"
                        />
                        <Bot size={14} style={{ color: agent.color }} />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-foreground truncate">
                            {AGENT_ROLE_LABELS[agent.role]}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">{agent.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </section>

              {/* Prompt */}
              <section className="space-y-2">
                <label className="text-[13px] font-medium text-foreground">Prompt</label>
                <textarea
                  value={draft.prompt}
                  onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                  placeholder="输入 Skill 注入时使用的 Prompt…"
                  rows={10}
                  spellCheck={false}
                  className="w-full resize-none rounded-xl border border-border/55 bg-secondary/20 px-4 py-4 font-mono text-[14px] leading-6 text-foreground outline-none transition focus:border-primary/50 focus:bg-background"
                />
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
