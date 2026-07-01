// ── Skill Bind Tab (Tab 3) ──
// Form for binding skills to a persona.
// Shows available skills with checkboxes and a search filter.

import { useCallback, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "../lib/utils";
import type { PersonaConfig } from "@actalk/inkos-core/models/persona-config.js";

// ── Mock Skill Data ──
// In production, this would be fetched from the Skills API.
// For now, we provide a representative set of built-in skills.

interface SkillEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
}

const AVAILABLE_SKILLS: ReadonlyArray<SkillEntry> = [
  // Category: Writing Tools
  { id: "write-next", name: "续写章节", description: "根据上下文续写下一章内容", category: "写作工具" },
  { id: "write-chapter", name: "撰写章节", description: "从零开始撰写新章节", category: "写作工具" },
  { id: "revise-chapter", name: "修订章节", description: "根据审计反馈修订已有章节", category: "写作工具" },

  // Category: Planning & Structure
  { id: "outline-generator", name: "大纲生成", description: "自动生成章节大纲和剧情弧线", category: "规划结构" },
  { id: "beat-planner", name: "节拍规划", description: "规划每章的起承转合节奏", category: "规划结构" },

  // Category: Quality Control
  { id: "continuity-check", name: "连贯性检查", description: "检查剧情、角色、设定的连贯性", category: "质量检查" },
  { id: "style-consistency", name: "风格一致性", description: "确保内容风格与设定一致", category: "质量检查" },
  { id: "content-audit", name: "内容审计", description: "全面审计章节质量", category: "质量检查" },

  // Category: Character & World
  { id: "character-dev", name: "角色发展追踪", description: "追踪角色的成长曲线和变化", category: "角色世界" },
  { id: "world-consistency", name: "世界观一致性", description: "检查设定和世界观的连贯性", category: "角色世界" },

  // Category: Advanced
  { id: "writers-block", name: "卡文突破", description: "分析上下文给出推进建议", category: "高级" },
  { id: "foreshadow-track", name: "伏笔追踪", description: "追踪伏笔设置和回收情况", category: "高级" },
  { id: "dialogue-polish", name: "对话润色", description: "优化对话的自然度和表现力", category: "高级" },
];

// ── Category colors ──

const CATEGORY_COLORS: Record<string, string> = {
  "写作工具": "#E88D3A",
  "规划结构": "#8B5CF6",
  "质量检查": "#4A90D9",
  "角色世界": "#22C55E",
  "高级": "#9CA3AF",
};

// ── Props ──

interface SkillBindTabProps {
  readonly config: PersonaConfig;
  readonly onChange: (config: PersonaConfig) => void;
}

// ── Component ──

export function SkillBindTab({ config, onChange }: SkillBindTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const boundSkills = config.boundSkills ?? [];

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

    for (const skill of AVAILABLE_SKILLS) {
      if (searchQuery && !skill.name.toLowerCase().includes(searchQuery.toLowerCase()) && !skill.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        continue;
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
  }, [boundSkills, searchQuery]);

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
      {boundEntries.length > 0 && (
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
        {availableEntries.length === 0 ? (
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

// ── Helpers ──

function groupByCategory(skills: SkillEntry[]): Map<string, SkillEntry[]> {
  const grouped = new Map<string, SkillEntry[]>();
  for (const skill of skills) {
    const list = grouped.get(skill.category) ?? [];
    list.push(skill);
    grouped.set(skill.category, list);
  }
  return grouped;
}

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
