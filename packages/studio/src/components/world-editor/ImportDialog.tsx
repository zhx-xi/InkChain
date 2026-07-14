// ── ImportDialog (Wrld-7: AI导入提取MVP) ──
// Modal dialog for importing TXT/MD files or pasting text for world extraction.
// Includes progress bar + file content preview (Issue #363).

import React, { useState, useRef, useCallback, useMemo } from "react";
import type { ExtractResult } from "@inkchain/inkchain-core";

// ── Progress stage definitions ──

interface ProgressStage {
  key: string;
  label: string;
  weight: number; // percentage share of total progress
}

const EXTRACT_STAGES: ProgressStage[] = [
  { key: "reading", label: "读取文件内容…", weight: 10 },
  { key: "parsing", label: "正在分析文本结构…", weight: 25 },
  { key: "extracting", label: "正在提取世界观元素…", weight: 35 },
  { key: "generating", label: "正在生成分类预览…", weight: 20 },
  { key: "finalizing", label: "即将完成…", weight: 10 },
];

const STAGE_WEIGHT_MAP = new Map(EXTRACT_STAGES.map((s) => [s.key, s.weight]));
const TOTAL_WEIGHT = EXTRACT_STAGES.reduce((sum, s) => sum + s.weight, 0);

// ── Props ──

export interface ImportDialogProps {
  readonly open: boolean;
  readonly bookId: string;
  readonly onClose: () => void;
  readonly onExtracted: (result: ExtractResult, rawText: string) => void;
  readonly apiBase?: string;
}

// ── Component ──

export function ImportDialog({
  open,
  bookId,
  onClose,
  onExtracted,
  apiBase = "/api/v1/books",
}: ImportDialogProps) {
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<string>("");
  const [stageProgress, setStageProgress] = useState(0); // 0-100 within the current stage
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Advance to a specific stage with progress anchor
  const goToStage = useCallback((stageKey: string, subProgress = 0) => {
    setCurrentStage(stageKey);
    setStageProgress(subProgress);
  }, []);

  // Calculate overall progress percentage (0-100)
  const overallProgress = useMemo(() => {
    if (!currentStage) return 0;
    let accumulated = 0;
    for (const stage of EXTRACT_STAGES) {
      if (stage.key === currentStage) {
        // Within this stage: accumulated + (subProgress / 100 * stage.weight)
        return Math.round((accumulated + (stageProgress / 100) * stage.weight) / TOTAL_WEIGHT * 100);
      }
      accumulated += stage.weight;
    }
    return 0;
  }, [currentStage, stageProgress]);

  // Get current stage label
  const currentStageLabel = useMemo(() => {
    const stage = EXTRACT_STAGES.find((s) => s.key === currentStage);
    return stage?.label ?? "";
  }, [currentStage]);

  // Simulate progress stages during extraction
  const runProgressSimulation = useCallback(async (): Promise<void> => {
    goToStage("reading", 0);
    await new Promise((r) => setTimeout(r, 200));
    goToStage("reading", 50);
    await new Promise((r) => setTimeout(r, 300));
    goToStage("reading", 100);
    await new Promise((r) => setTimeout(r, 200));

    goToStage("parsing", 0);
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 200));
      goToStage("parsing", (i + 1) * 20);
    }

    goToStage("extracting", 0);
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 300));
      goToStage("extracting", (i + 1) * 20);
    }

    goToStage("generating", 0);
    await new Promise((r) => setTimeout(r, 200));
    goToStage("generating", 50);
    await new Promise((r) => setTimeout(r, 300));
    goToStage("generating", 100);

    goToStage("finalizing", 0);
    await new Promise((r) => setTimeout(r, 200));
    goToStage("finalizing", 80);
  }, [goToStage]);

  const handleExtract = useCallback(async (content: string) => {
    if (!content.trim()) {
      setError("请输入或上传文本内容");
      return;
    }

    setLoading(true);
    setError(null);

    // Start progress simulation
    const progressPromise = runProgressSimulation();

    try {
      const res = await fetch(`${apiBase}/${encodeURIComponent(bookId)}/worlds/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
        throw new Error(
          (err as Record<string, unknown>)?.error
            ? ((err as Record<string, unknown>).error as Record<string, unknown>)?.message as string
            : `请求失败 (${res.status})`,
        );
      }

      goToStage("finalizing", 100);
      await new Promise((r) => setTimeout(r, 300));
      const result = (await res.json()) as ExtractResult;
      onExtracted(result, content);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提取过程中发生未知错误");
    } finally {
      setLoading(false);
      setCurrentStage("");
      setStageProgress(0);
    }
  }, [apiBase, bookId, onExtracted, onClose, runProgressSimulation, goToStage]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "txt" && ext !== "md" && ext !== "markdown") {
      setError("仅支持 .txt 和 .md 格式的文件");
      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      setError("文件大小不能超过 1MB");
      return;
    }

    try {
      const content = await file.text();
      setText(content);
      setFileName(file.name);
      await handleExtract(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法读取文件内容");
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [handleExtract]);

  const handlePasteExtract = useCallback(() => {
    void handleExtract(text);
  }, [handleExtract, text]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "txt" && ext !== "md" && ext !== "markdown") {
      setError("仅支持 .txt 和 .md 格式的文件");
      return;
    }

    if (file.size > 1024 * 1024) {
      setError("文件大小不能超过 1MB");
      return;
    }

    try {
      const content = await file.text();
      setText(content);
      setFileName(file.name);
      await handleExtract(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法读取文件内容");
    }
  }, [handleExtract]);

  // Compute text preview (truncated)
  const textPreview = useMemo(() => {
    if (!text || text.length === 0) return null;
    const previewLength = 500;
    const truncated = text.length > previewLength;
    return {
      content: truncated ? text.substring(0, previewLength) + "…" : text,
      totalChars: text.length,
      isTruncated: truncated,
    };
  }, [text]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#1a1a2e",
          borderRadius: "12px",
          padding: "24px",
          width: "600px",
          maxWidth: "90vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          color: "#e0e0e0",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, color: "#ffffff" }}>
            导入世界观
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#888",
              fontSize: "20px",
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: "4px",
            }}
            aria-label="关闭"
          >
            &times;
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <button
            onClick={() => setTab("file")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: tab === "file" ? 600 : 400,
              background: tab === "file" ? "#3b82f6" : "#2a2a4a",
              color: tab === "file" ? "#fff" : "#999",
              fontSize: "14px",
            }}
          >
            上传文件
          </button>
          <button
            onClick={() => setTab("paste")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: tab === "paste" ? 600 : 400,
              background: tab === "paste" ? "#3b82f6" : "#2a2a4a",
              color: tab === "paste" ? "#fff" : "#999",
              fontSize: "14px",
            }}
          >
            粘贴文本
          </button>
        </div>

        {/* ── Content area ── */}
        <div
          style={{
            flex: 1,
            minHeight: "200px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {tab === "file" ? (
            <div
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              style={{
                flex: 1,
                border: "2px dashed #444",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 20px",
                cursor: "pointer",
                background: "#16162a",
                position: "relative",
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              {/* File loaded preview */}
              {textPreview ? (
                <div style={{ width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <span style={{ fontSize: "20px" }}>&#128196;</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, color: "#e0e0e0", fontSize: "13px", fontWeight: 500 }}>
                        {fileName ?? "已加载文件"}
                      </p>
                      <p style={{ margin: 0, color: "#888", fontSize: "11px" }}>
                        {textPreview.totalChars} 字符{textPreview.isTruncated ? `（预览前500字符）` : ""}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setText("");
                        setFileName(null);
                      }}
                      style={{
                        background: "#3d1a1a",
                        border: "none",
                        color: "#ff6b6b",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      清除
                    </button>
                  </div>
                  {/* File content preview */}
                  <div
                    style={{
                      background: "#12121e",
                      borderRadius: "6px",
                      padding: "12px",
                      maxHeight: "150px",
                      overflow: "auto",
                      fontSize: "12px",
                      lineHeight: "1.5",
                      color: "#aaa",
                      fontFamily: "'Courier New', monospace",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {textPreview.content}
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: "36px", marginBottom: "12px", opacity: 0.5 }}>&#128196;</div>
                  <p style={{ margin: "0 0 8px", color: "#aaa", fontSize: "14px" }}>
                    点击或拖拽文件到此处
                  </p>
                  <p style={{ margin: 0, color: "#666", fontSize: "12px" }}>
                    支持 .txt 和 .md 格式，最大 1MB
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="在此粘贴你的世界观设定文本（支持 Markdown 格式）…"
              style={{
                flex: 1,
                minHeight: "200px",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid #444",
                background: "#16162a",
                color: "#e0e0e0",
                fontSize: "14px",
                fontFamily: "'Courier New', monospace",
                resize: "vertical",
                outline: "none",
              }}
            />
          )}
        </div>

        {/* ── Text character count ── */}
        {text && !loading && (
          <div style={{ marginTop: "8px", textAlign: "right", fontSize: "11px", color: "#666" }}>
            {text.length} 字符
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 12px",
              borderRadius: "6px",
              background: "#3d1a1a",
              color: "#ff6b6b",
              fontSize: "13px",
            }}
          >
            {error}
          </div>
        )}

        {/* ── Progress with bar ── */}
        {loading && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px 14px",
              borderRadius: "8px",
              background: "#1a2d3d",
              color: "#60a5fa",
              fontSize: "13px",
            }}
          >
            {/* Overall progress bar */}
            <div
              style={{
                width: "100%",
                height: "6px",
                borderRadius: "3px",
                background: "#2a3d5d",
                marginBottom: "8px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  borderRadius: "3px",
                  background: "linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd)",
                  width: `${overallProgress}%`,
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            {/* Stage label */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "12px",
                  height: "12px",
                  border: "2px solid #60a5fa",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              <span>{currentStageLabel || "准备中…"}</span>
              <span style={{ marginLeft: "auto", color: "#93c5fd", fontSize: "12px" }}>
                {overallProgress}%
              </span>
            </div>

            {/* Stage indicators */}
            <div style={{ display: "flex", gap: "4px", marginTop: "8px" }}>
              {EXTRACT_STAGES.map((stage) => {
                const isActive = EXTRACT_STAGES.findIndex((s) => s.key === currentStage) >=
                  EXTRACT_STAGES.findIndex((s) => s.key === stage.key);
                return (
                  <div
                    key={stage.key}
                    style={{
                      flex: 1,
                      height: "3px",
                      borderRadius: "2px",
                      background: isActive ? "#3b82f6" : "#2a3d5d",
                      transition: "background 0.3s ease",
                    }}
                  />
                );
              })}
            </div>

            {/* Stage labels (compact) */}
            <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
              {EXTRACT_STAGES.map((stage) => {
                const isActive = EXTRACT_STAGES.findIndex((s) => s.key === currentStage) >=
                  EXTRACT_STAGES.findIndex((s) => s.key === stage.key);
                return (
                  <div
                    key={stage.key}
                    style={{
                      flex: 1,
                      fontSize: "9px",
                      color: isActive ? "#93c5fd" : "#4a5d7d",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {stage.key === "reading" ? "读取" :
                     stage.key === "parsing" ? "分析" :
                     stage.key === "extracting" ? "提取" :
                     stage.key === "generating" ? "生成" : "完成"}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px",
              borderRadius: "6px",
              border: "1px solid #555",
              background: "transparent",
              color: "#ccc",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            取消
          </button>
          {tab === "paste" && (
            <button
              onClick={handlePasteExtract}
              disabled={loading || !text.trim()}
              style={{
                padding: "8px 20px",
                borderRadius: "6px",
                border: "none",
                background: loading || !text.trim() ? "#3b82f680" : "#3b82f6",
                color: "#fff",
                cursor: loading || !text.trim() ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              {loading ? "提取中…" : "开始提取"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
