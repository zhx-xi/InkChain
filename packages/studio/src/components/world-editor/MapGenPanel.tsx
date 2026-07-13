// ── Map AI Generation Panel (Issue #269 — P3-2) ──
// UI component for AI-assisted map region generation, review, and import.

import { useState, type ReactNode } from "react";
import { useMapAIGen } from "../../hooks/use-map-ai-gen";
import type { MapRegionCandidate } from "@inkchain/inkchain-core";
import { Sparkles, Check, X, Loader2, Globe, Upload, Edit3, Map, RefreshCw } from "lucide-react";

// ── Types ──

interface MapGenPanelProps {
  readonly worldId: string;
  readonly worldName: string;
  readonly onSaved?: () => void;
}

// ── Color map for region types ──

const TYPE_COLORS: Record<string, string> = {
  "大陆": "#34D399",
  "国家": "#60A5FA",
  "城市": "#FBBF24",
  "地点": "#A78BFA",
};

const TYPE_ORDER: Record<string, number> = {
  "大陆": 0,
  "国家": 1,
  "城市": 2,
  "地点": 3,
};

// ── Mini Map Preview ──

function MiniMapPreview({
  regions,
  editable,
  onUpdate,
}: {
  regions: MapRegionCandidate[];
  editable?: boolean;
  onUpdate?: (index: number, patch: Partial<MapRegionCandidate>) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);

  const handleMouseDown = (index: number) => {
    if (!editable) return;
    setDragging(index);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragging === null || !onUpdate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    onUpdate(dragging, { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  return (
    <div
      className="relative w-full aspect-square bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 rounded-xl overflow-hidden border border-border/40 select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Grid lines */}
      <div className="absolute inset-0 opacity-10">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={`h${i}`} className="absolute left-0 right-0 h-px bg-white" style={{ top: `${i * 10}%` }} />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={`v${i}`} className="absolute top-0 bottom-0 w-px bg-white" style={{ left: `${i * 10}%` }} />
        ))}
      </div>

      {/* Region markers */}
      {regions.map((region, idx) => (
        <div
          key={idx}
          className="absolute flex flex-col items-center cursor-grab active:cursor-grabbing transition-transform hover:z-10"
          style={{
            left: `${region.x}%`,
            top: `${region.y}%`,
            transform: "translate(-50%, -50%)",
          }}
          onMouseDown={() => handleMouseDown(idx)}
        >
          <div
            className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
            style={{ backgroundColor: TYPE_COLORS[region.type] ?? "#94A3B8" }}
          />
          <span className="text-[10px] text-white font-medium mt-0.5 whitespace-nowrap bg-black/40 px-1 rounded">
            {region.name}
          </span>
          <span className="text-[8px] text-white/60 whitespace-nowrap">
            ({region.x}, {region.y})
          </span>
        </div>
      ))}

      {/* Empty state */}
      {regions.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white/30">
            <Map size={48} className="mx-auto mb-2" />
            <p className="text-sm">暂无区域数据</p>
            <p className="text-xs mt-1">点击「AI 生成」或上传地图图片</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Region Edit Row ──

function RegionEditRow({
  region,
  index,
  onChange,
  onRemove,
}: {
  region: MapRegionCandidate;
  index: number;
  onChange: (patch: Partial<MapRegionCandidate>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-border/40 bg-secondary/10">
      <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">#{index + 1}</span>
      <input
        value={region.name}
        onChange={(e) => onChange({ name: e.target.value })}
        className="flex-1 min-w-0 rounded-md border border-border/40 bg-background px-2 py-1 text-xs"
        placeholder="名称"
      />
      <select
        value={region.type}
        onChange={(e) => onChange({ type: e.target.value as MapRegionCandidate["type"] })}
        className="rounded-md border border-border/40 bg-background px-1 py-1 text-xs"
      >
        <option value="大陆">大陆</option>
        <option value="国家">国家</option>
        <option value="城市">城市</option>
        <option value="地点">地点</option>
      </select>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <input
          type="number"
          min={0}
          max={100}
          value={region.x}
          onChange={(e) => onChange({ x: clampCoord(e.target.value) })}
          className="w-10 rounded border border-border/40 bg-background px-1 py-0.5 text-center"
        />
        <span>,</span>
        <input
          type="number"
          min={0}
          max={100}
          value={region.y}
          onChange={(e) => onChange({ y: clampCoord(e.target.value) })}
          className="w-10 rounded border border-border/40 bg-background px-1 py-0.5 text-center"
        />
      </div>
      <button onClick={onRemove} className="text-muted-foreground/40 hover:text-destructive shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

function clampCoord(value: string): number {
  const n = parseInt(value, 10);
  if (isNaN(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

// ── Sort regions by type hierarchy ──

function sortRegions(regions: MapRegionCandidate[]): MapRegionCandidate[] {
  return [...regions].sort((a, b) => {
    const typeDiff = (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99);
    if (typeDiff !== 0) return typeDiff;
    // Same type: parents first (those who are referenced as parentName)
    const isParentOfB = regions.some((r) => r.parentName === a.name);
    const isParentOfA = regions.some((r) => r.parentName === b.name);
    if (isParentOfB && !isParentOfA) return -1;
    if (isParentOfA && !isParentOfB) return 1;
    return a.name.localeCompare(b.name);
  });
}

// ── Main Component ──

export function MapGenPanel({ worldId, worldName, onSaved }: MapGenPanelProps) {
  const { candidates, loading, error, saved, generate, confirm, analyzeImage, reset } = useMapAIGen(worldId);
  const [editableRegions, setEditableRegions] = useState<MapRegionCandidate[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [showImageImport, setShowImageImport] = useState(false);
  const [imageDescription, setImageDescription] = useState("");

  const handleGenerate = async () => {
    if (loading) return;
    setShowReview(false);
    setShowImageImport(false);
    const result = await generate();
    if (result?.candidates) {
      setEditableRegions(sortRegions([...result.candidates]));
      setShowReview(true);
    }
  };

  const handleImageAnalyze = async () => {
    if (loading || !imageDescription.trim()) return;
    setShowReview(false);
    const result = await analyzeImage(imageDescription.trim());
    if (result?.candidates) {
      setEditableRegions(sortRegions([...result.candidates]));
      setShowReview(true);
    }
  };

  const handleRegionUpdate = (index: number, patch: Partial<MapRegionCandidate>) => {
    setEditableRegions((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  };

  const handleRegionRemove = (index: number) => {
    setEditableRegions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddRegion = () => {
    setEditableRegions((prev) => [
      ...prev,
      { name: "新区域", type: "地点", parentName: null, description: "", x: 50, y: 50 },
    ]);
  };

  const handleConfirm = async () => {
    if (loading || editableRegions.length === 0) return;
    const result = await confirm(editableRegions);
    if (result) {
      onSaved?.();
    }
  };

  const handleReset = () => {
    reset();
    setEditableRegions([]);
    setShowReview(false);
    setShowImageImport(false);
    setImageDescription("");
  };

  const sortedRegions = sortRegions(editableRegions);

  return (
    <div className="space-y-4 pt-[72px]">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Globe size={16} className="text-primary" />
        <span className="font-medium">地图 AI 生成 — {worldName}</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /><span>生成中...</span></>
          ) : (
            <><Sparkles size={16} /><span>AI 生成</span></>
          )}
        </button>
        <button
          onClick={() => { setShowImageImport(!showImageImport); setShowReview(false); }}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 border border-border/40 rounded-xl text-sm text-muted-foreground hover:bg-secondary/30 transition-colors disabled:opacity-50"
        >
          <Upload size={16} />
          <span>导入图片</span>
        </button>
      </div>

      {/* Image import section */}
      {showImageImport && (
        <div className="border border-border/40 rounded-xl p-4 space-y-3 bg-secondary/10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Edit3 size={14} />
            <span>描述地图图片内容，AI 将识别区域</span>
          </div>
          <textarea
            value={imageDescription}
            onChange={(e) => setImageDescription(e.target.value)}
            placeholder="粘贴图片描述或标注文本，例如：北方大陆是冰雪之地，南方王国以沙漠为主，中部有繁荣的贸易城市..."
            className="w-full rounded-lg border border-border/40 bg-background px-3 py-2 text-xs min-h-[80px]"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowImageImport(false)}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              取消
            </button>
            <button
              onClick={handleImageAnalyze}
              disabled={loading || !imageDescription.trim()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              识别区域
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 rounded-xl p-3 text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Saved confirmation */}
      {saved && !editableRegions.length && (
        <div className="border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 rounded-xl p-4 text-center">
          <Check size={24} className="mx-auto text-green-600 mb-2" />
          <p className="text-sm font-medium text-green-700 dark:text-green-300">区域已保存到世界观</p>
          <button onClick={handleReset} className="mt-2 text-xs text-muted-foreground hover:text-foreground underline">
            继续生成
          </button>
        </div>
      )}

      {/* Review interface */}
      {showReview && editableRegions.length > 0 && (
        <div className="space-y-4">
          {/* Mini map preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-muted-foreground">地图预览</h3>
              <span className="text-xs text-muted-foreground/60">
                {editableRegions.length} 个区域 · 可拖动标记调整位置
              </span>
            </div>
            <MiniMapPreview
              regions={editableRegions}
              editable
              onUpdate={handleRegionUpdate}
            />
          </div>

          {/* Region list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-muted-foreground">区域列表</h3>
              <div className="flex gap-2">
                <span className="text-xs text-muted-foreground/60">
                  共 {editableRegions.length} 个区域
                </span>
              </div>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {sortedRegions.map((region, idx) => (
                <RegionEditRow
                  key={idx}
                  region={region}
                  index={idx}
                  onChange={(patch) => handleRegionUpdate(idx, patch)}
                  onRemove={() => handleRegionRemove(idx)}
                />
              ))}
            </div>
            <button
              onClick={handleAddRegion}
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              + 添加区域
            </button>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span>{type}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <button
              onClick={handleReset}
              disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw size={14} />
              重新生成
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || editableRegions.length === 0}
              className="flex items-center gap-1 px-4 py-2 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              确认保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
