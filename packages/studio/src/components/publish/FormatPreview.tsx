// ── Format Preview (C1-2) ──
// Split-pane preview showing original vs platform-formatted text with scroll sync.

import { useState, useCallback, useRef, useEffect } from "react";
import { FileText, FileCheck, BookOpen, Eye, EyeOff } from "lucide-react";

// ── Types ──

interface ChapterPreview {
  readonly number: number;
  readonly title: string;
  readonly original: string;
  readonly formatted: string;
}

interface FormatPreviewProps {
  readonly chapters: readonly ChapterPreview[];
  readonly platformName: string;
  readonly onClose: () => void;
  readonly onPublish: () => void;
}

// ── Component ──

export function FormatPreview({ chapters, platformName, onClose, onPublish }: FormatPreviewProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showOriginal, setShowOriginal] = useState(true);
  const [showFormatted, setShowFormatted] = useState(true);
  const [scrollRatio, setScrollRatio] = useState(0);

  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  const current = chapters[selectedIndex] ?? null;

  // Total word counts
  const totalOriginal = chapters.reduce((sum, ch) => sum + ch.original.length, 0);
  const totalFormatted = chapters.reduce((sum, ch) => sum + ch.formatted.length, 0);
  const wordCountDiff = totalFormatted - totalOriginal;

  // Scroll sync handler
  const handleScroll = useCallback((source: "left" | "right") => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    const leftEl = leftPaneRef.current;
    const rightEl = rightPaneRef.current;
    if (!leftEl || !rightEl) {
      isSyncingRef.current = false;
      return;
    }

    const maxScrollLeft = leftEl.scrollHeight - leftEl.clientHeight;
    const maxScrollRight = rightEl.scrollHeight - rightEl.clientHeight;

    if (source === "left") {
      const ratio = maxScrollLeft > 0 ? leftEl.scrollTop / maxScrollLeft : 0;
      setScrollRatio(ratio);
      rightEl.scrollTop = ratio * maxScrollRight;
    } else {
      const ratio = maxScrollRight > 0 ? rightEl.scrollTop / maxScrollRight : 0;
      setScrollRatio(ratio);
      leftEl.scrollTop = ratio * maxScrollLeft;
    }

    isSyncingRef.current = false;
  }, []);

  // Reset scroll sync when chapter changes
  useEffect(() => {
    if (leftPaneRef.current) leftPaneRef.current.scrollTop = 0;
    if (rightPaneRef.current) rightPaneRef.current.scrollTop = 0;
    setScrollRatio(0);
  }, [selectedIndex]);

  if (!current) {
    return (
      <div className="p-4 text-center text-gray-500">
        没有可预览的章节内容
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-white">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-lg">{platformName} 格式预览</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${wordCountDiff >= 0 ? "text-green-600" : "text-orange-600"}`}>
            字数变化: {wordCountDiff >= 0 ? "+" : ""}{wordCountDiff}
          </span>
          <button
            onClick={() => setShowOriginal((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${
              showOriginal ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-500"
            }`}
            title="切换原文面板"
          >
            {showOriginal ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            原文
          </button>
          <button
            onClick={() => setShowFormatted((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${
              showFormatted ? "bg-blue-50 border-blue-300 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-500"
            }`}
            title="切换格式面板"
          >
            {showFormatted ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            格式化
          </button>
          <button
            onClick={onPublish}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
          >
            确认发布
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
        </div>
      </div>

      {/* Chapter selector */}
      <div className="flex gap-1 p-2 border-b bg-gray-50 overflow-x-auto">
        {chapters.map((ch, i) => (
          <button
            key={ch.number}
            onClick={() => setSelectedIndex(i)}
            className={`px-3 py-1 rounded text-sm whitespace-nowrap transition-colors ${
              i === selectedIndex
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
            }`}
          >
            {ch.title || `第${ch.number}章`}
          </button>
        ))}
      </div>

      {/* Word count for current chapter */}
      <div className="flex px-3 py-1.5 text-xs text-gray-500 border-b bg-gray-50/50">
        <span className="mr-4">原文: {current.original.length} 字</span>
        <span>格式化后: {current.formatted.length} 字</span>
      </div>

      {/* Split panes */}
      <div className="flex flex-1 overflow-hidden">
        {showOriginal && (
          <div
            ref={leftPaneRef}
            onScroll={() => handleScroll("left")}
            className={`${showFormatted ? "w-1/2" : "w-full"} overflow-y-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap border-r`}
          >
            <div className="pb-2 mb-3 border-b border-gray-200 font-semibold text-gray-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              原文
            </div>
            {current.original || <span className="text-gray-400 italic">（空）</span>}
          </div>
        )}
        {showFormatted && (
          <div
            ref={rightPaneRef}
            onScroll={() => handleScroll("right")}
            className={`${showOriginal ? "w-1/2" : "w-full"} overflow-y-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap`}
          >
            <div className="pb-2 mb-3 border-b border-gray-200 font-semibold text-gray-700 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-green-600" />
              {platformName} 格式
            </div>
            {current.formatted || <span className="text-gray-400 italic">（空）</span>}
          </div>
        )}
      </div>
    </div>
  );
}
