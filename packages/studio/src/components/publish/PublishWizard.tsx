// ── Publish Wizard (C1-2) ──
// Multi-step wizard: Select platform → Select chapters → Format preview → Confirm publish.

import { useState, useEffect, useCallback } from "react";
import {
  Globe,
  BookOpen,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Upload,
} from "lucide-react";
import { FormatPreview } from "./FormatPreview";
import type { PublishPlatform } from "@actalk/inkos-core";

// ── Types ──

interface ChapterInfo {
  readonly number: number;
  readonly title: string;
  readonly wordCount: number;
}

interface ValidationWarning {
  readonly field: string;
  readonly message: string;
  readonly severity: "error" | "warn";
}

interface CheckResult {
  readonly ready: boolean;
  readonly checks: readonly ValidationWarning[];
  readonly meta: {
    readonly title: string;
    readonly totalChapters: number;
    readonly totalWords: number;
  };
}

interface FormatPreviewData {
  readonly chapter: ChapterInfo;
  readonly original: string;
  readonly formatted: string;
}

type WizardStep = "platform" | "chapters" | "preview" | "confirm" | "publishing" | "done" | "error";

// ── Platform config ──

interface PlatformConfig {
  readonly id: PublishPlatform;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly minChapters: number;
  readonly minWords: number;
}

const PLATFORMS: readonly PlatformConfig[] = [
  {
    id: "qidian",
    label: "起点中文网",
    description: "适合长篇网文，章节建议 2000-4000 字",
    icon: "📖",
    minChapters: 5,
    minWords: 10000,
  },
  {
    id: "fanqie",
    label: "番茄小说",
    description: "适合快节奏网文，章节建议 1000-3000 字",
    icon: "🍅",
    minChapters: 3,
    minWords: 5000,
  },
];

// ── Props ──

interface PublishWizardProps {
  readonly bookId: string;
  readonly onClose: () => void;
}

// ── Component ──

export function PublishWizard({ bookId, onClose }: PublishWizardProps) {
  const [step, setStep] = useState<WizardStep>("platform");
  const [selectedPlatform, setSelectedPlatform] = useState<PublishPlatform | null>(null);
  const [selectedChapters, setSelectedChapters] = useState<number[]>([]);
  const [chapterList, setChapterList] = useState<ChapterInfo[]>([]);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [formatPreviews, setFormatPreviews] = useState<FormatPreviewData[]>([]);
  const [publishProgress, setPublishProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");

  // Load chapter list
  useEffect(() => {
    async function loadChapters() {
      try {
        const res = await fetch(`/api/publish/${bookId}/check`);
        if (!res.ok) throw new Error("无法获取章节列表");
        const data = await res.json() as CheckResult;
        setCheckResult(data);

        // Build chapter list from check result
        const chapters: ChapterInfo[] = [];
        for (let i = 1; i <= data.meta.totalChapters; i++) {
          chapters.push({ number: i, title: `第${i}章`, wordCount: 0 });
        }
        setChapterList(chapters);
      } catch {
        setErrorMessage("加载章节列表失败");
        setStep("error");
      }
    }
    loadChapters();
  }, [bookId]);

  // Toggle chapter selection
  const toggleChapter = useCallback((num: number) => {
    setSelectedChapters((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num].sort((a, b) => a - b),
    );
  }, []);

  // Select all / none
  const selectAllChapters = useCallback(() => {
    setSelectedChapters(chapterList.map((c) => c.number));
  }, [chapterList]);

  const clearChapterSelection = useCallback(() => {
    setSelectedChapters([]);
  }, []);

  // Start format preview
  const startPreview = useCallback(async () => {
    if (!selectedPlatform || selectedChapters.length === 0) return;
    setStep("preview");

    try {
      const res = await fetch(`/api/publish/${bookId}/format-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selectedPlatform,
          chapters: selectedChapters,
        }),
      });
      if (!res.ok) throw new Error("获取预览失败");
      const data = await res.json() as { previews: FormatPreviewData[] };
      setFormatPreviews(data.previews);
    } catch {
      setErrorMessage("获取格式预览失败");
      setStep("error");
    }
  }, [bookId, selectedPlatform, selectedChapters]);

  // Execute publish
  const executePublish = useCallback(async () => {
    if (!selectedPlatform || selectedChapters.length === 0) return;
    setStep("publishing");

    // Simulate progress
    const progressInterval = setInterval(() => {
      setPublishProgress((prev) => Math.min(prev + 10, 90));
    }, 300);

    try {
      const res = await fetch(`/api/publish/${bookId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selectedPlatform,
          chapters: selectedChapters,
        }),
      });
      clearInterval(progressInterval);
      setPublishProgress(100);

      if (!res.ok) throw new Error("发布失败");
      setStep("done");
    } catch (err) {
      clearInterval(progressInterval);
      setErrorMessage(err instanceof Error ? err.message : "发布失败");
      setStep("error");
    }
  }, [bookId, selectedPlatform, selectedChapters]);

  const resetWizard = useCallback(() => {
    setStep("platform");
    setSelectedPlatform(null);
    setSelectedChapters([]);
    setFormatPreviews([]);
    setPublishProgress(0);
    setErrorMessage("");
  }, []);

  // ── Render ──

  // Step: error
  if (step === "error") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <div className="flex flex-col items-center gap-3">
            <XCircle className="w-12 h-12 text-red-500" />
            <h2 className="text-lg font-semibold">发布失败</h2>
            <p className="text-gray-600 text-sm text-center">{errorMessage}</p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={resetWizard}
                className="px-4 py-2 bg-gray-100 rounded text-sm hover:bg-gray-200"
              >
                重新开始
              </button>
              <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                关闭
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step: done
  if (step === "done") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <h2 className="text-lg font-semibold">发布成功</h2>
            <p className="text-gray-600 text-sm text-center">
              已发布 {selectedChapters.length} 章到 {PLATFORMS.find((p) => p.id === selectedPlatform)?.label}
            </p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
              完成
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step: publishing
  if (step === "publishing") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
            <h2 className="text-lg font-semibold">正在发布...</h2>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${publishProgress}%` }}
              />
            </div>
            <p className="text-gray-500 text-sm">{publishProgress}%</p>
          </div>
        </div>
      </div>
    );
  }

  // Step: preview (full-screen)
  if (step === "preview") {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        <FormatPreview
          chapters={formatPreviews.map((fp) => ({
            number: fp.chapter.number,
            title: fp.chapter.title,
            original: fp.original,
            formatted: fp.formatted,
          }))}
          platformName={PLATFORMS.find((p) => p.id === selectedPlatform)?.label ?? ""}
          onClose={onClose}
          onPublish={() => setStep("confirm")}
        />
      </div>
    );
  }

  // Step: confirm
  if (step === "confirm") {
    const platformCfg = PLATFORMS.find((p) => p.id === selectedPlatform);
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
          <h2 className="text-lg font-semibold mb-4">确认发布</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">平台</span>
              <span className="font-medium">{platformCfg?.label}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">章节数</span>
              <span className="font-medium">{selectedChapters.length} 章</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">起始章节</span>
              <span className="font-medium">第 {selectedChapters[0]} 章</span>
            </div>
          </div>
          {checkResult && !checkResult.ready && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              <div className="flex items-center gap-1.5 font-medium mb-1">
                <AlertTriangle className="w-4 h-4" />
                存在未通过的检查项
              </div>
              <ul className="list-disc pl-5 space-y-0.5">
                {checkResult.checks.filter((c) => !c.passed).map((c, i) => (
                  <li key={i}>{c.message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setStep("preview")}
              className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
            >
              返回预览
            </button>
            <button
              onClick={executePublish}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              确认发布
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Platform selection ──
  if (step === "platform") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold">选择发布平台</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          <div className="space-y-3">
            {PLATFORMS.map((pf) => {
              const isSelected = selectedPlatform === pf.id;
              const passed = checkResult?.ready ?? false;
              return (
                <button
                  key={pf.id}
                  onClick={() => setSelectedPlatform(pf.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{pf.icon}</span>
                      <div>
                        <div className="font-semibold">{pf.label}</div>
                        <div className="text-sm text-gray-500">{pf.description}</div>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-blue-600" />}
                  </div>
                </button>
              );
            })}
          </div>

          {checkResult && (
            <div className="mt-4 space-y-1.5">
              {checkResult.checks.map((c, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs ${
                  c.severity === "error" ? "text-red-600" : "text-yellow-600"
                }`}>
                  {c.severity === "error"
                    ? <XCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  }
                  <span>{c.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setStep("chapters")}
              disabled={!selectedPlatform}
              className={`flex items-center gap-1 px-4 py-2 rounded text-sm transition-colors ${
                selectedPlatform
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              下一步
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Chapter selection ──
  if (step === "chapters") {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold">选择要发布的章节</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>

          <div className="flex items-center gap-2 mb-3 text-sm">
            <button
              onClick={selectAllChapters}
              className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 text-xs"
            >
              全选
            </button>
            <button
              onClick={clearChapterSelection}
              className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 text-xs"
            >
              取消选择
            </button>
            <span className="text-gray-400 text-xs ml-auto">
              已选 {selectedChapters.length} 章
            </span>
          </div>

          <div className="flex-1 overflow-y-auto border rounded">
            {chapterList.map((ch) => {
              const isSelected = selectedChapters.includes(ch.number);
              return (
                <label
                  key={ch.number}
                  className={`flex items-center gap-3 px-4 py-2 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                    isSelected ? "bg-blue-50" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleChapter(ch.number)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">{ch.title || `第${ch.number}章`}</span>
                  <span className="text-xs text-gray-400 ml-auto">{ch.wordCount} 字</span>
                </label>
              );
            })}
          </div>

          <div className="flex justify-between mt-4">
            <button
              onClick={() => setStep("platform")}
              className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
              返回
            </button>
            <button
              onClick={startPreview}
              disabled={selectedChapters.length === 0}
              className={`flex items-center gap-1 px-4 py-2 rounded text-sm transition-colors ${
                selectedChapters.length > 0
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              预览格式
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
