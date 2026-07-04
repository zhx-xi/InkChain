// ── World Map View (Issue #269 — P3-2) ──
// Interactive 2D map view showing regions with coordinates and event markers.

import { useState, useMemo, useCallback } from "react";
import { useApi } from "../hooks/use-api";
import { MapGenPanel } from "../components/world-editor/MapGenPanel";
import type { WorldConfig, WorldRegion, WorldHistoryEvent } from "@actalk/inkos-core";
import { ArrowLeft, Globe, Map, Sparkles, X, Circle } from "lucide-react";

// ── Types ──

interface WorldMapViewProps {
  readonly worldId: string;
  readonly nav?: {
    toWorldDetail: (worldId: string) => void;
  };
}

// ── Type colors ──

const TYPE_COLORS: Record<string, string> = {
  "大陆": "#34D399",
  "国家": "#60A5FA",
  "城市": "#FBBF24",
  "地点": "#A78BFA",
};

// ── Event marker colors by significance ──

function eventColor(significance: number): string {
  if (significance >= 4) return "#EF4444";
  if (significance >= 3) return "#F59E0B";
  return "#94A3B8";
}

// ── Main Component ──

export function WorldMapViewPanel({ worldId, nav }: WorldMapViewProps) {
  const { data, loading, error, refetch } = useApi<{ world: WorldConfig }>(
    `/api/worlds/${encodeURIComponent(worldId)}`
  );

  const [showAIGen, setShowAIGen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<WorldRegion | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<WorldHistoryEvent | null>(null);
  const [showEvents, setShowEvents] = useState(true);

  const world = data?.world;
  const regions = world?.regions ?? [];
  const events = world?.history ?? [];

  // Build region name map
  const regionNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of regions) map.set(r.id, r.name);
    return map;
  }, [regions]);

  // Filter regions that have coordinates
  const mappedRegions = useMemo(
    () => regions.filter((r) => r.x != null && r.y != null),
    [regions],
  );

  // Find events associated with each region
  const eventsByRegion = useMemo(() => {
    const map = new Map<string, WorldHistoryEvent[]>();
    for (const event of events) {
      for (const regionId of event.affectedRegions) {
        const list = map.get(regionId) ?? [];
        list.push(event);
        map.set(regionId, list);
      }
    }
    return map;
  }, [events]);

  const handleSaved = useCallback(() => {
    refetch();
    setShowAIGen(false);
  }, [refetch]);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="max-w-md text-center space-y-3 p-6">
          <Globe className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">无法加载世界数据</p>
          <p className="text-xs text-destructive/70">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => nav?.toWorldDetail(worldId)}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            返回
          </button>
          <h2 className="text-base font-semibold">
            {world?.name ?? "世界"} — 交互地图
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEvents(!showEvents)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors ${
              showEvents
                ? "border-primary/30 bg-primary/5 text-primary"
                : "border-border/40 text-muted-foreground hover:bg-secondary/50"
            }`}
          >
            <Circle size={12} />
            事件标记
          </button>
          <button
            type="button"
            onClick={() => setShowAIGen(!showAIGen)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Sparkles size={14} />
            AI 生成区域
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map area */}
        <div className="flex-1 relative">
          {/* Map canvas */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700">
            {/* Grid */}
            <div className="absolute inset-0 opacity-[0.08]">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={`h${i}`}
                  className="absolute left-0 right-0 h-px bg-white"
                  style={{ top: `${i * 5}%` }}
                />
              ))}
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={`v${i}`}
                  className="absolute top-0 bottom-0 w-px bg-white"
                  style={{ left: `${i * 5}%` }}
                />
              ))}
            </div>

            {/* Region markers */}
            {mappedRegions.map((region) => (
              <div
                key={region.id}
                className="absolute flex flex-col items-center transition-transform hover:z-20 cursor-pointer group"
                style={{
                  left: `${region.x!}%`,
                  top: `${region.y!}%`,
                  transform: "translate(-50%, -50%)",
                }}
                onClick={() => {
                  setSelectedRegion(region);
                  setSelectedEvent(null);
                }}
              >
                <div
                  className="w-6 h-6 rounded-full border-2 border-white shadow-lg group-hover:scale-125 transition-transform"
                  style={{
                    backgroundColor: TYPE_COLORS[region.type] ?? "#94A3B8",
                  }}
                />
                <span className="text-[11px] text-white font-medium mt-1 whitespace-nowrap bg-black/50 px-1.5 py-0.5 rounded">
                  {region.name}
                </span>
                <span className="text-[9px] text-white/50 whitespace-nowrap">
                  {region.type}
                </span>

                {/* Event indicators */}
                {showEvents && eventsByRegion.has(region.id) && (
                  <div className="flex gap-0.5 mt-0.5">
                    {eventsByRegion.get(region.id)!.slice(0, 3).map((evt) => (
                      <div
                        key={evt.id}
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: eventColor(evt.significance) }}
                        title={evt.title}
                      />
                    ))}
                    {(eventsByRegion.get(region.id)!.length > 3) && (
                      <span className="text-[8px] text-white/60">+{eventsByRegion.get(region.id)!.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Empty state */}
            {mappedRegions.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white/30 max-w-sm">
                  <Map size={64} className="mx-auto mb-3 opacity-50" />
                  <p className="text-base font-medium mb-1">暂无坐标区域</p>
                  <p className="text-sm">
                    请先在详情页添加地理区域的坐标信息，
                    <br />
                    或使用「AI 生成区域」自动创建。
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Region detail panel */}
          {selectedRegion && (
            <div className="absolute top-4 right-4 w-72 bg-card/95 backdrop-blur-sm rounded-lg border border-border/40 p-4 shadow-md z-30 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">{selectedRegion.name}</h4>
                <button
                  type="button"
                  onClick={() => setSelectedRegion(null)}
                  className="text-muted-foreground/40 hover:text-muted-foreground"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[selectedRegion.type] ?? "#94A3B8" }}
                  />
                  <span className="font-medium">{selectedRegion.type}</span>
                </div>
                {selectedRegion.parentId && (
                  <div>
                    <span className="text-muted-foreground/60">所属: </span>
                    <span className="font-medium">
                      {regionNameMap.get(selectedRegion.parentId) ?? "未知"}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground/60">坐标: </span>
                  <span className="font-mono">({selectedRegion.x}, {selectedRegion.y})</span>
                </div>
                {selectedRegion.description && (
                  <div>
                    <span className="text-muted-foreground/60 block mb-0.5">描述:</span>
                    <p className="text-muted-foreground/80 leading-relaxed">{selectedRegion.description}</p>
                  </div>
                )}

                {/* Associated events */}
                {showEvents && eventsByRegion.has(selectedRegion.id) && (
                  <div className="mt-3 pt-3 border-t border-border/40">
                    <span className="text-muted-foreground/60 block mb-1.5 text-[10px] font-medium uppercase tracking-wider">
                      关联事件 ({eventsByRegion.get(selectedRegion.id)!.length})
                    </span>
                    <div className="space-y-1.5">
                      {eventsByRegion.get(selectedRegion.id)!.map((evt) => (
                        <button
                          key={evt.id}
                          type="button"
                          onClick={() => {
                            setSelectedEvent(evt);
                          }}
                          className="w-full text-left p-2 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition-colors"
                        >
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: eventColor(evt.significance) }}
                            />
                            <span className="text-xs font-medium truncate">{evt.title}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground/60">{evt.timestamp}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Event detail panel */}
          {selectedEvent && !selectedRegion && (
            <div className="absolute top-4 right-4 w-72 bg-card/95 backdrop-blur-sm rounded-lg border border-border/40 p-4 shadow-md z-30">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">{selectedEvent.title}</h4>
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="text-muted-foreground/40 hover:text-muted-foreground"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground/60">时间: </span>
                  <span className="font-medium">{selectedEvent.timestamp}</span>
                </div>
                <div>
                  <span className="text-muted-foreground/60">重要性: </span>
                  <span className="font-medium">{selectedEvent.significance}/5</span>
                </div>
                {selectedEvent.description && (
                  <div>
                    <span className="text-muted-foreground/60 block mb-0.5">描述:</span>
                    <p className="text-muted-foreground/80 leading-relaxed">{selectedEvent.description}</p>
                  </div>
                )}
                {selectedEvent.affectedRegions.length > 0 && (
                  <div>
                    <span className="text-muted-foreground/60 block mb-0.5">影响区域:</span>
                    <div className="flex flex-wrap gap-1">
                      {selectedEvent.affectedRegions.map((rid) => (
                        <span key={rid} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/5 text-[10px]">
                          {regionNameMap.get(rid) ?? rid}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm rounded-lg border border-border/40 p-3 shadow-sm text-xs space-y-1.5 z-10">
            <div className="font-medium text-muted-foreground mb-1.5">区域类型</div>
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span>{type}</span>
              </div>
            ))}
            {showEvents && (
              <>
                <div className="border-t border-border/40 my-1.5" />
                <div className="font-medium text-muted-foreground mb-1">事件重要性</div>
                {[4, 3, 2].map((sig) => (
                  <div key={sig} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: eventColor(sig) }} />
                    <span>{sig >= 4 ? "重大" : sig >= 3 ? "重要" : "普通"}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Stats */}
          <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg border border-border/40 px-3 py-2 shadow-sm text-[10px] text-muted-foreground/60 z-10">
            {mappedRegions.length} 个区域 · {events.length} 个事件
          </div>
        </div>

        {/* AI Generation sidebar */}
        {showAIGen && (
          <div className="w-96 border-l border-border/40 overflow-y-auto p-4 bg-card/50">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">AI 生成区域</h3>
              <button
                type="button"
                onClick={() => setShowAIGen(false)}
                className="text-muted-foreground/40 hover:text-muted-foreground"
              >
                <X size={14} />
              </button>
            </div>
            <MapGenPanel
              worldId={worldId}
              worldName={world?.name ?? "世界"}
              onSaved={handleSaved}
            />
          </div>
        )}
      </div>
    </div>
  );
}
