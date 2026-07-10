import { useState } from "react";
import { Copy, FileText, Sparkles, X } from "lucide-react";
import { cn } from "../lib/utils";
import { fetchJson } from "../hooks/use-api";
import type { SkillConfig } from "@actalk/inkchain-core";

// ── Built-in skill templates ──

const BUILTIN_TEMPLATES: Array<{ id: string; label: string; description: string }> = [
  {
    id: "writing-style-imitation",
    label: "风格模仿",
    description: "学习并模仿指定作者的写作风格，统一全书文风",
  },
  {
    id: "world-consistency-check",
    label: "世界一致性检查",
    description: "检查新章节是否符合已设定的世界规则",
  },
  {
    id: "character-voice",
    label: "角色声音",
    description: "确保每个角色的对话风格保持一致",
  },
  {
    id: "plot-advancement",
    label: "情节推进",
    description: "分析当前情节状态，给出推进建议",
  },
  {
    id: "dialogue-polish",
    label: "对话润色",
    description: "优化角色对话，使其更自然流畅",
  },
];

// ── AI generation helper ──

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
  };
}

// ── Props ──

interface SkillCreateDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSelectBlank: () => void;
  readonly onSelectTemplate: (template: Partial<SkillConfig>) => void;
  readonly onAiGenerate: (config: Partial<SkillConfig>) => void;
}

// ── Component ──

export function SkillCreateDialog({ isOpen, onClose, onSelectBlank, onSelectTemplate, onAiGenerate }: SkillCreateDialogProps) {
  const [mode, setMode] = useState<"select" | "generate" | null>("select");
  const [showTemplateList, setShowTemplateList] = useState(false);
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);

  if (!isOpen) return null;

  const handleBlank = () => {
    onSelectBlank();
    onClose();
  };

  const handleTemplateSelect = (tpl: typeof BUILTIN_TEMPLATES[number]) => {
    const config: Partial<SkillConfig> = {
      id: tpl.id,
      description: tpl.description,
      category: "utility" as any,
      triggers: [{ type: "manual" as const }],
      injection: { mode: "append" as const, target: "system_prompt" as const, priority: 50 },
      params: {},
      enabled: true,
    };
    onSelectTemplate(config);
    onClose();
  };

  const handleGenerate = () => {
    if (!description.trim()) return;
    setGenerating(true);
    // Simulate AI generation
    setTimeout(() => {
      const config = generateSkillFromDescription(description);
      setGenerating(false);
      onAiGenerate(config);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 pt-[72px]" onClick={onClose}>
      <div className="bg-card rounded-xl border border-border/60 shadow-xl p-6 w-full max-w-xl mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">创建 Skill</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground/40 hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Mode selection cards */}
        {mode === "select" && (
          <div className="grid grid-cols-3 gap-4">
            {/* Blank */}
            <button
              type="button"
              onClick={handleBlank}
              className="group flex flex-col items-center gap-3 rounded-xl border border-border/40 bg-card p-6 hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
            >
              <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <FileText size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">空白创建</h3>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                  从零开始填写所有字段，适合高级用户
                </p>
              </div>
            </button>

            {/* Generate */}
            <button
              type="button"
              onClick={() => setMode("generate")}
              className="group flex flex-col items-center gap-3 rounded-xl border border-border/40 bg-card p-6 hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
            >
              <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Sparkles size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">AI 辅助生成</h3>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                  描述需求让 AI 自动生成配置
                </p>
              </div>
            </button>

            {/* Template list */}
            <button
              type="button"
              onClick={() => setShowTemplateList(true)}
              className="group flex flex-col items-center gap-3 rounded-xl border border-border/40 bg-card p-6 hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
            >
              <div className="h-10 w-10 rounded-lg bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Copy size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <h3 className="text-sm font-medium mb-1">模板复制</h3>
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                  从内置模板列表中选择
                </p>
              </div>
            </button>
          </div>
        )}

        {/* Template list mode */}
        {showTemplateList && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {BUILTIN_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleTemplateSelect(tpl)}
                  className="group flex items-start gap-3 rounded-xl border border-border/40 bg-card p-4 hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                >
                  <div>
                    <h3 className="text-sm font-medium mb-0.5">{tpl.label}</h3>
                    <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{tpl.description}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowTemplateList(false)}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              返回
            </button>
          </div>
        )}

        {/* AI Generate mode */}
        {mode === "generate" && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              请用自然语言描述您需要的 Skill，AI 将自动生成配置草案。
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例如：检查角色对话风格是否统一，每个主角的说话方式要一致…"
              className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-sm min-h-[120px] resize-y outline-none focus:border-primary/50 transition-colors"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMode("select")}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                返回
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!description.trim() || generating}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded-lg transition-all",
                  description.trim() && !generating
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {generating ? "生成中…" : "生成"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
