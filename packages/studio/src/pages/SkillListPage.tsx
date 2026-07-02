import { useMemo, useState, useCallback } from "react";
import { Search, X, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";
import { useApi, fetchJson } from "../hooks/use-api";
import type { SkillConfig, SkillCategory } from "@actalk/inkos-core";
import { SKILL_CATEGORY_LABELS } from "@actalk/inkos-core";

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

type StatusFilter = "all" | "enabled" | "disabled";

export function SkillListPage() {
  const { data, loading, error, refetch } = useApi<SkillsListResponse>("/api/skills");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | SkillCategory>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [toggling, setToggling] = useState<Set<string>>(new Set());

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
        if (!nameMatch && !descMatch) return false;
      }
      return true;
    });
  }, [data, category, status, query]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">Skill 库</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理项目级与内置 Skill，控制启用状态与分类
          </p>
        </div>
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
            <option key={key} value={key}>{SKILL_CATEGORY_LABELS[key]}</option>
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
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          加载失败：{error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
        <div className="flex flex-col items-center justify-center py-16 text-center">
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSkills.map((item) => {
            const config = item.config;
            const cat = config.category;
            return (
              <div
                key={config.id}
                className={cn(
                  "rounded-xl border border-border/40 bg-card p-4 transition-opacity",
                  !config.enabled && "opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-foreground truncate">
                        {config.id}
                      </h3>
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0",
                          CATEGORY_BG[cat]
                        )}
                      >
                        {SKILL_CATEGORY_LABELS[cat]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {config.description || "无描述"}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                      />
                      <span>{item.source === "project" ? "项目级" : "内置"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
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
            );
          })}
        </div>
      )}
    </div>
  );
}
