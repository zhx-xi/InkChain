import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useApi } from "../hooks/use-api";
import type { WorldConfig, WorldRegion } from "@actalk/inkchain-core";
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw, X, MapPin, Users, Calendar } from "lucide-react";
import { cn } from "../lib/utils";

// ── Types ──

interface Nav {
  toWorlds: () => void;
  toWorldDetail: (id: string) => void;
}

interface WorldMapProps {
  readonly worldId: string;
  readonly nav?: Nav;
}

// Color palette for region types — InkChain warm-tone palette
const REGION_COLORS: Record<string, string> = {
  "大陆": "#D4A855",
  "国家": "#8B3A3A",
  "城市": "#5D8A5D",
  "地点": "#4A8FD4",
};

const REGION_TYPE_LABELS: Record<string, string> = {
  continent: "大陆",
  country: "国家",
  city: "城市",
  location: "地点",
};

// ── SVG icon generators (inline) ──

const EventIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="5" cy="5" r="3" />
  </svg>
);

const CharacterIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
    <circle cx="5" cy="2.5" r="1.8" />
    <path d="M1.5 9c0-2.5 1.5-4 3.5-4s3.5 1.5 3.5 4" />
  </svg>
);

// ── Helpers ──

/** Build a tree of regions from flat list. Root = regions with no parentId. */
function buildRegionTree(regions: WorldRegion[]): WorldRegion[] {
  return regions.filter((r) => !r.parentId);
}

/** Get children of a region */
function getChildren(regions: WorldRegion[], parentId: string): WorldRegion[] {
  return regions.filter((r) => r.parentId === parentId);
}

/** Get region type label (fallback chain) */
function getRegionTypeLabel(r: WorldRegion): string {
  return r.type || REGION_TYPE_LABELS[r.regionType ?? ""] || "区域";
}

// ── Main Component ──

export function WorldMapPage({ worldId, nav }: WorldMapProps) {
  const { data: world, loading, error } = useApi<WorldConfig>(`/api/worlds/${encodeURIComponent(worldId)}`);

  // Navigation state: stack of [regionId | null] where null = root level
  const [drillStack, setDrillStack] = useState<(string | null)[]>([null]);
  const [selectedNode, setSelectedNode] = useState<WorldRegion | null>(null);
  const [zoom, setZoom] = useState(1);
  const mapRef = useRef<HTMLDivElement>(null);

  const currentParentId = drillStack[drillStack.length - 1] ?? null;

  // Compute visible nodes (regions at current level)
  const visibleNodes = useMemo(() => {
    if (!world?.regions) return [];
    if (currentParentId === null) {
      return buildRegionTree(world.regions);
    }
    return getChildren(world.regions, currentParentId);
  }, [world, currentParentId]);

  // Compute breadcrumb trail
  const breadcrumbTrail = useMemo(() => {
    if (!world?.regions) return [{ id: null, name: "世界" }];
    const items: { id: string | null; name: string }[] = [{ id: null, name: "世界" }];
    for (let i = 1; i < drillStack.length; i++) {
      const regionId = drillStack[i];
      if (!regionId) break;
      const region = world.regions.find((r) => r.id === regionId);
      if (region) {
        items.push({ id: region.id, name: region.name });
      }
    }
    return items;
  }, [world, drillStack]);

  // Navigate to a level
  const navigateTo = useCallback((targetId: string | null) => {
    let idx = breadcrumbTrail.findIndex((b) => b.id === targetId);
    if (idx === -1) idx = 0;
    setDrillStack((prev) => {
      // null is at index 0; we go to idx+1 in the stack
      const targetDepth = idx + 1;
      if (targetDepth < prev.length) {
        return prev.slice(0, targetDepth);
      }
      return prev;
    });
    setSelectedNode(null);
    setZoom(1);
  }, [breadcrumbTrail]);

  // Drill down to a region
  const drillDown = useCallback((region: WorldRegion) => {
    setDrillStack((prev) => [...prev, region.id]);
    setSelectedNode(null);
    setZoom(1);
  }, []);

  // Select a location node (leaf)
  const selectNode = useCallback((node: WorldRegion) => {
    setSelectedNode(node);
  }, []);

  // Close detail panel
  const closeDetail = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Zoom handlers
  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.2, 2.0)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.2, 0.5)), []);
  const handleZoomReset = useCallback(() => setZoom(1), []);

  // Assign positions to nodes (auto-layout if no coordinates)
  const positionedNodes = useMemo(() => {
    const count = visibleNodes.length;
    return visibleNodes.map((node, i) => {
      if (node.coordinates?.x != null && node.coordinates?.y != null) {
        return { ...node, displayX: node.coordinates.x, displayY: node.coordinates.y };
      }
      // Auto-layout in a grid if no coordinates
      const cols = Math.ceil(Math.sqrt(count));
      const row = Math.floor(i / cols);
      const col = i % cols;
      return { ...node, displayX: 120 + col * 160, displayY: 60 + row * 140 };
    });
  }, [visibleNodes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeDetail();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeDetail]);

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive p-6">
        <div className="text-center space-y-2">
          <p className="text-sm font-medium">加载世界数据失败</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading || !world) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const isRootLevel = currentParentId === null;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#FDF6F0]">
      {/* ── Header ── */}
      <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-[#E8E0D8] shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => nav?.toWorldDetail(worldId)}
            className="flex items-center gap-1.5 text-sm text-[#7A6A5A] hover:text-[#2C1810] transition-colors"
          >
            <ArrowLeft size={16} />
            <span>{world.name}</span>
          </button>
        </div>
        <span className="text-[11px] text-[#A09888] bg-[#FDF6F0] px-2 py-0.5 rounded border border-[#E8E0D8]">
          交互式地图
        </span>
      </header>

      {/* ── Breadcrumb ── */}
      <nav className="flex items-center h-10 px-6 bg-white border-b border-[#E8E0D8] gap-1.5 shrink-0">
        {breadcrumbTrail.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[#A09888] text-xs">›</span>}
            <button
              type="button"
              onClick={() => navigateTo(item.id)}
              className={cn(
                "text-[13px] px-1.5 py-0.5 rounded transition-colors",
                i === breadcrumbTrail.length - 1
                  ? "text-[#2C1810] font-semibold cursor-default"
                  : "text-[#7A6A5A] hover:text-[#8B3A3A] hover:bg-[#F5E0E0]"
              )}
            >
              {item.name}
            </button>
          </span>
        ))}
      </nav>

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between h-11 px-6 bg-white border-b border-[#E8E0D8] shrink-0 z-15">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleZoomIn}
            className="flex items-center justify-center w-8 h-8 rounded border border-[#E8E0D8] bg-white text-[#7A6A5A] hover:text-[#8B3A3A] hover:border-[#8B3A3A] transition-all"
            title="放大"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="flex items-center justify-center w-8 h-8 rounded border border-[#E8E0D8] bg-white text-[#7A6A5A] hover:text-[#8B3A3A] hover:border-[#8B3A3A] transition-all"
            title="缩小"
          >
            <ZoomOut size={16} />
          </button>
          <button
            type="button"
            onClick={handleZoomReset}
            className="flex items-center justify-center w-8 h-8 rounded border border-[#E8E0D8] bg-white text-[#7A6A5A] hover:text-[#8B3A3A] hover:border-[#8B3A3A] transition-all"
            title="重置视图"
          >
            <RotateCcw size={16} />
          </button>
          <div className="w-px h-5 bg-[#DDD5CC] mx-1" />
          <span className="text-xs text-[#A09888] select-none">
            {isRootLevel ? `大陆视图 · ${visibleNodes.length} 个区域` : `${breadcrumbTrail[breadcrumbTrail.length - 1]?.name} · ${visibleNodes.length} 个地点`}
          </span>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Map Area */}
        <div
          ref={mapRef}
          className="flex-1 relative overflow-hidden"
          style={{
            background: `
              radial-gradient(ellipse at 25% 35%, rgba(212, 168, 85, 0.07) 0%, transparent 55%),
              radial-gradient(ellipse at 70% 65%, rgba(139, 58, 58, 0.04) 0%, transparent 50%),
              linear-gradient(180deg, #FDF6F0 0%, #F8F0E8 100%)
            `,
          }}
        >
          {/* Map content container */}
          <div
            className="absolute"
            style={{
              top: "50%",
              left: "50%",
              transform: `translate(-50%, -50%) scale(${zoom})`,
              transition: "transform 0.35s ease",
            }}
          >
            {/* SVG connection lines */}
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{ width: positionedNodes.length > 0 ? 860 : 0, height: positionedNodes.length > 0 ? 500 : 0 }}
              viewBox={positionedNodes.length > 0 ? "0 0 860 500" : "0 0 0 0"}
            >
              {positionedNodes.length >= 2 && (
                <>
                  {/* Draw connections between adjacent nodes (simple star or grid pattern) */}
                  {positionedNodes.map((a, i) =>
                    positionedNodes.slice(i + 1).map((b, j) => {
                      const dist = Math.sqrt(
                        Math.pow((a.displayX ?? 0) - (b.displayX ?? 0), 2) +
                        Math.pow((a.displayY ?? 0) - (b.displayY ?? 0), 2)
                      );
                      // Only draw connections for nearby nodes (within 250px)
                      if (dist > 250) return null;
                      // Only first few neighbors to avoid clutter
                      if (j > 2) return null;
                      const isKnown = dist < 150;
                      return (
                        <line
                          key={`${a.id}-${b.id}`}
                          x1={a.displayX}
                          y1={a.displayY}
                          x2={b.displayX}
                          y2={b.displayY}
                          stroke={isKnown ? "#D4A855" : "#A09888"}
                          strokeWidth={isKnown ? 2 : 1.5}
                          strokeDasharray={isKnown ? "none" : "6 4"}
                          opacity={isKnown ? 0.6 : 0.4}
                        />
                      );
                    })
                  )}
                </>
              )}
            </svg>

            {/* Node cards */}
            <div className="relative" style={{ width: 860, height: 500 }}>
              {positionedNodes.map((node, idx) => {
                const typeLabel = getRegionTypeLabel(node);
                const isLeaf = getChildren(world.regions, node.id).length === 0;
                const typeColor = REGION_COLORS[typeLabel] || "#7A6A5A";
                const hasEvents = false; // Not in the data model yet
                const hasCharacters = false; // Not in the data model yet

                return (
                  <div
                    key={node.id}
                    className="absolute"
                    style={{
                      left: node.displayX,
                      top: node.displayY,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => (isLeaf || !isRootLevel ? selectNode(node) : drillDown(node))}
                      className={cn(
                        "group flex flex-col items-center bg-white rounded-xl border-2 shadow-sm transition-all duration-150",
                        "hover:shadow-md hover:-translate-y-0.5 overflow-hidden cursor-pointer",
                      )}
                      style={{
                        minWidth: isLeaf ? 100 : 120,
                        borderColor: "#E8E0D8",
                      }}
                    >
                      {/* Color indicator bar */}
                      <div
                        className="w-full h-[6px] shrink-0"
                        style={{ backgroundColor: typeColor }}
                      />
                      <div className="px-3.5 py-2 text-center">
                        <div className="font-serif font-semibold text-sm text-[#2C1810] leading-tight whitespace-nowrap">
                          {node.name}
                        </div>
                        <div className="text-[11px] text-[#A09888] mt-0.5">
                          {typeLabel}
                          {!isLeaf && (isRootLevel || currentParentId !== node.id) && (
                            <span className="ml-1 text-[#8B3A3A]">→</span>
                          )}
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Empty state */}
          {positionedNodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <MapPin size={32} className="mx-auto text-[#A09888]" />
                <p className="text-sm text-[#7A6A5A]">该世界暂无地理区域数据</p>
                <p className="text-xs text-[#A09888]">
                  在"世界设定"中为 regions 添加坐标即可在地图上显示
                </p>
              </div>
            </div>
          )}

          {/* Compass rose */}
          <svg className="absolute bottom-6 left-6 w-9 h-9 pointer-events-none opacity-35" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="16" fill="none" stroke="#DDD5CC" strokeWidth="0.8" />
            <polygon points="18,2 20,16 18,14 16,16" fill="#DDD5CC" />
            <polygon points="18,34 20,20 18,22 16,20" fill="#E8E0D8" />
            <polygon points="2,18 16,20 14,18 16,16" fill="#E8E0D8" />
            <polygon points="34,18 20,20 22,18 20,16" fill="#E8E0D8" />
            <text x="18" y="7" textAnchor="middle" fontSize="5" fill="#A09888" fontFamily="Georgia,serif">北</text>
          </svg>
        </div>

        {/* ── Detail Panel ── */}
        <aside
          className={cn(
            "w-[340px] bg-white border-l border-[#E8E0D8] shadow-[-4px_0_24px_rgba(44,24,16,0.1)] flex flex-col overflow-hidden transition-transform duration-300",
            selectedNode ? "translate-x-0" : "translate-x-full absolute right-0 top-0 bottom-0"
          )}
        >
          {selectedNode ? (
            <>
              {/* Detail header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDD5CC] shrink-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[12px] text-[#A09888] uppercase tracking-wider">
                    {getRegionTypeLabel(selectedNode)}
                  </span>
                  <h2 className="font-serif text-xl font-semibold text-[#2C1810]">
                    {selectedNode.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="flex items-center justify-center w-7 h-7 rounded border border-[#E8E0D8] text-[#7A6A5A] hover:text-[#8B3A3A] hover:border-[#8B3A3A] transition-all"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Detail body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* Description */}
                {selectedNode.description && (
                  <div>
                    <h3 className="font-serif text-[13px] font-semibold text-[#2C1810] mb-2 pb-1 border-b border-[#DDD5CC]">
                      描述
                    </h3>
                    <p className="text-sm text-[#7A6A5A] leading-relaxed">
                      {selectedNode.description}
                    </p>
                  </div>
                )}

                {/* Types info */}
                <div>
                  <h3 className="font-serif text-[13px] font-semibold text-[#2C1810] mb-2 pb-1 border-b border-[#DDD5CC]">
                    类型
                  </h3>
                  <div className="flex gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${REGION_COLORS[getRegionTypeLabel(selectedNode)] || "#7A6A5A"}15`,
                        color: REGION_COLORS[getRegionTypeLabel(selectedNode)] || "#7A6A5A",
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: REGION_COLORS[getRegionTypeLabel(selectedNode)] || "#7A6A5A" }}
                      />
                      {getRegionTypeLabel(selectedNode)}
                    </span>
                  </div>
                </div>

                {/* Parent region */}
                {selectedNode.parentId && world.regions && (
                  <div>
                    <h3 className="font-serif text-[13px] font-semibold text-[#2C1810] mb-2 pb-1 border-b border-[#DDD5CC]">
                      所属区域
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        const parent = world.regions?.find((r) => r.id === selectedNode.parentId);
                        if (parent) {
                          // Navigate up to parent level
                          const parentIdx = drillStack.indexOf(parent.id);
                          if (parentIdx >= 0) {
                            setDrillStack((prev) => prev.slice(0, parentIdx + 1));
                            setZoom(1);
                          } else {
                            // Go to root then drill
                            setDrillStack([null, parent.id]);
                            setZoom(1);
                          }
                          setSelectedNode(null);
                        }
                      }}
                      className="text-sm text-[#8B3A3A] hover:text-[#723030] transition-colors"
                    >
                      ← {world.regions.find((r) => r.id === selectedNode.parentId)?.name || "上级区域"}
                    </button>
                  </div>
                )}

                {/* Coordinates */}
                {selectedNode.coordinates && (
                  <div>
                    <h3 className="font-serif text-[13px] font-semibold text-[#2C1810] mb-2 pb-1 border-b border-[#DDD5CC]">
                      坐标
                    </h3>
                    <p className="text-sm text-[#A09888]">
                      x: {selectedNode.coordinates.x}, y: {selectedNode.coordinates.y}
                    </p>
                  </div>
                )}

                {/* Jump to world detail */}
                <div>
                  <a
                    href={`#/worlds/${encodeURIComponent(worldId)}`}
                    className="inline-flex items-center gap-1.5 text-sm text-[#8B3A3A] px-3 py-2 rounded border border-[#F5E0E0] hover:bg-[#F5E0E0] transition-colors"
                  >
                    <ArrowLeft size={14} />
                    查看完整设定
                  </a>
                </div>
              </div>

              {/* ── Character / Event from data model (Future) ── */}
              {/* The data model doesn't have direct character/event refs on regions yet.
                  This section is reserved for future use when e.g. WorldRole gets regionId or
                  WorldHistoryEvent gets a location field. */}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full px-10 text-center">
              <MapPin size={48} className="text-[#E8E0D8] mb-4" />
              <p className="text-sm text-[#A09888] leading-relaxed">
                点击地图上的节点<br />
                查看区域详情
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
