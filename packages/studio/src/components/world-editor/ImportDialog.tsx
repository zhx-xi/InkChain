// ── ImportDialog (Wrld-7: AI导入提取MVP) ──
// Modal dialog for importing TXT/MD files or pasting text for world extraction.

import React, { useState, useRef, useCallback } from "react";
import type { ExtractedWorld, ExtractResult } from "@actalk/inkos-core";

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
  const [progress, setProgress] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleExtract = useCallback(async (content: string) => {
    if (!content.trim()) {
      setError("请输入或上传文本内容");
      return;
    }

    setLoading(true);
    setError(null);
    setProgress("正在分析文本结构…");

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

      setProgress("解析完成，正在生成预览…");
      const result = (await res.json()) as ExtractResult;
      onExtracted(result, content);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "提取过程中发生未知错误");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [apiBase, bookId, onExtracted, onClose]);

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
      await handleExtract(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法读取文件内容");
    }
  }, [handleExtract]);

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
          width: "560px",
          maxWidth: "90vw",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          color: "#e0e0e0",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Header */}
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

        {/* Tab bar */}
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

        {/* Content area */}
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
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: "36px", marginBottom: "12px", opacity: 0.5 }}>&#128196;</div>
              <p style={{ margin: "0 0 8px", color: "#aaa", fontSize: "14px" }}>
                点击或拖拽文件到此处
              </p>
              <p style={{ margin: 0, color: "#666", fontSize: "12px" }}>
                支持 .txt 和 .md 格式，最大 1MB
              </p>
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

        {/* Error */}
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

        {/* Progress */}
        {loading && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 12px",
              borderRadius: "6px",
              background: "#1a2d3d",
              color: "#60a5fa",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{
              display: "inline-block",
              width: "14px",
              height: "14px",
              border: "2px solid #60a5fa",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            {progress}
          </div>
        )}

        {/* Footer */}
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
