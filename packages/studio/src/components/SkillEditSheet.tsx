import { useEffect, useMemo, useState, useCallback } from "react";
import { X, Save, Loader2, Plus, Trash2, Search, Bot, History, RotateCcw, ChevronDown, ChevronRight, Copy, Sparkles, FileText, Puzzle, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { fetchJson } from "../hooks/use-api";
import type { SkillConfig, SkillCategory, TriggerConfig, InjectionConfig } from "@actalk/inkos-core/models/skill-config.js";
import type { AgentRole } from "@actalk/inkos-core/models/persona-config.js";
import { SKILL_CATEGORY_LABELS } from "@actalk/inkos-core/models/skill-config.js";
import { AGENT_ROLE_LABELS, AgentRoleEnum } from "@actalk/inkos-core/models/persona-config.js";
import { AGENTS } from "./AgentCard";
import { TriggerBuilder } from "./TriggerBuilder";

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
  readonly skillSource?: "project" | "builtin" | null;
}

const INJECTION_TARGET_LABELS: Record<InjectionConfig["target"], string> = {
  system_prompt: "System Prompt",
  user_prompt: "User Prompt",
  context: "Context",
};

const ZH_CATEGORY_LABELS: Record<SkillCategory, string> = {
  writing: "写作",
  analysis: "分析",
  world: "世界",
  character: "角色",
  utility: "实用",
};

const DEFAULT_PROMPT_TEMPLATE = `你是一个专业的写作助手，请根据用户的需求提供帮助。

## 职责
- 分析用户输入并给出专业建议
- 按照设定的风格和规则进行输出
- 保持上下文一致性

## 注意事项
- 不要输出与上下文无关的内容
- 遵循设定的角色和世界规则
- 保持输出格式的一致性`;

// ── Built-in skill templates ──

const BUILTIN_TEMPLATES: Array<{ id: string; label: string; description: string; category: SkillCategory; prompt: string }> = [
  {
    id: "writing-style-imitation",
    label: "风格模仿",
    description: "学习并模仿指定作者的写作风格，统一全书文风",
    category: "writing",
    prompt: `## Writing Style Imitation

Analyze the provided reference text to identify the author's stylistic patterns:

1. **Vocabulary** — word choice, formality level, jargon usage
2. **Syntax** — sentence length distribution, clause structures, paragraph rhythm
3. **Rhetorical devices** — metaphors, analogies, repetition patterns
4. **Pacing** — action vs. description ratio, dialogue density
5. **Tone** — emotional register, narrative distance, point-of-view consistency

When generating new content, apply the extracted style signature to every sentence.`,
  },
  {
    id: "world-consistency-check",
    label: "世界一致性检查",
    description: "检查新章节是否符合已设定的世界规则",
    category: "world",
    prompt: `## World Consistency Check

Evaluate the new chapter against established world rules:

1. **Geography** — does the location match the established map?
2. **History** — are referenced events consistent with the timeline?
3. **Magic/Technology** — do abilities follow the defined rules?
4. **Culture** — are customs, languages, and social norms consistent?
5. **Economy** — do trade, currency, and resource descriptions align?

Flag any contradictions and suggest corrections.`,
  },
  {
    id: "character-voice",
    label: "角色声音",
    description: "确保每个角色的对话风格保持一致",
    category: "character",
    prompt: `## Character Voice

Maintain consistent character dialogue by tracking:

1. **Speech patterns** — catchphrases, sentence fragments, formality
2. **Vocabulary** — preferred words, education level indicators
3. **Emotional baseline** — how the character expresses anger, joy, fear
4. **Relationship cues** — how they address different characters
5. **Non-verbal tics** — gestures, pauses, laughter patterns

Review all dialogue lines and flag inconsistencies.`,
  },
  {
    id: "plot-advancement",
    label: "情节推进",
    description: "分析当前情节状态，给出推进建议",
    category: "analysis",
    prompt: `## Plot Advancement

Analyze the current story state and suggest next steps:

1. **Current tension** — what conflicts are unresolved?
2. **Character arcs** — which characters need development?
3. **Pacing assessment** — is the story dragging or rushing?
4. **Foreshadowing** — what setup needs payoff?
5. **Structural check** — are we due for a turning point?

Provide 3-5 concrete suggestions for the next scene or chapter.`,
  },
  {
    id: "dialogue-polish",
    label: "对话润色",
    description: "优化角色对话，使其更自然流畅",
    category: "writing",
    prompt: `## Dialogue Polish

Optimize dialogue for natural flow and character authenticity:

1. **Natural rhythm** — trim exposition, add interruptions
2. **Subtext** — what characters mean vs. what they say
3. **Voice consistency** — each character sounds unique
4. **Pacing beats** — action tags, pauses, reactions
5. **Purpose** — does each line serve story or character?

Rewrite dialogue to feel authentic while preserving plot intent.`,
  },
];

// ── AI generate helper (simplified version) ──

function generateSkillFromDescription(description: string): Partial<SkillConfig> {
  const id = description
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  const hasWritingKeyword = /写作|润色|风格|修饰|优化/.test(description);
  const hasWorldKeyword = /世界|设定|规则|地理|历史/.test(description);
  const hasCharacterKeyword = /角色|人物|对话|性格/.test(description);
  const hasPlotKeyword = /情节|推进|故事|剧情|大纲/.test(description);

  const category = hasWritingKeyword ? "writing"
    : hasWorldKeyword ? "world"
    : hasCharacterKeyword ? "character"
    : hasPlotKeyword ? "analysis"
    : "utility";

  return {
    id: id || `custom-${Date.now()}`,
    category: category as any,
    description: description.slice(0, 200),
    triggers: [{ type: "manual" as const }],
    injection: { mode: "append" as const, target: "system_prompt" as const, priority: 50 },
    params: {},
    enabled: true,
    prompt: `## ${description.slice(0, 30)}

Based on the user's description, this skill helps with: ${description}

### Instructions
1. Analyze the input according to the skill's purpose
2. Apply the relevant rules and constraints
3. Generate output that meets the defined criteria`,
  };
}

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

export function SkillEditSheet({ skillId, isOpen, onClose, onSaved, createDraft, skillSource }: SkillEditSheetProps) {
  const [original, setOriginal] = useState<SkillConfig | null>(null);
  const [draft, setDraft] = useState<SkillConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentQuery, setAgentQuery] = useState("");
  const [source, setSource] = useState<"project" | "builtin" | null>(null);
  const [showTemplatePanel, setShowTemplatePanel] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiDescription, setAiDescription] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const isCreateMode = skillId === "__create__";

  const isBuiltin = !isCreateMode && source === "builtin";

  const hasChanges = useMemo(() => {
    if (!original || !draft) return false;
    return JSON.stringify(original) !== JSON.stringify(draft);
  }, [original, draft]);

  const loadSkill = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<{ skill: ApiSkillResponse }>(`/api/skills/${encodeURIComponent(id)}`);
      setOriginal(data.skill.config);
      setDraft(data.skill.config);
      setSource(data.skill.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !skillId) {
      setOriginal(null);
      setDraft(null);
      setError(null);
      setAgentQuery("");
      setSource(null);
      setShowTemplatePanel(false);
      setShowAiPanel(false);
      setAiDescription("");
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
      setSource("project");
      return;
    }

    loadSkill(skillId);
  }, [isOpen, skillId, createDraft, isCreateMode, loadSkill]);

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

    // Fix empty prompt: provide default template if prompt is empty
    const savePayload = {
      ...draft,
      prompt: draft.prompt?.trim() || DEFAULT_PROMPT_TEMPLATE,
    };

    try {
      if (isCreateMode) {
        await fetchJson<{ skill: ApiSkillResponse }>("/api/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(savePayload),
        });
      } else {
        if (!skillId) return;
        const update = {
          category: savePayload.category,
          triggers: savePayload.triggers,
          injection: savePayload.injection,
          params: savePayload.params,
          enabled: savePayload.enabled,
          description: savePayload.description,
          prompt: savePayload.prompt,
          agents: savePayload.agents,
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

  const handleTemplateSelect = (tpl: typeof BUILTIN_TEMPLATES[number]) => {
    if (!draft) return;
    setDraft({
      ...draft,
      id: tpl.id,
      description: tpl.description,
      category: tpl.category,
      prompt: tpl.prompt,
    });
    setShowTemplatePanel(false);
  };

  const handleAiGenerate = () => {
    if (!aiDescription.trim() || !draft) return;
    setAiGenerating(true);
    setTimeout(() => {
      const generated = generateSkillFromDescription(aiDescription);
      setDraft({
        ...draft,
        id: generated.id || draft.id,
        category: (generated.category as SkillCategory) || draft.category,
        description: generated.description || draft.description,
        prompt: generated.prompt || draft.prompt,
      });
      setAiGenerating(false);
      setShowAiPanel(false);
      setAiDescription("");
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-background/35 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="关闭 Skill 编辑面板"
        className="absolute inset-0 cursor-default"
        onClick={handleClose}
      />
      <aside className="relative flex h-full w-[min(680px,calc(100vw-24px))] flex-col border-l border-border/55 bg-background shadow-2xl pt-[72px]">
        <header className="flex items-start justify-between gap-4 border-b border-border/45 px-6 py-5">
          <div className="min-w-0">
            <div className="text-[13px] font-medium uppercase tracking-[0.18em] text-muted-foreground/65">
              {isCreateMode ? "创建 Skill" : isBuiltin ? "查看 Skill" : "Skill 编辑"}
            </div>
            <h2 className="mt-1 truncate text-[22px] font-semibold text-foreground">
              {draft?.id ?? skillId ?? "—"}
            </h2>
            {draft && (
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                  {ZH_CATEGORY_LABELS[draft.category]}
                </span>
                {isBuiltin && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 text-blue-500 px-2 py-0.5 text-[11px]">
                    <Puzzle size={10} />
                    内置 Skill（只读）
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isBuiltin && (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !draft || (!isCreateMode && !hasChanges)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-[14px] font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                保存
              </button>
            )}
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
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {isBuiltin && (
          <div className="mx-6 mt-4 flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-[13px] leading-6 text-blue-600">
            <Puzzle size={16} className="shrink-0 mt-0.5" />
            <span>此 Skill 为内置 Skill，不可编辑。你可以在列表中启用或禁用它。</span>
          </div>
        )}

        {isCreateMode && (
          <div className="mx-6 mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTemplatePanel(!showTemplatePanel)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
                showTemplatePanel
                  ? "border-primary/50 bg-primary/5 text-primary"
                  : "border-border/40 text-muted-foreground hover:bg-secondary/30 hover:text-foreground"
              )}
            >
              <Copy size={13} />
              使用模板
            </button>
            <button
              type="button"
              onClick={() => setShowAiPanel(!showAiPanel)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
                showAiPanel
                  ? "border-primary/50 bg-primary/5 text-primary"
                  : "border-border/40 text-muted-foreground hover:bg-secondary/30 hover:text-foreground"
              )}
            >
              <Sparkles size={13} />
              AI 辅助
            </button>
          </div>
        )}

        {/* Template panel */}
        {showTemplatePanel && (
          <div className="mx-6 mt-3 rounded-xl border border-border/40 bg-card p-4 space-y-2 max-h-[260px] overflow-y-auto">
            <p className="text-[11px] text-muted-foreground/60 mb-2">选择一个模板快速填充配置：</p>
            {BUILTIN_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleTemplateSelect(tpl)}
                className="w-full text-left rounded-lg border border-border/30 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <div className="text-[13px] font-medium text-foreground">{tpl.label}</div>
                <div className="text-[11px] text-muted-foreground/70 mt-0.5">{tpl.description}</div>
                <div className="text-[10px] text-muted-foreground/50 mt-1">
                  分类：{ZH_CATEGORY_LABELS[tpl.category]}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* AI Panel */}
        {showAiPanel && (
          <div className="mx-6 mt-3 rounded-xl border border-border/40 bg-card p-4 space-y-3">
            <p className="text-[11px] text-muted-foreground">描述你想要的 Skill 功能：</p>
            <textarea
              value={aiDescription}
              onChange={(e) => setAiDescription(e.target.value)}
              placeholder="例如：检查角色对话风格是否统一…"
              rows={3}
              className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm resize-y outline-none focus:border-primary/50 transition-colors"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAiPanel(false)}
                className="px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAiGenerate}
                disabled={!aiDescription.trim() || aiGenerating}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-medium rounded-lg transition-all",
                  aiDescription.trim() && !aiGenerating
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {aiGenerating ? "生成中…" : "生成"}
              </button>
            </div>
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
                {isBuiltin ? (
                  <div className="w-full rounded-lg border border-border/40 bg-secondary/20 px-3 py-2 text-sm text-muted-foreground">
                    {draft.description || "无描述"}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                    placeholder="Skill 用途描述"
                    className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
                  />
                )}
              </section>

              {/* Triggers — Visual Builder */}
              {isBuiltin ? (
                <section className="space-y-2">
                  <label className="text-[13px] font-medium text-foreground">触发器</label>
                  <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-1">
                    {draft.triggers.length > 0 ? draft.triggers.map((t, i) => (
                      <div key={i} className="text-[12px] text-muted-foreground">
                        <span className="font-medium">{t.type}</span>
                        {t.condition && <span className="ml-2 text-[11px]">({t.condition})</span>}
                      </div>
                    )) : <span className="text-[12px] text-muted-foreground/50">无触发器</span>}
                  </div>
                </section>
              ) : (
                <TriggerBuilder
                  triggers={draft.triggers}
                  onChange={(newTriggers) => setDraft({ ...draft, triggers: newTriggers })}
                />
              )}

              {/* Injection */}
              <section className="space-y-3">
                <label className="text-[13px] font-medium text-foreground">注入配置</label>
                {isBuiltin ? (
                  <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-1">
                    <div className="text-[12px] text-muted-foreground">
                      <span className="text-muted-foreground/50">模式：</span> {draft.injection.mode}
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      <span className="text-muted-foreground/50">目标：</span> {draft.injection.target}
                    </div>
                    <div className="text-[12px] text-muted-foreground">
                      <span className="text-muted-foreground/50">优先级：</span> {draft.injection.priority}
                    </div>
                  </div>
                ) : (
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
                )}
              </section>

              {/* Agent binding */}
              <section className="space-y-3">
                <label className="text-[13px] font-medium text-foreground">绑定 Agent</label>
                {isBuiltin ? (
                  <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
                    {draft.agents.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {draft.agents.map((role) => (
                          <span key={role} className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-[11px] text-muted-foreground">
                            <Bot size={12} />
                            {AGENT_ROLE_LABELS[role as AgentRole] || role}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[12px] text-muted-foreground/50">未绑定 Agent</span>
                    )}
                  </div>
                ) : (
                  <>
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
                  </>
                )}
              </section>

              {/* Prompt */}
              <section className="space-y-2">
                <label className="text-[13px] font-medium text-foreground">Prompt</label>
                {isBuiltin ? (
                  <pre className="w-full rounded-xl border border-border/55 bg-secondary/20 px-4 py-4 font-mono text-[14px] leading-6 text-muted-foreground overflow-x-auto whitespace-pre-wrap max-h-80 overflow-y-auto">
                    {draft.prompt || "（无 Prompt）"}
                  </pre>
                ) : (
                  <textarea
                    value={draft.prompt}
                    onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                    placeholder="输入 Skill 注入时使用的 Prompt…"
                    rows={10}
                    spellCheck={false}
                    className="w-full resize-none rounded-xl border border-border/55 bg-secondary/20 px-4 py-4 font-mono text-[14px] leading-6 text-foreground outline-none transition focus:border-primary/50 focus:bg-background"
                  />
                )}
                {draft.prompt?.trim() === "" && !isBuiltin && (
                  <p className="text-[11px] text-amber-500/80">
                    保存时如果 Prompt 为空，将自动填入默认模板
                  </p>
                )}
              </section>
            </>
          )}

          {/* Version History (only for existing skills) */}
          {!isCreateMode && skillId && skillId !== "__create__" && !isBuiltin && (
            <SkillVersionHistory skillId={skillId} onRestored={onSaved} />
          )}
        </div>
      </aside>
    </div>
  );
}

// ── Skill Version History (Issue #96) ──

interface SkillVersionMeta {
  rev: number;
  timestamp: string;
  id: string;
}

interface SkillVersionHistoryProps {
  readonly skillId: string;
  readonly onRestored?: () => void;
}

function SkillVersionHistory({ skillId, onRestored }: SkillVersionHistoryProps) {
  const [expanded, setExpanded] = useState(false);
  const [versions, setVersions] = useState<SkillVersionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    setError(null);
    fetchJson<{ versions: SkillVersionMeta[] }>(`/api/skills/${encodeURIComponent(skillId)}/versions`)
      .then((data) => setVersions(data.versions ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [expanded, skillId]);

  const handleRestore = async (rev: number) => {
    if (!confirm(`确定要回滚到版本 #${rev} 吗？当前修改将被覆盖。`)) return;
    setRestoring(rev);
    setError(null);
    try {
      await fetchJson(`/api/skills/${encodeURIComponent(skillId)}/versions/${rev}/restore`, { method: "POST" });
      onRestored?.();
      setVersions((prev) => prev.filter((v) => v.rev !== rev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "回滚失败");
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch {
      return iso;
    }
  };

  return (
    <section className="space-y-2 border-t border-border/30 pt-4 mt-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left"
      >
        <History size={14} className="text-muted-foreground" />
        <span className="text-[13px] font-medium text-foreground flex-1">版本历史</span>
        {expanded ? <ChevronDown size={14} className="text-muted-foreground/40" /> : <ChevronRight size={14} className="text-muted-foreground/40" />}
      </button>

      {expanded && (
        <div className="space-y-2">
          {loading && (
            <div className="flex items-center gap-2 py-2">
              <Loader2 size={12} className="animate-spin text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground/60">加载中…</span>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2 text-[11px] text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && versions.length === 0 && (
            <p className="text-[11px] text-muted-foreground/50 py-2 text-center">暂无版本历史</p>
          )}

          {!loading && versions.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {versions.map((ver) => (
                <div
                  key={ver.rev}
                  className="flex items-center gap-2 rounded-md border border-border/30 bg-card px-3 py-2 text-[11px]"
                >
                  <span className="font-mono font-medium text-muted-foreground shrink-0">
                    #{ver.rev}
                  </span>
                  <span className="text-muted-foreground/60 truncate flex-1">
                    {formatDate(ver.timestamp)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRestore(ver.rev)}
                    disabled={restoring === ver.rev}
                    className="inline-flex items-center gap-1 rounded border border-border/40 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors disabled:opacity-40 shrink-0"
                    title="回滚到此版本"
                  >
                    <RotateCcw size={10} />
                    {restoring === ver.rev ? "回滚中…" : "回滚"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
