import { useMemo, useState, useCallback } from "react";
import { ArrowLeft, Search, X, Sparkles, Plus, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Edit2, Code, MessageSquare, Puzzle } from "lucide-react";
import { useHashRoute } from "../hooks/use-hash-route";
import { cn } from "../lib/utils";
import { useApi, fetchJson } from "../hooks/use-api";
import type { SkillConfig, SkillCategory } from "@actalk/inkchain-core/models/skill-config.js";
import { SKILL_CATEGORY_LABELS } from "@actalk/inkchain-core/models/skill-config.js";
import { SkillEditSheet } from "../components/SkillEditSheet";
import { SkillCreateDialog } from "../components/SkillCreateDialog";

interface ApiSkillResponse {
  readonly config: SkillConfig;
  readonly source: "project" | "builtin";
  readonly path?: string;
}

interface SkillsListResponse {
  readonly skills: ReadonlyArray<ApiSkillResponse>;
}

const CATEGORY_COLORS: Record<SkillCategory, string> = {
  writing: "#4A90D9",
  analysis: "#22C55E",
  world: "#8B5CF6",
  character: "#E88D3A",
  utility: "#9CA3AF",
};

const CATEGORY_BG: Record<SkillCategory, string> = {
  writing: "bg-[#4A90D9]/10 text-[#4A90D9]",
  analysis: "bg-[#22C55E]/10 text-[#22C55E]",
  world: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
  character: "bg-[#E88D3A]/10 text-[#E88D3A]",
  utility: "bg-[#9CA3AF]/10 text-[#9CA3AF]",
};

const ZH_CATEGORY_LABELS: Record<SkillCategory, string> = {
  writing: "写作",
  analysis: "分析",
  world: "世界",
  character: "角色",
  utility: "实用",
};

const BUILTIN_ZH_DESCRIPTIONS: Record<string, string> = {
  "writing-style-imitation": "学习并模仿指定作者的写作风格，统一全书文风",
  "world-consistency-check": "检查新章节是否符合已设定的世界规则",
  "character-voice": "确保每个角色的对话风格保持一致",
  "plot-advancement": "分析当前情节状态，给出推进建议",
  "dialogue-polish": "优化角色对话，使其更自然流畅",
  "humanizer-zh-skill": "检测并消除文中的 AI 写作痕迹，使文本更自然",
  "longform-writing-skill": "长篇小说创作：规划章节、选择故事上下文、写作并保持连续性",
  "interactive-film-authoring-skill": "交互式剧本创作与编辑",
  "open-world-play-skill": "开放世界自由游玩模式",
};

const BUILTIN_ZH_CATEGORY: Record<string, SkillCategory> = {
  "writing-style-imitation": "writing",
  "world-consistency-check": "world",
  "character-voice": "character",
  "plot-advancement": "analysis",
  "dialogue-polish": "writing",
  "humanizer-zh-skill": "writing",
  "longform-writing-skill": "writing",
  "interactive-film-authoring-skill": "writing",
  "open-world-play-skill": "world",
};

type StatusFilter = "all" | "enabled" | "disabled";

export function SkillListPage() {
  const { setRoute } = useHashRoute();
  const { data, loading, error, refetch } = useApi<SkillsListResponse>("/api/skills");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | SkillCategory>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingSkillSource, setEditingSkillSource] = useState<"project" | "builtin" | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createMode, setCreateMode] = useState<"blank" | "template" | "ai" | null>(null);
  const [aiDraft, setAiDraft] = useState<Partial<SkillConfig> | null>(null);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredSkills = useMemo(() => {
    const list = data?.skills ?? [];
    return list.filter((item) => {
      const config = item.config;
      if (category !== "all" && config.category !== category) return false;
      if (status === "enabled" && !config.enabled) return false;
      if (status === "disabled" && config.enabled) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const nameMatch = config.id.toLowerCase().includes(q);
        const descMatch = (config.description?.toLowerCase() ?? "").includes(q);
        const zhDesc = BUILTIN_ZH_DESCRIPTIONS[config.id];
        const zhMatch = zhDesc ? zhDesc.includes(q) : false;
        if (!nameMatch && !descMatch && !zhMatch) return false;
      }
      return true;
    });
  }, [data, category, status, query]);

  const totalPages = Math.max(1, Math.ceil(filteredSkills.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedSkills = useMemo(() => {
    return filteredSkills.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);
  }, [filteredSkills, safeCurrentPage, pageSize]);

  const handleToggle = useCallback(async (id: string) => {
    if (toggling.has(id)) return;
    setToggling((prev) => new Set(prev).add(id));
    try {
      await fetchJson<{ skill: ApiSkillResponse }>(`/api/skills/${id}/toggle`, { method: "PATCH" });
      await refetch();
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [toggling, refetch]);

  const handleCardClick = useCallback((id: string) => {
    setExpandedSkillId((prev) => (prev === id ? null : id));
  }, []);

  const handleEditSkill = useCallback((id: string, source: "project" | "builtin") => {
    setEditingSkillId(id);
    setEditingSkillSource(source);
  }, []);

  const getDisplayDescription = (config: SkillConfig, source: "project" | "builtin"): string => {
    const zhDesc = BUILTIN_ZH_DESCRIPTIONS[config.id];
    if (source === "builtin") {
      return zhDesc || config.description || "无描述";
    }
    // Fallback: try Chinese mapping even for project-override skills (e.g., toggled builtins)
    return zhDesc || config.description || "无描述";
  };

  const getDisplayCategory = (config: SkillConfig, source: "project" | "builtin"): { label: string; key: SkillCategory } => {
    if (source === "builtin" && BUILTIN_ZH_CATEGORY[config.id]) {
      const zhCat = BUILTIN_ZH_CATEGORY[config.id];
      return { label: ZH_CATEGORY_LABELS[zhCat], key: zhCat };
    }
    return { label: ZH_CATEGORY_LABELS[config.category], key: config.category };
  };

  // Generate page numbers to display
  const pageNumbers = useMemo(() => {
    const maxVisible = 5;
    const pages: (number | "...")[] = [];
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, safeCurrentPage - 1);
      let end = Math.min(totalPages - 1, safeCurrentPage + 1);
      if (safeCurrentPage <= 3) {
        start = 2;
        end = Math.min(totalPages - 1, 4);
      } else if (safeCurrentPage >= totalPages - 2) {
        start = Math.max(2, totalPages - 3);
        end = totalPages - 1;
      }
      if (start > 2) pages.push("...");
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        type="button"
        onClick={() => setRoute({ page: "project-settings" })}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft size={16} />
        <span>返回设置</span>
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Skill 库</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理项目级与内置 Skill，控制启用状态与分类
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateDialog(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          创建 Skill
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 Skill 名称或描述…"
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as "all" | SkillCategory)}
          className="px-3 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
        >
          <option value="all">全部分类</option>
          {(Object.keys(SKILL_CATEGORY_LABELS) as SkillCategory[]).map((key) => (
            <option key={key} value={key}>{ZH_CATEGORY_LABELS[key]}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="px-3 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
        >
          <option value="all">全部状态</option>
          <option value="enabled">已启用</option>
          <option value="disabled">已禁用</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" data-testid="sl-state-error">
          加载失败：{error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="sl-state-loading">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-card p-4 space-y-3 animate-pulse">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
              <div className="h-3 w-full bg-muted rounded" />
              <div className="h-8 w-full bg-muted rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filteredSkills.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="sl-state-empty">
          <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
            <Sparkles size={20} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">
            {query || category !== "all" || status !== "all"
              ? "没有符合条件的 Skill"
              : "暂无 Skill，请创建或检查内置 Skill 配置"}
          </p>
        </div>
      )}

      {/* Grid */}
      {!loading && filteredSkills.length > 0 && (
        <div className="space-y-4">
          {/* Total count */}
          <div className="text-xs text-muted-foreground/60">
            共 {filteredSkills.length} 个 Skill
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pagedSkills.map((item) => {
              const config = item.config;
              const source = item.source;
              const isExpanded = expandedSkillId === config.id;
              const displayInfo = getDisplayCategory(config, source);
              const cat = displayInfo.key;
              return (
                <div key={config.id} className="space-y-0">
                  {/* Card */}
                  <div
                    className={cn(
                      "rounded-xl border border-border/40 bg-card p-4 transition-all cursor-pointer hover:border-border/70",
                      !config.enabled && "opacity-60",
                      isExpanded && "rounded-b-none border-b-0 shadow-sm"
                    )}
                    onClick={() => handleCardClick(config.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {source === "builtin" && (
                            <Puzzle size={14} className="text-muted-foreground/40 shrink-0" />
                          )}
                          <h3 className="font-medium text-foreground truncate">
                            {config.id}
                          </h3>
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
                              CATEGORY_BG[cat]
                            )}
                          >
                            {displayInfo.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {getDisplayDescription(config, source)}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                          />
                          <span>{source === "project" ? "项目级" : "内置"}</span>
                          {isExpanded ? (
                            <ChevronUp size={12} className="ml-auto text-muted-foreground/30" />
                          ) : (
                            <ChevronDown size={12} className="ml-auto text-muted-foreground/30" />
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {source === "project" && !/^(interactive-film-authoring|narrative-intelligence-agent)/.test(config.id) && (
                          <button
                            type="button"
                            onClick={() => handleEditSkill(config.id, source)}
                            className="rounded-lg border border-border/40 p-1.5 text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors"
                            title="编辑 Skill"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={config.enabled}
                          disabled={toggling.has(config.id)}
                          onClick={() => handleToggle(config.id)}
                          className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                            config.enabled ? "bg-primary" : "bg-muted-foreground/30",
                            toggling.has(config.id) && "opacity-60 cursor-wait"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                              config.enabled ? "translate-x-[18px]" : "translate-x-1"
                            )}
                          />
                        </button>
                        <span className={cn("text-[10px]", config.enabled ? "text-primary" : "text-muted-foreground")}>
                          {config.enabled ? "已启用" : "已禁用"}
                        </span>
                      </div>
                    </div>

                    {config.triggers && config.triggers.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/30">
                        <p className="text-[10px] text-muted-foreground/60">
                          触发器：{config.triggers.length} 个
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="rounded-b-xl border border-t-0 border-border/40 bg-card/50 p-4 space-y-3 text-sm animate-in slide-in-from-top-1 duration-150">
                      {/* Description */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                          <MessageSquare size={12} />
                          <span>描述</span>
                        </div>
                        <p className="text-xs text-foreground/80 leading-relaxed pl-5">
                          {getDisplayDescription(config, source)}
                        </p>
                      </div>

                      {/* Triggers */}
                      {config.triggers && config.triggers.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <Code size={12} />
                            <span>触发器 ({config.triggers.length} 个)</span>
                          </div>
                          <div className="pl-5 space-y-1">
                            {config.triggers.map((t, i) => (
                              <div key={i} className="text-[11px] text-foreground/70">
                                <span className="font-mono text-muted-foreground/60">type: </span>
                                <span>{t.type}</span>
                                {t.condition && (
                                  <>
                                    <span className="font-mono text-muted-foreground/60 ml-2">condition: </span>
                                    <span className="font-mono text-[10px]">{t.condition}</span>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Injection */}
                      {config.injection && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <Puzzle size={12} />
                            <span>注入配置</span>
                          </div>
                          <div className="pl-5 grid grid-cols-3 gap-2 text-[11px]">
                            <div>
                              <span className="text-muted-foreground/60">模式：</span>
                              <span className="text-foreground/80">{config.injection.mode}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground/60">目标：</span>
                              <span className="text-foreground/80">{config.injection.target}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground/60">优先级：</span>
                              <span className="text-foreground/80">{config.injection.priority}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Prompt */}
                      {config.prompt && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                            <MessageSquare size={12} />
                            <span>Prompt</span>
                          </div>
                          <div className="pl-5">
                            <pre className="text-[11px] text-foreground/70 bg-muted/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                              {config.prompt}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Edit button inside detail panel for project skills */}
                      {source === "project" && !/^(interactive-film-authoring|narrative-intelligence-agent)/.test(config.id) && (
                        <div className="pt-2 border-t border-border/20">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSkill(config.id, source);
                            }}
                            className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors"
                          >
                            <Edit2 size={12} />
                            编辑此 Skill
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border/20">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>每页</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded border border-border/40 bg-background text-xs outline-none focus:border-primary/50"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
                <span>条</span>
                <span className="text-muted-foreground/50">
                  — 第 {(safeCurrentPage - 1) * pageSize + 1}-{Math.min(safeCurrentPage * pageSize, filteredSkills.length)} 条，共 {filteredSkills.length} 条
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className={cn(
                    "rounded-lg border border-border/40 p-1.5 transition-colors",
                    safeCurrentPage <= 1
                      ? "text-muted-foreground/20 cursor-not-allowed"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <ChevronLeft size={14} />
                </button>

                {pageNumbers.map((page, idx) =>
                  page === "..." ? (
                    <span key={`ellipsis-${idx}`} className="px-1.5 text-xs text-muted-foreground/30">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "min-w-[28px] h-7 rounded-lg text-xs font-medium transition-colors",
                        page === safeCurrentPage
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground border border-border/40"
                      )}
                    >
                      {page}
                    </button>
                  )
                )}

                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className={cn(
                    "rounded-lg border border-border/40 p-1.5 transition-colors",
                    safeCurrentPage >= totalPages
                      ? "text-muted-foreground/20 cursor-not-allowed"
                      : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create dialog */}
      <SkillCreateDialog
        isOpen={showCreateDialog}
        onClose={() => { setShowCreateDialog(false); setCreateMode(null); setAiDraft(null); }}
        onSelectBlank={() => { setCreateMode("blank"); }}
        onSelectTemplate={(template) => { setCreateMode("template"); setAiDraft(template); }}
        onAiGenerate={(config) => { setCreateMode("ai"); setAiDraft(config); }}
      />

      {/* Create mode: open SkillEditSheet */}
      <SkillEditSheet
        skillId={createMode === "blank" ? "__create__" : (createMode ? "__create__" : editingSkillId)}
        isOpen={createMode !== null || editingSkillId !== null}
        onClose={() => { setEditingSkillId(null); setEditingSkillSource(null); setCreateMode(null); setAiDraft(null); }}
        onSaved={() => { refetch(); setCreateMode(null); setAiDraft(null); }}
        createDraft={createMode ? aiDraft ?? undefined : undefined}
        skillSource={editingSkillSource}
      />
    </div>
  );
}
