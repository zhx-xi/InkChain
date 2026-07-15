// ── Skill Bind Tab (Tab 3) ──
// Form for binding skills to a persona.
// Shows available skills from API with checkboxes and a search filter.

import { useCallback, useMemo, useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useApi } from "../hooks/use-api";
import type { PersonaConfig } from "@inkchain/inkchain-core/models/persona-config.js";
import type { SkillCategory } from "@inkchain/inkchain-core/models/skill-config.js";
import type { SkillConfig } from "@inkchain/inkchain-core";

// ── API Response Types ──

interface ApiSkillResponse {
  readonly config: SkillConfig;
  readonly source: "project" | "builtin";
  readonly path?: string;
}

interface SkillsListResponse {
  readonly skills: ReadonlyArray<ApiSkillResponse>;
}

// ── Internal Skill Entry ──

interface SkillEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
}

// ── Built-in Skill Chinese Descriptions ──
// Mirrors the mappings in SkillListPage.tsx

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

// ── Category Mapping (SkillCategory enum → Chinese name) ──

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  writing: "写作工具",
  analysis: "质量检查",
  world: "角色世界",
  character: "角色世界",
  utility: "高级",
};

const CATEGORY_COLORS: Record<string, string> = {
  "写作工具": "#E88D3A",
  "规划结构": "#8B5CF6",
  "质量检查": "#4A90D9",
  "角色世界": "#22C55E",
  "高级": "#9CA3AF",
};

// ── Helpers ──

function toDisplayName(skill: ApiSkillResponse): string {
  const { config, source } = skill;
  return config.id;
}

function toDisplayDescription(skill: ApiSkillResponse): string {
  const { config, source } = skill;
  const zhDesc = BUILTIN_ZH_DESCRIPTIONS[config.id];
  if (zhDesc) return zhDesc;
  return config.description || config.id;
}

function toDisplayCategory(skill: ApiSkillResponse): string {
  const { config } = skill;
  // Map SkillCategory enum to Chinese label
  const label = CATEGORY_LABELS[config.category as SkillCategory];
  return label || "高级";
}

function toSkillEntry(skill: ApiSkillResponse): SkillEntry {
  return {
    id: skill.config.id,
    name: toDisplayName(skill),
    description: toDisplayDescription(skill),
    category: toDisplayCategory(skill),
  };
}

function groupByCategory(skills: SkillEntry[]): Map<string, SkillEntry[]> {
  const grouped = new Map<string, SkillEntry[]>();
  for (const skill of skills) {
    const list = grouped.get(skill.category) ?? [];
    list.push(skill);
    grouped.set(skill.category, list);
  }
  return grouped;
}

// ── Props ──

interface SkillBindTabProps {
  readonly config: PersonaConfig;
  readonly onChange: (config: PersonaConfig) => void;
}

// ── Component ──

export function SkillBindTab({ config, onChange }: SkillBindTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { data, loading, error } = useApi<SkillsListResponse>("/api/skills");
  const boundSkills = config.boundSkills ?? [];

  // ── Compute skill entries from API data ──

  const allSkills: SkillEntry[] = useMemo(() => {
    if (!data?.skills) return [];
    return data.skills.map(toSkillEntry);
  }, [data]);

  // ── Handlers ──

  const handleToggleSkill = useCallback((skillId: string) => {
    const isBound = boundSkills.includes(skillId);
    const updated = isBound
      ? boundSkills.filter((id) => id !== skillId)
      : [...boundSkills, skillId];
    onChange({ ...config, boundSkills: updated });
  }, [config, onChange, boundSkills]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  // ── Filtered and grouped skills ──

  const { boundEntries, availableEntries } = useMemo(() => {
    const bound: SkillEntry[] = [];
    const available: SkillEntry[] = [];

    for (const skill of allSkills) {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = skill.name.toLowerCase().includes(q);
        const descMatch = skill.description.toLowerCase().includes(q);
        if (!nameMatch && !descMatch) {
          continue;
        }
      }
      if (boundSkills.includes(skill.id)) {
        bound.push(skill);
      } else {
        available.push(skill);
      }
    }

    return {
      boundEntries: groupByCategory(bound),
      availableEntries: groupByCategory(available),
    };
  }, [allSkills, boundSkills, searchQuery]);

  // ── Loading State ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-muted-foreground/40" />
        <span className="ml-3 text-sm text-muted-foreground/60">加载 Skill 列表…</span>
      </div>
    );
  }

  // ── Error State ──

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" data-testid="sbt-state-error">
          加载失败：{error}
        </div>
        <p className="text-xs text-muted-foreground/40 italic px-1">
          Skill 绑定功能暂时不可用，请稍后再试
        </p>
      </div>
    );
  }

  // ── Empty State ──

  if (allSkills.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-muted-foreground/40 italic px-1">
          所有 Skill 已绑定
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索 Skill…"
          className="w-full pl-9 pr-8 py-2 rounded-lg border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/50 transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Bound skills section */}
      {boundEntries.size > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            已绑定 ({boundSkills.length})
          </h3>
          {renderSkillGroup(boundEntries, boundSkills, handleToggleSkill, true)}
        </section>
      )}

      {/* Available skills section */}
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
          可用 Skill
        </h3>
        {availableEntries.size === 0 ? (
          <p className="text-xs text-muted-foreground/40 italic px-1">
            {searchQuery ? "未找到匹配的 Skill" : "所有 Skill 已绑定"}
          </p>
        ) : (
          renderSkillGroup(availableEntries, boundSkills, handleToggleSkill, false)
        )}
      </section>
    </div>
  );
}

// ── Render Helpers ──

function renderSkillGroup(
  grouped: Map<string, SkillEntry[]>,
  boundSkills: string[],
  onToggle: (id: string) => void,
  preChecked: boolean,
) {
  return (
    <div className="space-y-2">
      {[...grouped.entries()].map(([category, skills]) => (
        <div key={category}>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[category] ?? "#9CA3AF" }}
            />
            <span className="text-[11px] font-medium text-muted-foreground/60">
              {category}
            </span>
          </div>
          <div className="space-y-0.5">
            {skills.map((skill) => {
              const isBound = boundSkills.includes(skill.id);
              return (
                <label
                  key={skill.id}
                  className={cn(
                    "flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-colors",
                    "hover:bg-secondary/30",
                    isBound && "bg-primary/[0.04]",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={preChecked || isBound}
                    onChange={() => onToggle(skill.id)}
                    className="h-4 w-4 rounded border-muted-foreground/30 text-primary focus:ring-primary/30"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{skill.name}</span>
                      {isBound && (
                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[10px] font-medium text-primary">
                          已绑定
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 truncate">
                      {skill.description}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
