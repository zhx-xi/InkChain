/**
 * WorldInheritancePage — 选择性 World 继承页面
 *
 * 原型参考: deliverables/prototypes/v3.0/inkos-v3-02-world-inheritance.html
 * 允许用户从源 World 中选择性继承实体（按维度分类），
 * 并在遇到命名冲突时提供 覆盖/保留本地/重命名继承 三种处理方式。
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { ArrowLeft, Globe, AlertTriangle, Check, Minus, ChevronRight, Loader2, BookOpen } from "lucide-react";
import { cn } from "../lib/utils";
import { useApi, postApi } from "../hooks/use-api";
import { useHashRoute } from "../hooks/use-hash-route";
import type { WorldConfig } from "@inkchain/inkchain-core";

// ── 维度元信息 ──

interface DimensionMeta {
  label: string;
  icon: string;
  color: string;
  key: string; // WorldConfig 字段名
}

const DIMENSIONS: DimensionMeta[] = [
  { label: "世界观设定", icon: "🌍", color: "#4A90D9", key: "settings" },
  { label: "地理区域", icon: "🗺️", color: "#E88D3A", key: "regions" },
  { label: "角色", icon: "👥", color: "#22C55E", key: "roles" },
  { label: "组织势力", icon: "⚔️", color: "#EC4899", key: "institutions" },
  { label: "世界关系", icon: "🔗", color: "#8B5CF6", key: "relations" },
  { label: "历史事件", icon: "📅", color: "#F59E0B", key: "history" },
  { label: "世界规则", icon: "📜", color: "#EF4444", key: "rules" },
];

/** 获取实体的显示名称 */
function getEntityName(dimKey: string, entity: Record<string, unknown>): string {
  if (dimKey === "history") return String(entity.title ?? entity.name ?? "");
  if (dimKey === "relations") return String(entity.type ?? entity.name ?? "");
  return String(entity.name ?? "");
}

/** 获取实体的描述 */
function getEntityDesc(dimKey: string, entity: Record<string, unknown>): string {
  return String(entity.description ?? "");
}

/** 检查名称是否冲突 — 简单起见对比 name/title 字段 */
function hasNameConflict(
  entities: Record<string, unknown[]>,
  dimKey: string,
  name: string,
): boolean {
  if (!name) return false;
  const existing = entities[dimKey] ?? [];
  return existing.some((e) => {
    const en = e as Record<string, unknown>;
    const enName = dimKey === "history" ? String(en.title ?? "") : String(en.name ?? "");
    return enName.toLowerCase() === name.toLowerCase();
  });
}

// ── Tree Node Types ──

interface TreeNode {
  id: string;
  name: string;
  icon?: string;
  count?: number;
  children?: TreeNode[];
  /** 是否继承自源 World */
  isInherited?: boolean;
  /** 原始实体（叶子节点） */
  entity?: Record<string, unknown>;
  /** 实体所属维度 key */
  dimensionKey?: string;
}

// ── Conflict Types ──

type ConflictResolution = "overwrite" | "keep" | "rename" | null;

interface ConflictInfo {
  entityId: string;
  entityName: string;
  dimensionKey: string;
  resolution: ConflictResolution;
}

// ── 角色子分类配置 ──

const ROLE_SUBCATEGORIES = [
  { id: "主角", label: "主角", icon: "⭐" },
  { id: "配角", label: "配角", icon: "🔹" },
  { id: "反派", label: "反派", icon: "💀" },
  { id: "中立", label: "中立", icon: "⚖️" },
];

// ── 主组件 ──

export function WorldInheritancePage({ worldId }: { worldId: string }) {
  const { setRoute } = useHashRoute();

  // ── 数据加载 ──
  const { data: sourceData, loading, error } = useApi<{ world: WorldConfig }>(
    `/api/worlds/${encodeURIComponent(worldId)}`,
  );
  const sourceWorld = sourceData?.world;

  // ── 选择状态: Set<"dimKey:entityId"> ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // ── 展开状态: Set<nodeId> ──
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["roles"]));
  // ── 冲突状态 ──
  const [conflicts, setConflicts] = useState<Map<string, ConflictInfo>>(new Map());
  // ── 冲突弹窗 ──
  const [activeConflict, setActiveConflict] = useState<ConflictInfo | null>(null);
  // ── 确认中 ──
  const [confirming, setConfirming] = useState(false);

  // ── 构建树节点 ──

  const treeData = useMemo<TreeNode[]>(() => {
    if (!sourceWorld) return [];
    const world = sourceWorld as unknown as Record<string, unknown[]>;
    // 收集已有的实体名（用于冲突检测）
    // 由于这是新建 project，本地没有数据，所以冲突检测以维度内重名为准
    // 实际场景中应从本地 world 获取

    return DIMENSIONS.map((dim) => {
      const entities = world[dim.key] as Record<string, unknown>[] | undefined;
      if (!entities || entities.length === 0) {
        return {
          id: dim.key,
          name: dim.label,
          icon: dim.icon,
          count: 0,
          children: [],
          isInherited: false,
        };
      }

      // 特殊处理角色维度：按角色分类分组
      if (dim.key === "roles") {
        const children = ROLE_SUBCATEGORIES.map((sub) => {
          const subEntities = entities.filter(
            (e) => String(e.role ?? "") === sub.id,
          );
          return {
            id: `roles:${sub.id}`,
            name: sub.label,
            icon: sub.icon,
            count: subEntities.length,
            dimensionKey: dim.key,
            children: subEntities.map((e) => ({
              id: `roles:${sub.id}:${String(e.id)}`,
              name: getEntityName(dim.key, e),
              dimensionKey: dim.key,
              entity: e,
              isInherited: true,
            })),
          };
        });
        return {
          id: dim.key,
          name: dim.label,
          icon: dim.icon,
          count: entities.length,
          dimensionKey: dim.key,
          children,
          isInherited: true,
        };
      }

      // 普通维度：直接展开叶子节点（如果有父级关联的，后续可做子分组）
      const leafChildren = entities.map((e) => ({
        id: `${dim.key}:${String(e.id)}`,
        name: getEntityName(dim.key, e),
        dimensionKey: dim.key,
        entity: e,
        isInherited: true,
        description: getEntityDesc(dim.key, e),
      }));

      return {
        id: dim.key,
        name: dim.label,
        icon: dim.icon,
        count: entities.length,
        dimensionKey: dim.key,
        children: leafChildren,
        isInherited: true,
      };
    }).filter((n) => n.count !== undefined); // 保留所有维度
  }, [sourceWorld]);

  // ── 选中/取消选中 ──

  /** 获取某个节点及其所有子孙的 entity id 集合 */
  function getDescendantIds(node: TreeNode): string[] {
    const ids: string[] = [];
    if (node.children) {
      for (const child of node.children) {
        ids.push(child.id);
        ids.push(...getDescendantIds(child));
      }
    }
    return ids;
  }

  /** 判断节点的子节点选中状态 */
  function getChildCheckState(node: TreeNode): "checked" | "unchecked" | "indeterminate" {
    if (!node.children || node.children.length === 0) {
      return selectedIds.has(node.id) ? "checked" : "unchecked";
    }
    const allIds = getDescendantIds(node);
    const checkedCount = allIds.filter((id) => selectedIds.has(id)).length;
    // 也包含自身的选中状态
    const selfChecked = selectedIds.has(node.id);

    if (node.children.length > 0 && !node.entity) {
      // 父节点：看所有 descendant
      if (checkedCount === allIds.length && selfChecked) return "checked";
      if (checkedCount === 0 && !selfChecked) return "unchecked";
      return "indeterminate";
    }
    return selfChecked ? "checked" : "unchecked";
  }

  const toggleNode = useCallback((nodeId: string, node: TreeNode) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const ids = [nodeId, ...getDescendantIds(node)];
      const allChecked = ids.every((id) => next.has(id));
      if (allChecked) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  // ── 冲突检测 ──

  const detectConflicts = useCallback(() => {
    const newConflicts = new Map<string, ConflictInfo>();
    if (!sourceWorld) return newConflicts;
    const world = sourceWorld as unknown as Record<string, unknown[]>;

    for (const dim of DIMENSIONS) {
      const entities = world[dim.key] as Record<string, unknown>[] | undefined;
      if (!entities) continue;
      for (const entity of entities) {
        const name = getEntityName(dim.key, entity);
        // 在当前维度内检查同名
        if (hasNameConflict(world, dim.key, name)) {
          // 找到冲突的对 — 仅第一个同名标记为冲突
          const entityId = String(entity.id);
          const key = `${dim.key}:${entityId}`;
          if (!newConflicts.has(key)) {
            newConflicts.set(key, {
              entityId,
              entityName: name,
              dimensionKey: dim.key,
              resolution: null,
            });
          }
        }
      }
    }
    return newConflicts;
  }, [sourceWorld]);

  // ── 统计 ──

  const stats = useMemo(() => {
    let total = 0;
    let selected = 0;
    const byDim: Record<string, { total: number; selected: number }> = {};

    for (const dim of DIMENSIONS) {
      if (!treeData.find((n) => n.id === dim.key)) continue;
      const node = treeData.find((n) => n.id === dim.key)!;
      // 统计叶子节点
      let dimTotal = 0;
      let dimSelected = 0;
      const walk = (n: TreeNode) => {
        if (n.entity) {
          dimTotal++;
          if (selectedIds.has(n.id)) dimSelected++;
        }
        if (n.children) n.children.forEach(walk);
      };
      walk(node);
      byDim[dim.key] = { total: dimTotal, selected: dimSelected };
      total += dimTotal;
      selected += dimSelected;
    }

    // 检测冲突
    const conflictCount = conflicts.size;

    return { total, selected, byDim, conflictCount };
  }, [treeData, selectedIds, conflicts]);

  // ── 冲突处理 ──

  const openConflictModal = useCallback((conflict: ConflictInfo) => {
    setActiveConflict(conflict);
  }, []);

  const resolveConflict = useCallback(
    (resolution: "overwrite" | "keep" | "rename") => {
      if (!activeConflict) return;
      setConflicts((prev) => {
        const next = new Map(prev);
        const key = `${activeConflict.dimensionKey}:${activeConflict.entityId}`;
        next.set(key, { ...activeConflict, resolution });
        return next;
      });
      if (resolution === "keep") {
        // 取消选中
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(`${activeConflict.dimensionKey}:${activeConflict.entityId}`);
          return next;
        });
      }
      setActiveConflict(null);
    },
    [activeConflict],
  );

  // ── 确认继承 ──

  const handleConfirm = useCallback(async () => {
    if (stats.selected === 0 || !sourceWorld) return;
    setConfirming(true);
    try {
      // 收集选中的实体
      const selectedEntities: Record<string, unknown[]> = {};
      const walkTree = (nodes: TreeNode[]) => {
        for (const node of nodes) {
          if (node.entity && selectedIds.has(node.id)) {
            const dimKey = node.dimensionKey!;
            if (!selectedEntities[dimKey]) selectedEntities[dimKey] = [];
            selectedEntities[dimKey].push(node.entity);
          }
          if (node.children) walkTree(node.children);
        }
      };
      walkTree(treeData);

      // 处理冲突：如果 resolution 是 rename，重命名实体
      for (const [key, conflict] of conflicts) {
        if (conflict.resolution === "rename") {
          const [dimKey, entityId] = key.split(":");
          const entities = selectedEntities[dimKey];
          if (entities) {
            const idx = entities.findIndex(
              (e) => String((e as Record<string, unknown>).id) === entityId,
            );
            if (idx !== -1) {
              const entity = entities[idx] as Record<string, unknown>;
              const oldName = getEntityName(dimKey, entity);
              if (dimKey === "history") {
                entity.title = `${oldName} [继承]`;
              } else {
                entity.name = `${oldName} [继承]`;
              }
            }
          }
        }
      }

      // 创建新 world
      const now = new Date().toISOString();
      const newWorldId = `world-${Date.now()}`;
      const newWorld: Record<string, unknown> = {
        id: newWorldId,
        name: `${sourceWorld.name} (继承)`,
        description: `从 "${sourceWorld.name}" 选择性继承创建`,
        createdAt: now,
        updatedAt: now,
        ...selectedEntities,
        references: [],
      };

      await postApi(`/worlds/${encodeURIComponent(newWorldId)}`, newWorld);

      // 跳转到新 world 详情页
      setRoute({ page: "world-detail", worldId: newWorldId });
    } catch (err) {
      console.error("继承创建失败:", err);
      alert(`继承创建失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setConfirming(false);
    }
  }, [stats.selected, sourceWorld, selectedIds, conflicts, treeData, setRoute]);

  // ── 首次加载时检测冲突 ──

  useEffect(() => {
    if (sourceWorld) {
      setConflicts(detectConflicts());
    }
  }, [sourceWorld, detectConflicts]);

  // ── 根据冲突信息判断节点是否有未解决的冲突 ──

  const getConflictForNode = useCallback(
    (nodeId: string): ConflictInfo | undefined => {
      return conflicts.get(nodeId);
    },
    [conflicts],
  );

  // ── Render Helpers ──

  const renderCheckbox = (nodeId: string, node: TreeNode) => {
    const checkState = getChildCheckState(node);
    const isChecked = checkState === "checked";
    const isIndeterminate = checkState === "indeterminate";

    const conflict = getConflictForNode(nodeId);

    return (
      <label
        className="relative inline-flex items-center justify-center w-5 h-5 flex-shrink-0 cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          className="absolute opacity-0 w-0 h-0"
          checked={isChecked}
          ref={(el) => {
            if (el) el.indeterminate = isIndeterminate;
          }}
          onChange={() => toggleNode(nodeId, node)}
        />
        <span
          className={cn(
            "w-5 h-5 border-2 rounded flex items-center justify-center transition-all",
            isChecked
              ? "bg-primary border-primary"
              : isIndeterminate
                ? "border-primary bg-background"
                : "border-border bg-background hover:border-primary",
          )}
        >
          {isChecked && <Check size={12} className="text-primary-foreground" />}
          {isIndeterminate && (
            <Minus size={12} className="text-primary" />
          )}
        </span>
      </label>
    );
  };

  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isLeaf = !hasChildren;
    const checkState = getChildCheckState(node);
    const conflict = getConflictForNode(node.id);
    const hasConflict = conflict && !conflict.resolution;

    return (
      <div key={node.id} className="tree-node">
        {/* Node Row */}
        <div
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 cursor-pointer transition-colors min-h-[40px] select-none",
            "hover:bg-muted/30",
            hasConflict && "bg-destructive/5 hover:bg-destructive/10",
          )}
          onClick={() => hasChildren && toggleExpand(node.id)}
        >
          {/* Expand Toggle */}
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center w-5 h-5 flex-shrink-0 text-muted-foreground transition-transform",
              isExpanded && "rotate-90",
              isLeaf && "invisible",
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.id);
            }}
          >
            <ChevronRight size={14} />
          </button>

          {/* Checkbox */}
          {renderCheckbox(node.id, node)}

          {/* Label */}
          <span className="flex items-center gap-2 flex-1 min-w-0">
            {node.icon && (
              <span className="text-base flex-shrink-0">{node.icon}</span>
            )}
            <span
              className={cn(
                "text-sm font-medium",
                hasConflict ? "text-destructive" : "text-foreground",
              )}
            >
              {node.name}
            </span>
            {node.count !== undefined && (
              <span className="text-xs text-muted-foreground">
                ({node.count})
              </span>
            )}
          </span>

          {/* Inherit Badge */}
          {node.isInherited && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent/20 text-accent-foreground whitespace-nowrap flex-shrink-0">
              <BookOpen size={10} />
              继承
            </span>
          )}

          {/* Conflict Badge */}
          {hasConflict && (
            <button
              type="button"
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-destructive/10 text-destructive flex-shrink-0 hover:bg-destructive/20 hover:scale-110 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                openConflictModal(conflict);
              }}
              title="存在命名冲突"
            >
              <AlertTriangle size={12} />
            </button>
          )}
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="ml-[52px] pl-4 border-l border-border/40">
            {node.children!.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // ── Loading ──

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">加载世界数据…</span>
      </div>
    );
  }

  // ── Error ──

  if (error || !sourceWorld) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setRoute({ page: "worlds" })}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          <span>返回世界列表</span>
        </button>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error || "未能加载世界数据"}
        </div>
      </div>
    );
  }

  // ── Main Render ──

  return (
    <div className="space-y-5 max-w-3xl">
      {/* ═══ Top Bar ═══ */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setRoute({ page: "worlds" })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/50 bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
        >
          <ArrowLeft size={16} />
          返回
        </button>
        <div className="flex items-center justify-between flex-1">
          <h1 className="text-lg font-semibold text-foreground">选择性继承 World</h1>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-accent/15 text-accent-foreground">
            <Globe size={14} />
            继承来源：{sourceWorld.name}
          </span>
        </div>
      </div>

      {/* ═══ Stats Summary ═══ */}
      <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-bold text-primary">{stats.selected}</span>
          <span className="text-sm text-muted-foreground">个实体将被继承</span>
          <span className="text-base text-muted-foreground/60">
            / 共 {stats.total} 个实体
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {DIMENSIONS.map((dim) => {
            const dimStat = stats.byDim[dim.key];
            if (!dimStat || dimStat.total === 0) return null;
            const { total: dt, selected: ds } = dimStat;
            const isFull = ds === dt && dt > 0;
            const isPartial = ds > 0 && ds < dt;
            const isEmpty = ds === 0;
            return (
              <span
                key={dim.key}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs transition-all border",
              isFull &&
                    "bg-primary/10 border-primary/20 text-primary",
              isPartial &&
                    "bg-primary/10 border-primary/20 text-primary",
              isEmpty &&
                    "bg-muted/30 border-border/30 text-muted-foreground",
                )}
              >
                <span className="text-xs">{dim.icon}</span>
                <span>{dim.label}</span>
                <span className="font-semibold">
                  {ds}/{dt}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ═══ Tree Selector ═══ */}
      <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 bg-muted/20">
          <h2 className="text-sm font-semibold text-foreground">实体清单</h2>
          <span className="text-xs text-muted-foreground">
            全部选中可继承 {stats.total} 个实体
          </span>
        </div>
        <div className="divide-y divide-border/20">
          {treeData.map((node) => renderTreeNode(node))}
        </div>
      </div>

      {/* ═══ Action Bar ═══ */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-card p-4 shadow-sm">
        <span className="text-xs text-muted-foreground">
          已选择 <strong className="text-foreground">{stats.selected}</strong> 个实体
          {stats.conflictCount > 0 && (
            <>
              {" · "}检测到{" "}
              <strong className="text-destructive">{stats.conflictCount}</strong> 个命名冲突
            </>
          )}
        </span>
        <button
          type="button"
          disabled={stats.selected === 0 || confirming}
          onClick={handleConfirm}
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {confirming ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              创建中…
            </>
          ) : (
            <>
              <Check size={16} />
              确认创建新 World
            </>
          )}
        </button>
      </div>

      {/* ═══ Conflict Modal ═══ */}
      {activeConflict && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={() => setActiveConflict(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-6 pt-5 pb-2">
              <div className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-destructive" />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                命名冲突：{activeConflict.entityName}
              </h3>
            </div>

            {/* Body */}
            <div className="px-6 py-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                该实体与本地 World 中已存在的实体同名，继承后会导致命名冲突。
              </p>
              <div className="rounded-lg bg-muted/30 p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">冲突名称</span>
                  <span className="font-medium text-foreground">
                    {activeConflict.entityName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">来源 World</span>
                  <span className="font-medium text-foreground">
                    {sourceWorld.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">类型</span>
                  <span className="font-medium text-foreground">
                    {DIMENSIONS.find((d) => d.key === activeConflict.dimensionKey)
                      ?.label ?? activeConflict.dimensionKey}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 px-6 pb-6 pt-2">
              <button
                type="button"
                onClick={() => resolveConflict("overwrite")}
                className="flex-1 px-3 py-2 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-xs font-medium hover:bg-destructive/10 transition-all"
              >
                <span className="block">覆盖</span>
                <span className="block text-[10px] opacity-70 font-normal mt-0.5">
                  以继承版本替换本地版本
                </span>
              </button>
              <button
                type="button"
                onClick={() => resolveConflict("keep")}
                className="flex-1 px-3 py-2 rounded-lg border border-border/50 bg-card text-foreground text-xs font-medium hover:bg-muted/30 transition-all"
              >
                <span className="block">保留本地</span>
                <span className="block text-[10px] opacity-70 font-normal mt-0.5">
                  保留本地版本，不继承此项
                </span>
              </button>
              <button
                type="button"
                onClick={() => resolveConflict("rename")}
                className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-all"
              >
                <span className="block">重命名继承</span>
                <span className="block text-[10px] opacity-70 font-normal mt-0.5">
                  自动添加「继承」后缀
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
