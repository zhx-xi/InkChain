// ── World AI Generation Panel (Issue #102 — P3-1) ──
// UI component for AI-assisted generation of world-building content.

import { useState, type ReactNode } from "react";
import { useWorldAIGen, DEFAULT_GENERATE_PARAMS } from "../hooks/use-world-ai-gen";
import type { GenerateType } from "../hooks/use-world-ai-gen";
import type { ChapterCandidate, CharacterCandidate, EventCandidate } from "@inkchain/inkchain-core";
import { Sparkles, Check, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

// ── Types ──

interface GenPanelProps {
  readonly worldId: string;
  readonly worldName: string;
}

interface TabOption {
  readonly type: GenerateType;
  readonly label: string;
  readonly icon: string;
}

const TABS: readonly TabOption[] = [
  { type: "chapter", label: "生成章节", icon: "📝" },
  { type: "character", label: "生成角色", icon: "👤" },
  { type: "event", label: "生成事件", icon: "📅" },
];

const DIMENSION_LABELS: Record<string, string> = {
  settings: "世界观设定",
  roles: "角色",
  relations: "关系",
  regions: "地理区域",
  institutions: "组织势力",
  history: "历史事件",
  rules: "世界规则",
};

// ── Slider Component ──

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-primary">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-secondary/40 rounded-full appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

// ── Main Component ──

export function WorldGenPanel({ worldId, worldName }: GenPanelProps) {
  const [activeTab, setActiveTab] = useState<GenerateType>("chapter");
  const [params, setParams] = useState(DEFAULT_GENERATE_PARAMS);
  const [styleInput, setStyleInput] = useState("");
  const [selectedDims, setSelectedDims] = useState<Set<string>>(
    new Set(DEFAULT_GENERATE_PARAMS.referenceDimensions),
  );
  const [showParams, setShowParams] = useState(false);
  const [reviewItems, setReviewItems] = useState<Record<string, unknown>[] | null>(null);

  const { candidates, loading, error, generate, confirm, reset } = useWorldAIGen(worldId);

  const handleGenerate = async () => {
    if (loading) return;

    const dims = selectedDims.size > 0
      ? Array.from(selectedDims)
      : DEFAULT_GENERATE_PARAMS.referenceDimensions;

    await generate(activeTab, {
      ...params,
      style: styleInput,
      referenceDimensions: dims,
    });
    setReviewItems(null);
  };

  const handleConfirm = async () => {
    if (!candidates || loading) return;

    const items = candidates.map((c) => {
      if (activeTab === "chapter") {
        const ch = c as ChapterCandidate;
        return { title: ch.title, content: ch.content, suggestedChapterNumber: ch.suggestedChapterNumber } as Record<string, unknown>;
      }
      if (activeTab === "character") {
        const ch = c as CharacterCandidate;
        return { name: ch.name, role: ch.role, description: ch.description, significance: ch.significance, traits: ch.traits } as Record<string, unknown>;
      }
      const ev = c as EventCandidate;
      return { title: ev.title, timestamp: ev.timestamp, description: ev.description, significance: ev.significance, affectedRegions: ev.affectedRegions } as Record<string, unknown>;
    });

    const result = await confirm(activeTab, items);
    if (result) {
      setReviewItems(items);
      reset();
    }
  };

  const toggleDimension = (dim: string) => {
    setSelectedDims((prev) => {
      const next = new Set(prev);
      if (next.has(dim)) next.delete(dim);
      else next.add(dim);
      return next;
    });
  };

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles size={16} className="text-primary" />
        <span className="font-medium">AI 生成 — {worldName}</span>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 bg-secondary/20 rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab.type}
            onClick={() => { setActiveTab(tab.type); reset(); setReviewItems(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.type
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Parameters toggle */}
      <button
        onClick={() => setShowParams(!showParams)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {showParams ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <span>{showParams ? "收起参数" : "展开参数"}</span>
      </button>

      {/* Parameters panel */}
      {showParams && (
        <div className="border border-border/40 rounded-xl p-4 space-y-3 bg-secondary/10">
          <Slider
            label="创意度"
            value={params.creativity}
            min={1}
            max={10}
            onChange={(v) => setParams((p) => ({ ...p, creativity: v }))}
          />
          <Slider
            label="目标长度"
            value={params.length / 1000}
            min={1}
            max={10}
            onChange={(v) => setParams((p) => ({ ...p, length: v * 1000 }))}
          />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">风格（可选）</label>
            <input
              type="text"
              value={styleInput}
              onChange={(e) => setStyleInput(e.target.value)}
              placeholder="如：悬疑、热血、细腻描写..."
              className="w-full px-3 py-1.5 text-xs bg-background border border-border/40 rounded-lg focus:outline-none focus:border-primary/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">参考维度</label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleDimension(key)}
                  className={`px-2 py-1 text-xs rounded-full transition-colors ${
                    selectedDims.has(key)
                      ? "bg-primary/15 text-primary border border-primary/20"
                      : "bg-secondary/20 text-muted-foreground border border-border/30 hover:border-border/60"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>生成中...</span>
          </>
        ) : (
          <>
            <Sparkles size={16} />
            <span>{activeTab === "chapter" ? "生成章节" : activeTab === "character" ? "生成角色" : "生成事件"}</span>
          </>
        )}
      </button>

      {/* Error display */}
      {error && (
        <div className="border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 rounded-xl p-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Candidate results */}
      {candidates && candidates.length > 0 && !reviewItems && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              共 {candidates.length} 个候选结果
            </p>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Check size={14} />
              <span>确认全部</span>
            </button>
          </div>

          {candidates.map((item, idx) => (
            <CandidateCard
              key={idx}
              index={idx}
              type={activeTab}
              data={item}
            />
          ))}
        </div>
      )}

      {/* Confirmed message */}
      {reviewItems && (
        <div className="border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 rounded-xl p-4 text-center">
          <Check size={24} className="mx-auto text-green-600 mb-2" />
          <p className="text-sm font-medium text-green-700 dark:text-green-300">
            {activeTab === "character"
              ? `${reviewItems.length} 个角色已保存到世界观`
              : activeTab === "event"
              ? `${reviewItems.length} 个事件已保存到世界观`
              : `${reviewItems.length} 个章节候选已记录`}
          </p>
          <button
            onClick={() => { reset(); setReviewItems(null); }}
            className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
          >
            继续生成
          </button>
        </div>
      )}
    </div>
  );
}

// ── Candidate Card ──

function CandidateCard({
  index,
  type,
  data,
}: {
  index: number;
  type: GenerateType;
  data: ChapterCandidate | CharacterCandidate | EventCandidate;
}): ReactNode {
  const [expanded, setExpanded] = useState(false);

  const headerText = (() => {
    if (type === "chapter") {
      const ch = data as ChapterCandidate;
      return ch.title;
    }
    if (type === "character") {
      const ch = data as CharacterCandidate;
      return `${ch.name}（${ch.role}）`;
    }
    const ev = data as EventCandidate;
    return ev.title;
  })();

  const previewText = (() => {
    if (type === "chapter") {
      const ch = data as ChapterCandidate;
      return ch.content.slice(0, expanded ? undefined : 200);
    }
    if (type === "character") {
      const ch = data as CharacterCandidate;
      return expanded
        ? `${ch.description}\n\n特质: ${ch.traits.join("、")}\n\n重要性: ${ch.significance}/5`
        : ch.description.slice(0, 200);
    }
    const ev = data as EventCandidate;
    return expanded
      ? `${ev.description}\n\n时间: ${ev.timestamp}\n\n影响区域: ${ev.affectedRegions.join("、") || "无"}\n\n重要性: ${ev.significance}/5`
      : ev.description.slice(0, 200);
  })();

  const hasMore = (() => {
    if (type === "chapter") return (data as ChapterCandidate).content.length > 200;
    if (type === "character") return (data as CharacterCandidate).description.length > 200;
    return (data as EventCandidate).description.length > 200;
  })();

  return (
    <div className="border border-border/40 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-secondary/20 hover:bg-secondary/40 transition-colors text-left"
      >
        <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
        <span className="text-sm font-medium flex-1 truncate">{headerText}</span>
        {hasMore && (
          <span className="text-xs text-muted-foreground">
            {expanded ? "收起" : "展开"}
          </span>
        )}
      </button>
      <div className="px-4 py-2.5 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {previewText}
        {!expanded && hasMore && (
          <span className="text-muted-foreground/40">...</span>
        )}
      </div>
    </div>
  );
}
