import { useState, useCallback, useEffect, useMemo } from "react";
import { fetchJson } from "../hooks/use-api";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { useColors } from "../hooks/use-colors";
import { BarChart3, RotateCcw, Eye, EyeOff, RefreshCw } from "lucide-react";

// ── Types ──

interface StyleConsistencyDimension {
  readonly name: string;
  readonly label: string;
  readonly score: number;
  readonly status: "ok" | "warn" | "good";
  readonly note: string;
}

interface StyleAnomaly {
  readonly index: number;
  readonly tag: "length" | "modifier" | "dialogue";
  readonly tagLabel: string;
  readonly paragraphIndex: number;
  readonly description: string;
  readonly quote: string;
  readonly detail: string;
  readonly diffPercent: string;
  readonly ignored: boolean;
}

interface StyleConsistencyResult {
  readonly score: number;
  readonly dimensions: readonly StyleConsistencyDimension[];
  readonly anomalies: readonly StyleAnomaly[];
  readonly baselineLabel: string;
  readonly targetLabel: string;
  readonly sensitivity: number;
}

interface Nav { toDashboard: () => void }

// ── Helpers ──

const SENSITIVITY_LABELS = [
  { label: "低", threshold: "0.25", anomalies: 2 },
  { label: "中", threshold: "0.15", anomalies: 3 },
  { label: "高", threshold: "0.08", anomalies: 4 },
];

const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // ≈ 326.7

function gaugeColor(score: number): string {
  if (score >= 85) return "#5d8a5d";
  if (score >= 70) return "#d4a743";
  return "#c4514a";
}

/** Build stroke-dasharray for the ring gauge: drawn length + remaining gap. */
function ringDashArray(score: number): string {
  const drawn = (score / 100) * RING_CIRCUMFERENCE;
  const gap = RING_CIRCUMFERENCE - drawn;
  return `${drawn.toFixed(1)} ${gap.toFixed(1)}`;
}

// ── Mock data fallback ──

function generateMockData(sensitivity: number): StyleConsistencyResult {
  const scoreMap: Record<number, number> = { 0: 85, 1: 78, 2: 65 };
  const score = scoreMap[sensitivity] ?? 78;

  const dimensions: StyleConsistencyDimension[] = [
    { name: "vocabulary", label: "词汇分布", score: 88, status: "ok", note: "高频词重叠率 · 与基线匹配" },
    { name: "sentence-length", label: "句式长度", score: sensitivity === 2 ? 55 : sensitivity === 1 ? 65 : 72, status: "warn", note: "短句频次偏高 · 与基线差异 +23%" },
    { name: "dialogue-ratio", label: "对话比例", score: 92, status: "ok", note: "对话/叙述比例 · 与基线一致" },
    { name: "modifier-density", label: "修饰语密度", score: sensitivity === 2 ? 40 : sensitivity === 1 ? 55 : 68, status: "warn", note: "修饰语密度 0.12 vs 基线 0.08 · 偏高 50%" },
  ];

  const diffBase: Record<number, string> = { 0: "+18%", 1: "+31%", 2: "+45%" };
  const anomalies: StyleAnomaly[] = [
    { index: 0, tag: "length", tagLabel: "句式过长", paragraphIndex: 3, description: "连续短句偏离基线节奏模式。", quote: "他走了进去。看了看四周。没人。等了很久。", detail: "连续短句（4句/17字）偏离基线节奏模式。", diffPercent: diffBase[sensitivity] ?? "+31%", ignored: false },
    { index: 1, tag: "modifier", tagLabel: "修饰语偏高", paragraphIndex: 5, description: "全段修饰语密度 0.12 vs 基线 0.08", quote: "幽暗的、模糊不清的、近乎窒息的寂静", detail: '全段修饰语密度 0.12 vs 基线 0.08 · "幽暗的、模糊不清的、近乎窒息的寂静"——三连叠修饰在基线的克制风格中极少出现。', diffPercent: "+50%", ignored: false },
  ];

  if (sensitivity >= 1) {
    anomalies.push({ index: 2, tag: "dialogue", tagLabel: "对话比例异常", paragraphIndex: 8, description: "对话占比 65% vs 基线 35%", quote: "", detail: "对话占比 65% vs 基线 35% · 该段以密集对话推进情节，而基线此阶段以叙述描写为主。", diffPercent: "+86%", ignored: sensitivity === 1 });
  }

  return { score, dimensions, anomalies: anomalies as StyleAnomaly[], baselineLabel: "第1–10章 · 共32,450字", targetLabel: "第11章", sensitivity };
}

// ── Sub-components ──

function RingGauge({ score, baselineLabel, targetLabel }: { score: number; baselineLabel: string; targetLabel: string }) {
  const color = gaugeColor(score);

  return (
    <div className="flex flex-col items-center mb-2">
      <div className="relative w-[220px] h-[220px] mx-auto">
        <svg viewBox="0 0 120 120" className="w-full h-full" aria-label={`文风一致性评分 ${score}%`}>
          <defs>
            <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#d4a855" />
              <stop offset="100%" stopColor="#8b3a3a" />
            </linearGradient>
          </defs>
          {/* Background ring */}
          <circle cx="60" cy="60" r="52" fill="none" stroke="#ece6de" strokeWidth="8" strokeLinecap="round" />
          {/* Score arc */}
          <circle
            cx="60" cy="60" r="52"
            fill="none"
            stroke="url(#gauge-gradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={ringDashArray(score)}
            transform="rotate(-90 60 60)"
            style={{ transition: "stroke-dasharray 1s cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-serif text-[52px] font-bold leading-none tracking-tight" style={{ color }}>{score}</span>
          <span className="text-xs text-muted-foreground mt-1">/ 100 · 一致性</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-1 font-mono tracking-wide">
        基线：<span className="inline-block bg-muted/50 border border-border/60 px-2.5 py-0.5 rounded-sm">{baselineLabel}</span>
        <span className="ml-1.5">当前检测：{targetLabel}</span>
      </div>
    </div>
  );
}

function DimensionBar({ dim }: { dim: StyleConsistencyDimension }) {
  const barColor = dim.status === "ok" ? "bg-emerald-500" : dim.status === "warn" ? "bg-amber-500" : "bg-amber-600";
  const valueColor = dim.status === "ok" ? "text-emerald-600" : "text-amber-600";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center text-[13px]">
        <span className="text-muted-foreground font-medium">{dim.label}</span>
        <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded-sm bg-muted/50 ${valueColor}`}>{dim.score}%</span>
      </div>
      <div className="w-full h-1.5 bg-muted/70 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
          style={{ width: `${dim.score}%` }}
        />
      </div>
      <div className="text-[11px] text-muted-foreground">{dim.note}</div>
    </div>
  );
}

function AnomalyItem({ anomaly, onToggleIgnore }: { anomaly: StyleAnomaly; onToggleIgnore: (index: number) => void }) {
  const tagColors: Record<string, string> = {
    length: "bg-rose-500/10 text-rose-600",
    modifier: "bg-amber-500/12 text-amber-600",
    dialogue: "bg-emerald-500/10 text-emerald-600",
  };

  return (
    <div className={`border-l-[3px] rounded-r-lg p-4 transition-all duration-300 ${
      anomaly.ignored
        ? "opacity-35 line-through bg-muted/30 border-l-muted-foreground/30"
        : "bg-amber-50/70 border-l-amber-500"
    }`}>
      <div className={`inline-flex items-center text-[11px] font-semibold font-mono px-2 py-0.5 rounded-sm mb-2 ${tagColors[anomaly.tag] ?? "bg-muted text-muted-foreground"}`}>
        {anomaly.tagLabel}
      </div>
      <div className="text-[13px] text-muted-foreground leading-relaxed mb-2">
        §第{anomaly.paragraphIndex}段 · {anomaly.quote && <span className="bg-muted/70 px-1.5 py-0.5 rounded-sm text-foreground">{anomaly.quote}</span>}
        {anomaly.quote && <br />}
        <span className="text-rose-600 font-medium">{anomaly.detail}</span>
      </div>
      <div className="flex gap-2 items-center">
        <button
          onClick={() => onToggleIgnore(anomaly.index)}
          className={`text-xs px-3 py-1 rounded-sm border transition-all duration-200 font-body ${
            anomaly.ignored
              ? "border-emerald-500 text-emerald-600 bg-emerald-500/8"
              : "border-border text-muted-foreground hover:border-amber-600 hover:text-amber-600 hover:bg-amber-50"
          }`}
        >
          {anomaly.ignored ? "已忽略" : "忽略本次"}
        </button>
        <span className="text-[11px] text-muted-foreground font-mono">
          {anomaly.ignored ? "已忽略 · " : ""}差异度 {anomaly.diffPercent}
        </span>
      </div>
    </div>
  );
}

function SensitivitySlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-6 flex-wrap">
      <span className="text-[13px] text-muted-foreground font-medium whitespace-nowrap">灵敏度阈值：</span>
      <div className="flex-1 min-w-[200px] flex items-center gap-4">
        <div className="flex-1 relative h-7 flex items-center">
          <input
            type="range"
            min={0}
            max={2}
            step={1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full h-1 bg-muted/70 rounded-full appearance-none cursor-pointer
              accent-amber-600
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-card
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-amber-600
              [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-sm
              [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-card [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-amber-600
              [&::-moz-range-thumb]:cursor-pointer"
          />
          <div className="flex justify-between w-full absolute top-full mt-1 px-px">
            {SENSITIVITY_LABELS.map((s, i) => (
              <span
                key={s.label}
                className={`text-[10px] font-mono transition-colors duration-200 ${i === value ? "text-amber-600 font-semibold" : "text-muted-foreground/60"}`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <span className="text-[13px] font-semibold text-amber-600 font-mono min-w-[2rem] text-center">
          {SENSITIVITY_LABELS[value].label}
        </span>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          阈值 {SENSITIVITY_LABELS[value].threshold}
        </span>
      </div>
    </div>
  );
}

// ── Main Component ──

export function ConsistencyPanel({ nav, theme, t }: { nav: Nav; theme: Theme; t: TFunction }) {
  const c = useColors(theme);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StyleConsistencyResult | null>(null);
  const [sensitivity, setSensitivity] = useState(1);
  const [error, setError] = useState("");

  // Track locally-ignored anomalies (independent of API)
  const [ignoredSet, setIgnoredSet] = useState<Set<number>>(new Set());

  // Reset ignored set when sensitivity changes or a new analysis runs
  useEffect(() => {
    setIgnoredSet(new Set());
  }, [result?.sensitivity]);

  // ── Analysis ──

  const runAnalysis = useCallback(async (sens: number) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<{ result: StyleConsistencyResult }>("/api/style-consistency/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sensitivity: sens }),
      });
      setResult(data.result);
    } catch {
      // Fall back to mock data if API call fails
      setResult(generateMockData(sens));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void runAnalysis(sensitivity);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAnalyze = () => {
    void runAnalysis(sensitivity);
  };

  const handleSensitivityChange = (newVal: number) => {
    setSensitivity(newVal);
    void runAnalysis(newVal);
  };

  const handleToggleIgnore = (index: number) => {
    setIgnoredSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleResetAll = () => {
    setIgnoredSet(new Set());
  };

  // Merge API anomaly data with local ignored state
  const anomalies = useMemo(() => {
    if (!result) return [];
    return result.anomalies.map((a) => ({
      ...a,
      ignored: ignoredSet.has(a.index) || a.ignored,
    }));
  }, [result, ignoredSet]);

  const activeAnomalyCount = anomalies.filter((a) => !a.ignored).length;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={nav.toDashboard} className={c.link}>首页</button>
        <span className="text-border">/</span>
        <span>文风检测</span>
        <span className="text-border">/</span>
        <span className="text-foreground">文风统一检测</span>
      </div>

      {/* Page Title */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-700 flex items-center justify-center text-card font-serif font-bold text-sm flex-shrink-0">
            墨
          </div>
          <div>
            <h1 className="font-serif text-2xl text-foreground">文风统一检测</h1>
            <p className="text-xs text-muted-foreground font-mono tracking-wide">Style Consistency Analyzer</p>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground leading-relaxed">
          <span className="inline-block bg-amber-50 text-amber-700 border border-amber-200/50 px-2.5 py-0.5 rounded-sm font-mono text-[11px] mb-1">
            v3.0 R-20
          </span>
          {result && <div>{result.baselineLabel}</div>}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
          <RefreshCw size={16} className="animate-spin" />
          分析中…
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="px-4 py-3 rounded-lg text-sm bg-destructive/10 text-destructive">
          {error}
        </div>
      )}

      {/* No data yet (before first analysis) */}
      {!loading && !result && !error && (
        <div className="border border-dashed rounded-lg p-8 text-center text-muted-foreground text-sm italic">
          点击「分析」按钮开始文风统一检测。
        </div>
      )}

      {result && !loading && (
        <>
          {/* ═══ 1. Ring Gauge ═══ */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm p-6 hover:shadow-md transition-shadow">
            <h2 className="font-serif text-base text-foreground mb-4 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5.5 h-5.5 rounded-full bg-amber-600 text-card text-[11px] font-mono font-bold">1</span>
              整体文风一致性评分
            </h2>
            <div className="text-center">
              <RingGauge score={result.score} baselineLabel={result.baselineLabel} targetLabel={result.targetLabel} />
            </div>
          </div>

          {/* ═══ 2. Dimension Bars ═══ */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm p-6 hover:shadow-md transition-shadow">
            <h2 className="font-serif text-base text-foreground mb-4 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5.5 h-5.5 rounded-full bg-amber-600 text-card text-[11px] font-mono font-bold">2</span>
              维度一致性分析
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.dimensions.map((dim) => (
                <DimensionBar key={dim.name} dim={dim} />
              ))}
            </div>
          </div>

          {/* ═══ 3. Anomaly List ═══ */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm p-6 hover:shadow-md transition-shadow">
            <h2 className="font-serif text-base text-foreground mb-4 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5.5 h-5.5 rounded-full bg-amber-600 text-card text-[11px] font-mono font-bold">3</span>
              异常段落
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 ml-2">
                {activeAnomalyCount} 处异常
              </span>
            </h2>
            <div className="flex flex-col gap-4">
              {anomalies.length === 0 && (
                <div className="text-sm text-muted-foreground italic text-center py-4">
                  未发现异常段落。
                </div>
              )}
              {anomalies.map((anomaly) => (
                <AnomalyItem
                  key={anomaly.index}
                  anomaly={anomaly}
                  onToggleIgnore={handleToggleIgnore}
                />
              ))}
            </div>
          </div>

          {/* ═══ 4. Sensitivity Slider ═══ */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm p-6 hover:shadow-md transition-shadow">
            <h2 className="font-serif text-base text-foreground mb-4 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5.5 h-5.5 rounded-full bg-amber-600 text-card text-[11px] font-mono font-bold">4</span>
              检测灵敏度
            </h2>
            <SensitivitySlider value={sensitivity} onChange={handleSensitivityChange} />
          </div>

          {/* ═══ Footer ═══ */}
          <footer className="flex items-center justify-between flex-wrap gap-4 pt-4 border-t border-border/60 text-xs text-muted-foreground">
            <span>InkChain v3.0 · 文风统一检测模块 · R-20</span>
            <div className="flex gap-3">
              <button
                onClick={handleResetAll}
                className="text-xs px-4 py-1.5 rounded-sm border border-border bg-card text-muted-foreground hover:border-amber-600 hover:text-amber-600 transition-all duration-200"
              >
                恢复全部忽略
              </button>
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="text-xs px-4 py-1.5 rounded-sm bg-amber-600 text-card border border-amber-600 hover:bg-amber-700 transition-all duration-200 disabled:opacity-50"
              >
                {loading ? "分析中…" : "重新检测"}
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
