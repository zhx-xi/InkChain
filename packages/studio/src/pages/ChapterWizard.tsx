// ── Chapter Generation Pipeline (Issue #278) ──
// 4-step wizard: 场景描述 → 关联实体 → 生成参数 → 逐段审核
// Prototype: inkos-v3-01-generation-pipeline.html

import { useState, useMemo, useCallback, useEffect } from "react";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import { useApi, postApi } from "../hooks/use-api";
import { Sparkles, Check, X, ChevronLeft, ChevronRight, Loader2, Search, FileText, User, MapPin, Building, BookOpen, Clock, RefreshCw, SkipForward, Edit3 } from "lucide-react";

// ── Types ──

interface Nav {
  toDashboard: () => void;
  toBook: (id: string) => void;
}

interface ChapterWizardProps {
  bookId: string;
  nav: Nav;
  theme: Theme;
  t: TFunction;
}

type Colors = ReturnType<typeof useColors>;


// ── World Entity Types ──

interface WorldSummary {
  id: string;
  name: string;
  description?: string;
}

interface WorldEntity {
  id: string;
  name: string;
  type: "character" | "location" | "institution" | "event" | "setting";
  subType?: string;
  worldId: string;
  worldName: string;
}

interface ParagraphItem {
  id: number;
  content: string;
  status: "pending" | "approved" | "editing" | "regenerating" | "skipped";
}

type GenerationStyle = "描述" | "对话" | "动作";

// ── Constants ──

const STEPS = [
  { num: 1, label: "场景描述" },
  { num: 2, label: "关联实体" },
  { num: 3, label: "生成参数" },
  { num: 4, label: "逐段审核" },
];

const STYLE_OPTIONS: { value: GenerationStyle; label: string; desc: string; icon: string }[] = [
  { value: "描述", label: "偏描写", desc: "景物与氛围细节丰富", icon: "🌄" },
  { value: "对话", label: "偏对话", desc: "对白与互动为主", icon: "💬" },
  { value: "动作", label: "偏动作", desc: "战斗与冲突推进叙事", icon: "⚔️" },
];

const COLOR_PALETTE = {
  primary: "#8B3A3A",
  primaryLight: "#F5E0E0",
  gold: "#D4A855",
  goldLight: "#F8EFE0",
  success: "#5D8A5D",
  successLight: "#E8F0E8",
  danger: "#C0392B",
  dangerLight: "#FDE8E8",
  chipBg: "#E8D8C8",
  chipText: "#6B4A3A",
} as const;


// ── Helper: entity icon mapping ──

function EntityIcon({ type, size = 32 }: { type: string; size?: number }) {
  const cls = "shrink-0 flex items-center justify-center rounded-full";
  const style = { width: size, height: size, fontSize: size * 0.4 };

  if (type === "character") {
    return (
      <span className={`${cls} bg-[#F5E0E0] text-[#8B3A3A]`} style={style}>
        <User size={size * 0.5} />
      </span>
    );
  }
  if (type === "location") {
    return (
      <span className={`${cls} bg-[#F8EFE0] text-[#B8943A]`} style={style}>
        <MapPin size={size * 0.5} />
      </span>
    );
  }
  if (type === "institution") {
    return (
      <span className={`${cls} bg-[#E8E0F0] text-[#7A5A8B]`} style={style}>
        <Building size={size * 0.5} />
      </span>
    );
  }
  return (
    <span className={`${cls} bg-[#E0E8F0] text-[#3A6B8B]`} style={style}>
      <BookOpen size={size * 0.5} />
    </span>
  );
}


// ── Main Component ──

export default function ChapterWizard({ bookId, nav, theme, t }: ChapterWizardProps) {
  const c = useColors(theme);

  // ── State ──
  const [step, setStep] = useState(1);
  const [sceneText, setSceneText] = useState("");
  const [selectedEntities, setSelectedEntities] = useState<Set<string>>(new Set());
  const [length, setLength] = useState(1000);
  const [style, setStyle] = useState<GenerationStyle>("描述");
  const [freedom, setFreedom] = useState(false);
  const [paragraphs, setParagraphs] = useState<ParagraphItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [completed, setCompleted] = useState(false);

  // ── Fetch worlds ──
  const { data: worldsData } = useApi<{ worlds: WorldSummary[] }>(`/books/${bookId}/worlds`);

  // ── Derive entities from worlds ──
  const allEntities = useMemo<WorldEntity[]>(() => {
    if (!worldsData?.worlds) return [];
    // For now, we fetch worlds and present them as selectable entities.
    // In a full implementation, each world would expose its roles/regions/etc.
    const entities: WorldEntity[] = [];
    for (const w of worldsData.worlds) {
      // Add the world itself as a context entity
      entities.push({
        id: `world:${w.id}`,
        name: w.name,
        type: "setting",
        subType: "世界观",
        worldId: w.id,
        worldName: w.name,
      });
    }
    return entities;
  }, [worldsData]);

  // ── Toggle entity selection ──
  const toggleEntity = useCallback((entityId: string) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(entityId)) {
        next.delete(entityId);
      } else {
        next.add(entityId);
      }
      return next;
    });
  }, []);

  // ── Get selected entity objects ──
  const selectedEntityObjects = useMemo(
    () => allEntities.filter((e) => selectedEntities.has(e.id)),
    [allEntities, selectedEntities],
  );

  // ── Generate content (Step 3 → Step 4) ──
  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      // For now, simulate generation with placeholder paragraphs.
      // In production, this would call POST /api/worlds/:worldId/generate
      // with the sceneText, selectedEntities, and generation params.
      const mockParagraphs: ParagraphItem[] = [
        {
          id: 1,
          content: `正在根据场景描述"${sceneText || "（未填写）"}"生成章节内容……\n\n已引用 ${selectedEntityObjects.length} 个实体，风格倾向「${style}」，目标长度 ${length} 字。${freedom ? "（自由度开启）" : ""}`,
          status: "pending",
        },
        {
          id: 2,
          content: "这是生成的第二段示例内容。在实际集成中，AI 会根据场景描述和选中的世界实体生成完整的章节段落。",
          status: "pending",
        },
        {
          id: 3,
          content: "第三段示例内容。逐段审核流程允许对每段进行采纳、修改、重生成或跳过操作。",
          status: "pending",
        },
      ];
      setParagraphs(mockParagraphs);
      setStep(4);
    } finally {
      setGenerating(false);
    }
  }, [sceneText, selectedEntityObjects, style, length, freedom]);

  // ── Paragraph actions ──
  const handleApprove = useCallback((id: number) => {
    setParagraphs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "approved" as const } : p)),
    );
  }, []);

  const handleEdit = useCallback((id: number) => {
    setParagraphs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "editing" as const } : p)),
    );
  }, []);

  const handleSaveEdit = useCallback((id: number, newContent: string) => {
    setParagraphs((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, content: newContent, status: "approved" as const } : p,
      ),
    );
  }, []);

  const handleCancelEdit = useCallback((id: number) => {
    setParagraphs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "pending" as const } : p)),
    );
  }, []);

  const handleRegenerate = useCallback((id: number) => {
    setParagraphs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "regenerating" as const } : p)),
    );
    // Simulate regeneration delay
    setTimeout(() => {
      setParagraphs((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                content: `${p.content}\n\n（已重新生成，实际集成时由 AI 返回新内容）`,
                status: "pending" as const,
              }
            : p,
        ),
      );
    }, 1200);
  }, []);

  const handleSkip = useCallback((id: number) => {
    setParagraphs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "skipped" as const } : p)),
    );
  }, []);

  // ── Progress computation ──
  const visibleParagraphs = useMemo(
    () => paragraphs.filter((p) => p.status !== "skipped"),
    [paragraphs],
  );
  const reviewedCount = useMemo(
    () => visibleParagraphs.filter((p) => p.status === "approved").length,
    [visibleParagraphs],
  );
  const progressPct = visibleParagraphs.length > 0
    ? Math.round((reviewedCount / visibleParagraphs.length) * 100)
    : 0;
  const allReviewed = visibleParagraphs.length > 0 && reviewedCount === visibleParagraphs.length;

  // ── Finish chapter ──
  const handleFinish = useCallback(() => {
    setCompleted(true);
  }, []);

  // ── Selected count ──
  const selectedCount = selectedEntities.size;

  // ── Entity type label helper ──
  const entityTypeLabel = (type: string): string => {
    const map: Record<string, string> = {
      character: "角色",
      location: "地点",
      institution: "组织",
      event: "事件",
      setting: "世界观",
    };
    return map[type] ?? type;
  };

  // ── Render ──

  return (
    <div className="max-w-4xl mx-auto px-6 py-10" data-testid="chapter-wizard">
      {/* ── Header ── */}
      <div className="mb-8 pb-6 border-b border-border/60">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={nav.toDashboard}
            className={c.link}
          >
            ← 返回
          </button>
          <h1 className="font-serif text-[1.625rem] font-bold italic text-foreground tracking-[0.02em]">
            章节生成管道
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1 ml-9">
          世界设定 → 生成小说章节 · 逐段精审
        </p>
      </div>

      {/* ── Stepper ── */}
      <nav className="flex items-start mb-8" role="tablist" aria-label="生成步骤">
        {STEPS.map((s, i) => {
          const isActive = step === s.num;
          const isCompleted = step > s.num;
          return (
            <div
              key={s.num}
              className={`flex-1 flex flex-col items-center relative text-center ${
                isActive ? "step--active" : isCompleted ? "step--completed" : ""
              }`}
            >
              {/* Connecting line */}
              {i < STEPS.length - 1 && (
                <div
                  className={`absolute top-[18px] left-[calc(50%+22px)] w-[calc(100%-44px)] h-[2px] z-0 transition-colors duration-300 ${
                    isCompleted ? "bg-[#8B3A3A]" : step === s.num && !isCompleted
                      ? "bg-gradient-to-r from-[#8B3A3A] to-border"
                      : "bg-border"
                  }`}
                />
              )}
              {/* Circle */}
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold relative z-10 transition-all duration-300 ${
                  isCompleted
                    ? "bg-[#8B3A3A] text-white border-2 border-[#8B3A3A]"
                    : isActive
                      ? "bg-white text-[#8B3A3A] border-2 border-[#8B3A3A] shadow-[0_0_0_4px_#F5E0E0]"
                      : "bg-white text-[#A09888] border-2 border-border"
                }`}
              >
                {isCompleted ? (
                  <Check size={14} strokeWidth={3} />
                ) : (
                  <span>{s.num}</span>
                )}
              </div>
              {/* Label */}
              <span
                className={`text-xs mt-2 font-medium leading-tight max-w-[80px] transition-colors duration-300 ${
                  isCompleted
                    ? "text-[#8B3A3A]"
                    : isActive
                      ? "text-foreground font-semibold"
                      : "text-[#A09888]"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </nav>

      {/* ── Step Panels ── */}

      {/* ================================================================
           Step 1 — 场景描述
           ================================================================ */}
      {step === 1 && (
        <section data-testid="wizard-step-1" className="animate-[fadeIn_0.35s_ease]">
          <h2 className="font-serif text-xl font-bold text-foreground mb-2">描述剧情目标</h2>
          <p className="text-sm text-muted-foreground mb-6">
            写下本章要推进的剧情，并从右侧面板中选择需要引用的 World 实体。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left — Scene textarea */}
            <div className="flex flex-col">
              <label htmlFor="scene-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em] mb-2">
                剧情场景描述
              </label>
              <textarea
                id="scene-input"
                value={sceneText}
                onChange={(e) => setSceneText(e.target.value)}
                placeholder="描述本章节的核心剧情目标……"
                className="flex-1 min-h-[180px] p-4 border border-border rounded-lg text-[15px] leading-relaxed text-foreground bg-white resize-vertical focus:outline-none focus:border-[#8B3A3A] focus:shadow-[0_0_0_3px_#F5E0E0] transition-all"
              />
            </div>

            {/* Right — Entity selection */}
            <div className="flex flex-col">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.04em] mb-2">
                World 实体
              </label>
              <div className="flex-1 border border-border rounded-lg bg-white overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-[#FDF6F0] border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground">可选实体</span>
                  <span className="text-[11px] text-muted-foreground/60">
                    已选 {selectedCount}
                  </span>
                </div>
                {allEntities.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground/50 italic">
                    暂无关联的世界设定
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {allEntities.map((entity) => {
                      const isSelected = selectedEntities.has(entity.id);
                      return (
                        <label
                          key={entity.id}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-[#FDF6F0] ${
                            isSelected ? "bg-[#FDF6F0]/60" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEntity(entity.id)}
                            className="appearance-none w-[18px] h-[18px] border-2 border-border rounded shrink-0 cursor-pointer relative transition-all checked:bg-[#8B3A3A] checked:border-[#8B3A3A] checked:after:content-[''] checked:after:absolute checked:after:top-[2px] checked:after:left-[5px] checked:after:w-[4px] checked:after:h-[8px] checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white checked:after:rotate-45"
                          />
                          <EntityIcon type={entity.type} size={28} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                              {entity.name}
                            </div>
                            <div className="text-[11px] text-muted-foreground/60">
                              {entityTypeLabel(entity.type)}
                              {entity.subType ? ` · ${entity.subType}` : ""}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
            <div />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#8B3A3A] text-white rounded-md text-sm font-medium hover:bg-[#723030] transition-colors"
              >
                下一步：关联实体
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
           Step 2 — 关联实体
           ================================================================ */}
      {step === 2 && (
        <section data-testid="wizard-step-2" className="animate-[fadeIn_0.35s_ease]">
          <h2 className="font-serif text-xl font-bold text-foreground mb-2">确认关联实体</h2>
          <p className="text-sm text-muted-foreground mb-6">
            已选实体将作为本章的引用锚点。点击 <X size={12} className="inline text-[#C0392B]" /> 移除不需要的实体。
          </p>

          {/* Chips area */}
          <div className="border border-border rounded-lg bg-white">
            {selectedEntityObjects.length === 0 ? (
              <div className="flex items-center justify-center min-h-[100px] text-sm text-muted-foreground/50 italic">
                暂无选中的实体。请返回第一步选择需要引用的 World 实体。
              </div>
            ) : (
              <div className="flex flex-wrap gap-3 p-5 min-h-[100px] content-start">
                {selectedEntityObjects.map((entity) => (
                  <span
                    key={entity.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E8D8C8] text-[#6B4A3A] rounded-full text-xs font-medium transition-all hover:bg-[#DEC8B8]"
                  >
                    {entity.name}
                    <button
                      type="button"
                      onClick={() => toggleEntity(entity.id)}
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] hover:bg-black/10 transition-colors"
                      aria-label={`移除 ${entity.name}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Reference preview */}
          {selectedEntityObjects.length > 0 && (
            <div className="mt-5 p-5 bg-[#FDF6F0] rounded-lg border border-border">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.04em] mb-3">
                引用预览
              </div>
              <div className="font-serif text-base leading-relaxed text-foreground">
                本章即将引用：
                {selectedEntityObjects.map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && "、"}
                    <span className="inline px-1.5 py-0.5 bg-[#F5E0E0] text-[#8B3A3A] rounded text-xs font-medium">
                      {e.name}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
            <div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-transparent text-muted-foreground rounded-md text-sm font-medium hover:text-foreground transition-colors"
              >
                <ChevronLeft size={16} />
                返回场景描述
              </button>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={selectedEntityObjects.length === 0}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#8B3A3A] text-white rounded-md text-sm font-medium hover:bg-[#723030] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                下一步：生成参数
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
           Step 3 — 生成参数
           ================================================================ */}
      {step === 3 && (
        <section data-testid="wizard-step-3" className="animate-[fadeIn_0.35s_ease]">
          <h2 className="font-serif text-xl font-bold text-foreground mb-2">设定生成参数</h2>
          <p className="text-sm text-muted-foreground mb-6">
            配置章节生成的关键参数，AI 将据此生成符合预期的内容。
          </p>

          <div className="space-y-6">
            {/* Length Slider */}
            <div className="p-5 bg-white border border-border rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-semibold text-foreground">章节长度</span>
                <span className="text-sm font-serif font-semibold text-[#8B3A3A]">
                  {length.toLocaleString()} 字
                </span>
              </div>
              <div className="relative h-1.5">
                <input
                  type="range"
                  min={500}
                  max={5000}
                  step={100}
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  className="w-full h-1.5 rounded-full bg-border appearance-none cursor-pointer accent-[#8B3A3A] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#8B3A3A] [&::-webkit-slider-thumb]:border-3 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-[0_2px_4px_rgba(44,24,16,0.15)] [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                />
              </div>
              <div className="flex justify-between mt-2 text-[11px] text-muted-foreground/60">
                <span>500 字</span>
                <span>2,750 字</span>
                <span>5,000 字</span>
              </div>
            </div>

            {/* Style Tabs */}
            <div className="p-5 bg-white border border-border rounded-lg">
              <div className="mb-4">
                <span className="text-sm font-semibold text-foreground">风格倾向</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {STYLE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex flex-col items-center gap-1 p-4 border rounded-lg cursor-pointer transition-all text-center ${
                      style === opt.value
                        ? "border-[#8B3A3A] bg-[#F5E0E0]"
                        : "border-border bg-white hover:border-muted-foreground/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name="style"
                      value={opt.value}
                      checked={style === opt.value}
                      onChange={() => setStyle(opt.value)}
                      className="sr-only"
                    />
                    <span className="text-lg">{opt.icon}</span>
                    <span className="text-xs font-medium text-foreground">{opt.label}</span>
                    <span className="text-[11px] text-muted-foreground/60">{opt.desc}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Freedom Toggle */}
            <div className="p-5 bg-white border border-border rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-foreground">自由度开关</div>
                  <div className="text-[11px] text-muted-foreground/60 mt-0.5">
                    开启后 AI 可在不偏离大纲的前提下自由发挥细节
                  </div>
                </div>
                <label className="relative inline-block w-11 h-6 shrink-0">
                  <input
                    type="checkbox"
                    checked={freedom}
                    onChange={(e) => setFreedom(e.target.checked)}
                    className="opacity-0 w-0 h-0"
                  />
                  <span
                    className={`absolute inset-0 rounded-full cursor-pointer transition-colors duration-300 before:content-[''] before:absolute before:left-[3px] before:top-[3px] before:w-[18px] before:h-[18px] before:rounded-full before:bg-white before:transition-transform before:duration-300 before:shadow-[0_1px_3px_rgba(0,0,0,0.15)] ${
                      freedom ? "bg-[#8B3A3A] before:translate-x-5" : "bg-border"
                    }`}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
            <div>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-transparent text-muted-foreground rounded-md text-sm font-medium hover:text-foreground transition-colors"
              >
                <ChevronLeft size={16} />
                返回关联实体
              </button>
            </div>
            <div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#8B3A3A] text-white rounded-md text-sm font-medium hover:bg-[#723030] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    生成章节
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ================================================================
           Step 4 — 逐段审核
           ================================================================ */}
      {step === 4 && (
        <section data-testid="wizard-step-4" className="animate-[fadeIn_0.35s_ease]">
          <h2 className="font-serif text-xl font-bold text-foreground mb-2">逐段审核</h2>
          <p className="text-sm text-muted-foreground mb-6">
            逐段审查生成内容，确认无误后完成章节。
          </p>

          {completed ? (
            /* ── Completion area ── */
            <div className="text-center py-10 animate-[fadeIn_0.5s_ease]">
              <div className="w-16 h-16 rounded-full bg-[#E8F0E8] flex items-center justify-center mx-auto mb-5">
                <Check size={28} strokeWidth={2.5} className="text-[#5D8A5D]" />
              </div>
              <h3 className="font-serif text-[1.375rem] font-bold text-foreground mb-3">
                章节已完成
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                本章已完成审核，共收录 {reviewedCount} 段内容。
              </p>
              <button
                type="button"
                onClick={nav.toBook.bind(null, bookId)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#8B3A3A] text-white rounded-md text-sm font-medium hover:bg-[#723030] transition-colors"
              >
                <BookOpen size={16} />
                返回书籍
              </button>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="flex items-center gap-3 mb-6 text-xs text-muted-foreground">
                <span>已审核 {reviewedCount} / {visibleParagraphs.length} 段</span>
                <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#5D8A5D] rounded-full transition-all duration-400"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* Paragraph Cards */}
              <div className="space-y-4">
                {paragraphs.filter((p) => p.status !== "skipped").map((para) => {
                  const isEditing = para.status === "editing";
                  const isApproved = para.status === "approved";
                  const isRegenerating = para.status === "regenerating";

                  return (
                    <div
                      key={para.id}
                      className={`bg-white border border-border rounded-xl p-5 transition-all duration-300 ${
                        isApproved
                          ? "border-l-4 border-l-[#5D8A5D]"
                          : isRegenerating
                            ? "border-l-4 border-l-[#D4A855] opacity-70"
                            : ""
                      }`}
                    >
                      {/* Header */}
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-[0.04em]">
                          段落 {para.id}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            isApproved
                              ? "bg-[#E8F0E8] text-[#5D8A5D]"
                              : isRegenerating
                                ? "bg-[#F5E0E0] text-[#8B3A3A]"
                                : isEditing
                                  ? "bg-[#F8EFE0] text-[#B8943A]"
                                  : "bg-[#FDF6F0] text-muted-foreground/60"
                          }`}
                        >
                          {isApproved
                            ? "已采纳"
                            : isRegenerating
                              ? "重生成中…"
                              : isEditing
                                ? "编辑中"
                                : "待审核"}
                        </span>
                      </div>

                      {/* Content or Edit area */}
                      {isEditing ? (
                        <div className="mb-4">
                          <textarea
                            defaultValue={para.content}
                            id={`edit-text-${para.id}`}
                            className="w-full min-h-[100px] p-3 border border-[#D4A855] rounded-md text-[15px] leading-relaxed text-foreground bg-white resize-vertical focus:outline-none focus:shadow-[0_0_0_3px_#F8EFE0]"
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById(`edit-text-${para.id}`) as HTMLTextAreaElement | null;
                                if (el) handleSaveEdit(para.id, el.value);
                              }}
                              className="px-3 py-1 text-[11px] font-medium rounded-md bg-[#5D8A5D] text-white hover:bg-[#4E7A4E] transition-colors"
                            >
                              保存修改
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelEdit(para.id)}
                              className="px-3 py-1 text-[11px] font-medium rounded-md bg-transparent text-muted-foreground hover:text-foreground transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[15px] leading-relaxed text-foreground mb-4 whitespace-pre-wrap">
                          {para.content}
                        </div>
                      )}

                      {/* Actions (hidden during edit) */}
                      {!isEditing && (
                        <div className="flex gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleApprove(para.id)}
                            disabled={isApproved}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              isApproved
                                ? "opacity-35 cursor-not-allowed pointer-events-none"
                                : "bg-[#E8F0E8] text-[#5D8A5D] hover:bg-[#DAEADA]"
                            }`}
                          >
                            <Check size={12} className="inline mr-1" />
                            采纳
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(para.id)}
                            disabled={isRegenerating}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              isRegenerating
                                ? "opacity-35 cursor-not-allowed pointer-events-none"
                                : "bg-[#F8EFE0] text-[#B8943A] hover:bg-[#F0E4D0]"
                            }`}
                          >
                            <Edit3 size={12} className="inline mr-1" />
                            修改
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRegenerate(para.id)}
                            disabled={isRegenerating}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              isRegenerating
                                ? "opacity-35 cursor-not-allowed pointer-events-none"
                                : "bg-[#F5E0E0] text-[#8B3A3A] hover:bg-[#EDD0D0]"
                            }`}
                          >
                            <RefreshCw size={12} className="inline mr-1" />
                            重生成
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSkip(para.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#FDF6F0] text-muted-foreground/60 hover:bg-border hover:text-muted-foreground transition-colors"
                          >
                            <SkipForward size={12} className="inline mr-1" />
                            跳过
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Citation Bar */}
              {selectedEntityObjects.length > 0 && (
                <div className="mt-6 p-4 bg-[#FDF6F0] border border-border rounded-lg">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.04em] mb-2">
                    本章引用了
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedEntityObjects.map((entity) => (
                      <span
                        key={entity.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-full border ${
                          entity.type === "character"
                            ? "border-[#F5E0E0] text-[#8B3A3A]"
                            : entity.type === "location"
                              ? "border-[#F8EFE0] text-[#B8943A]"
                              : "border-border text-muted-foreground"
                        }`}
                      >
                        {entity.type === "character" && <User size={10} className="text-[#8B3A3A]" />}
                        {entity.type === "location" && <MapPin size={10} className="text-[#B8943A]" />}
                        {entity.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-border">
                <div>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-transparent text-muted-foreground rounded-md text-sm font-medium hover:text-foreground transition-colors"
                  >
                    <ChevronLeft size={16} />
                    返回生成参数
                  </button>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleFinish}
                    disabled={!allReviewed}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#5D8A5D] text-white rounded-md text-sm font-medium hover:bg-[#4E7A4E] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check size={16} />
                    完成章节
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
