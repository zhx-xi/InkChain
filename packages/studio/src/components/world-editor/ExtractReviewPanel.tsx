// ── ExtractReviewPanel (Wrld-7: AI导入提取MVP) ──
// Review and edit panel showing all 7 extracted world dimensions with
// diff highlights vs original text and confirm/save functionality.

import React, { useState, useCallback, useMemo } from "react";
import type { ExtractedWorld, ExtractResult } from "@inkchain/inkchain-core";

// ── Dimension metadata ──

interface DimensionMeta {
  key: keyof ExtractedWorld;
  label: string;
  description: string;
  color: string;
  placeholder: string;
}

const DIMENSIONS: DimensionMeta[] = [
  { key: "settings", label: "世界观设定", description: "世界观的核心设定，包括魔法体系、科技水平、社会结构等", color: "#8b5cf6", placeholder: "未提取到相关内容" },
  { key: "roles", label: "角色", description: "世界中的角色列表及其描述", color: "#3b82f6", placeholder: "未提取到相关内容" },
  { key: "relations", label: "关系", description: "角色之间或势力之间的关系", color: "#ec4899", placeholder: "未提取到相关内容" },
  { key: "regions", label: "地理区域", description: "大陆、国家、城市、地点等地理位置", color: "#10b981", placeholder: "未提取到相关内容" },
  { key: "institutions", label: "组织势力", description: "宗门、家族、帝国、公会等组织", color: "#f59e0b", placeholder: "未提取到相关内容" },
  { key: "history", label: "历史", description: "重大历史事件和年表", color: "#ef4444", placeholder: "未提取到相关内容" },
  { key: "rules", label: "规则", description: "世界的物理/魔法/社会规则", color: "#6366f1", placeholder: "未提取到相关内容" },
];

// ── Props ──

export interface ExtractReviewPanelProps {
  readonly result: ExtractResult;
  readonly rawText: string;
  readonly onConfirm: (world: ExtractedWorld) => Promise<void> | void;
  readonly onCancel: () => void;
  readonly onRedo: () => void;
}

// ── Helper: Simple word-level diff ──

interface DiffSegment {
  text: string;
  type: "same" | "removed" | "added";
}

function computeDiff(original: string, extracted: string): DiffSegment[] {
  if (!original || !extracted) return [{ text: extracted || original, type: "same" }];

  const origWords = original.split(/(\s+)/);
  const extrWords = extracted.split(/(\s+)/);

  // Simple longest common subsequence diff
  const lcsTable: number[][] = Array.from({ length: origWords.length + 1 }, () =>
    Array(extrWords.length + 1).fill(0),
  );

  for (let i = 1; i <= origWords.length; i++) {
    for (let j = 1; j <= extrWords.length; j++) {
      if (origWords[i - 1] === extrWords[j - 1]) {
        lcsTable[i][j] = lcsTable[i - 1][j - 1] + 1;
      } else {
        lcsTable[i][j] = Math.max(lcsTable[i - 1][j], lcsTable[i][j - 1]);
      }
    }
  }

  const segments: DiffSegment[] = [];
  let i = origWords.length;
  let j = extrWords.length;

  const temp: DiffSegment[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origWords[i - 1] === extrWords[j - 1]) {
      temp.push({ text: origWords[i - 1], type: "same" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcsTable[i][j - 1] >= lcsTable[i - 1][j])) {
      temp.push({ text: extrWords[j - 1], type: "added" });
      j--;
    } else {
      temp.push({ text: origWords[i - 1], type: "removed" });
      i--;
    }
  }

  segments.push(...temp.reverse());
  return segments;
}

// ── DiffView Component ──

function DiffView({ segments }: { segments: DiffSegment[] }) {
  return (
    <span>
      {segments.map((seg, idx) => (
        <span
          key={idx}
          style={{
            backgroundColor:
              seg.type === "removed" ? "rgba(239, 68, 68, 0.2)" :
              seg.type === "added" ? "rgba(34, 197, 94, 0.2)" :
              "transparent",
            textDecoration: seg.type === "removed" ? "line-through" : "none",
            color:
              seg.type === "removed" ? "#f87171" :
              seg.type === "added" ? "#4ade80" :
              "inherit",
          }}
        >
          {seg.text}
        </span>
      ))}
    </span>
  );
}

// ── DimensionEditor Component ──

function DimensionEditor({
  dim,
  value,
  onChange,
  originalText,
}: {
  dim: DimensionMeta;
  value: string;
  onChange: (value: string) => void;
  originalText: string;
}) {
  const [showDiff, setShowDiff] = useState(false);

  const diffSegments = useMemo(
    () => showDiff ? computeDiff(originalText, value) : [],
    [showDiff, originalText, value],
  );

  const hasContent = value.trim().length > 0;

  return (
    <div
      style={{
        marginBottom: "16px",
        borderRadius: "8px",
        border: `1px solid ${dim.color}40`,
        overflow: "hidden",
      }}
    >
      {/* Dimension header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          background: `${dim.color}15`,
          borderBottom: `1px solid ${dim.color}30`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: dim.color,
              display: "inline-block",
            }}
          />
          <span style={{ fontWeight: 600, fontSize: "14px", color: "#e0e0e0" }}>
            {dim.label}
          </span>
          <span style={{ fontSize: "12px", color: "#666" }}>
            {dim.description}
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button
            onClick={() => setShowDiff(!showDiff)}
            style={{
              padding: "3px 10px",
              borderRadius: "4px",
              border: `1px solid ${dim.color}60`,
              background: showDiff ? `${dim.color}30` : "transparent",
              color: dim.color,
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 500,
            }}
          >
            {showDiff ? "隐藏差异" : "对比原文"}
          </button>
          {!hasContent && (
            <span style={{ fontSize: "11px", color: "#888", alignSelf: "center" }}>
              无内容
            </span>
          )}
        </div>
      </div>

      {/* Diff view */}
      {showDiff && diffSegments.length > 0 && (
        <div
          style={{
            padding: "8px 14px",
            background: "#111120",
            borderBottom: `1px solid ${dim.color}20`,
            fontSize: "12px",
            lineHeight: "1.6",
            fontFamily: "'Courier New', monospace",
            maxHeight: "100px",
            overflowY: "auto",
            color: "#aaa",
          }}
        >
          <DiffView segments={diffSegments} />
        </div>
      )}

      {/* Editable textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={dim.placeholder}
        style={{
          width: "100%",
          minHeight: "80px",
          padding: "12px 14px",
          border: "none",
          background: "#16162a",
          color: "#e0e0e0",
          fontSize: "13px",
          fontFamily: "'Courier New', monospace",
          lineHeight: "1.6",
          resize: "vertical",
          outline: "none",
        }}
      />
    </div>
  );
}

// ── ExtractReviewPanel Component ──

export function ExtractReviewPanel({
  result,
  rawText,
  onConfirm,
  onCancel,
  onRedo,
}: ExtractReviewPanelProps) {
  const [world, setWorld] = useState<ExtractedWorld>(result.world);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");

  const updateDimension = useCallback((key: keyof ExtractedWorld, value: string) => {
    setWorld((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleConfirm = useCallback(async () => {
    setSaving(true);
    try {
      await onConfirm(world);
    } finally {
      setSaving(false);
    }
  }, [world, onConfirm]);

  // Count filled dimensions
  const filledCount = Object.values(world).filter((v) => v.trim().length > 0).length;
  const totalEntities = result.entities.length;

  // Stats summary
  const stats = useMemo(() => {
    return DIMENSIONS.map((dim) => ({
      ...dim,
      charCount: world[dim.key]?.length ?? 0,
      entityCount: result.entities.filter((e) => e.dimension === dim.key).length,
    }));
  }, [world, result.entities]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#1a1a2e",
        color: "#e0e0e0",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #333",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#fff" }}>
            提取结果审查
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#888" }}>
            已提取 {totalEntities} 个实体，覆盖 {filledCount}/7 个维度
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={onRedo}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #555",
              background: "transparent",
              color: "#ccc",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            重新提取
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #555",
              background: "transparent",
              color: "#ccc",
              cursor: "pointer",
              fontSize: "13px",
            }}
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            style={{
              padding: "8px 20px",
              borderRadius: "6px",
              border: "none",
              background: saving ? "#3b82f680" : "#3b82f6",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {saving ? "保存中…" : "确认并保存"}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          padding: "10px 20px",
          borderBottom: "1px solid #2a2a4a",
          background: "#16162a",
          overflowX: "auto",
        }}
      >
        <button
          onClick={() => setActiveTab("all")}
          style={{
            padding: "4px 12px",
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: activeTab === "all" ? 600 : 400,
            background: activeTab === "all" ? "#3b82f6" : "#2a2a4a",
            color: activeTab === "all" ? "#fff" : "#999",
            whiteSpace: "nowrap",
          }}
        >
          全部
        </button>
        {stats.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveTab(s.key)}
            style={{
              padding: "4px 12px",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: activeTab === s.key ? 600 : 400,
              background: activeTab === s.key ? s.color : "#2a2a4a",
              color: activeTab === s.key ? "#fff" : "#999",
              whiteSpace: "nowrap",
              opacity: s.charCount === 0 ? 0.5 : 1,
            }}
          >
            {s.label} ({s.entityCount})
          </button>
        ))}
      </div>

      {/* Editor area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
        }}
      >
        {DIMENSIONS.map((dim) => {
          if (activeTab !== "all" && activeTab !== dim.key) return null;
          return (
            <DimensionEditor
              key={dim.key}
              dim={dim}
              value={world[dim.key]}
              onChange={(v) => updateDimension(dim.key, v)}
              originalText={rawText}
            />
          );
        })}

        {/* Empty state */}
        {filledCount === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "#666",
            }}
          >
            <p style={{ fontSize: "14px", margin: 0 }}>
              未能从文本中提取到结构化的世界观维度数据。
            </p>
            <p style={{ fontSize: "13px", margin: "8px 0 0", color: "#555" }}>
              建议在文本中使用 Markdown 标题（如 # 角色、## 地理区域）来组织内容，然后重新提取。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
