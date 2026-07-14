import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Download, BookOpen, Eye, Check, X as XIcon, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import { fetchJson, useApi } from "../hooks/use-api";
import type { BookConfig } from "@inkchain/inkchain-core";

// ── API response types ──

interface PublishCheckCheck {
  name: string;
  passed: boolean;
  message: string;
}

interface PublishCheckResponse {
  ready: boolean;
  checks: PublishCheckCheck[];
  meta: { title: string; totalChapters: number; totalWords: number };
}

interface PublishExportResponse {
  ok: boolean;
  filename: string;
  content: string;
  contentType: string;
  chapterCount: number;
  totalWords: number;
}

// ── Props ──

interface PublishPageProps {
  readonly bookId: string;
  readonly nav?: { toBook: (bookId: string) => void };
}

// ── Platform descriptions ──

const PLATFORM_INFO: Record<string, { name: string; description: string; status: "ready" | "experimental" | "planned" }> = {
  qidian: { name: "起点中文网", description: "国内最大的原创文学平台，支持 TXT 格式导入", status: "experimental" },
  tomato: { name: "番茄小说", description: "免费阅读平台，支持 TXT/EPUB 格式导入", status: "planned" },
  feilu: { name: "飞卢小说网", description: "付费阅读平台，需适配专属格式", status: "planned" },
  other: { name: "其他平台", description: "通用 TXT 导出格式", status: "experimental" },
};

// ── Component ──

export function PublishPage({ bookId, nav }: PublishPageProps) {
  const { data: bookData } = useApi<{ book: BookConfig }>(`/books/${encodeURIComponent(bookId)}`);
  const [checkResult, setCheckResult] = useState<PublishCheckResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<PublishExportResponse | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState("qidian");

  const platform = bookData?.book?.platform ?? "other";
  const platformInfo = PLATFORM_INFO[selectedPlatform] ?? PLATFORM_INFO.other;

  // Auto-check on mount
  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    setCheckError(null);
    fetchJson<PublishCheckResponse>(`/api/publish/${encodeURIComponent(bookId)}/check`)
      .then((data) => {
        if (!cancelled) setCheckResult(data);
      })
      .catch((err) => {
        if (!cancelled) setCheckError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => { cancelled = true; };
  }, [bookId]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    setExportResult(null);
    try {
      const data = await fetchJson<PublishExportResponse>(`/api/publish/${encodeURIComponent(bookId)}/export`, {
        method: "POST",
      });
      setExportResult(data);
      // Trigger download
      const blob = new Blob([data.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }, [bookId]);

  const title = bookData?.book?.title ?? "加载中…";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => { if (nav?.toBook) nav.toBook(bookId); }}
          className="text-muted-foreground/60 hover:text-foreground transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-serif font-semibold text-foreground">跨平台发布</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            将《{title}》发布到各平台（实验功能）
          </p>
        </div>
      </div>

      {/* Platform selector */}
      <div className="rounded-xl border border-border/40 bg-card p-5">
        <h2 className="text-sm font-medium mb-3">选择目标平台</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(PLATFORM_INFO).map(([key, info]) => (
            <button
              key={key}
              type="button"
              disabled={info.status === "planned"}
              onClick={() => setSelectedPlatform(key)}
              className={cn(
                "rounded-lg border p-3 text-left transition-all text-sm",
                selectedPlatform === key
                  ? "border-primary bg-primary/5"
                  : "border-border/40 hover:border-border",
                info.status === "planned" && "opacity-40 cursor-not-allowed"
              )}
            >
              <div className="font-medium">{info.name}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{info.description}</div>
              <div className={cn(
                "text-[9px] uppercase font-bold mt-1.5 tracking-wider",
                info.status === "ready" && "text-green-500",
                info.status === "experimental" && "text-amber-500",
                info.status === "planned" && "text-muted-foreground/50",
              )}>
                {info.status === "ready" ? "✓ 就绪" : info.status === "experimental" ? "⚡ 实验" : "○ 规划中"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Publishing checklist */}
      <div className="rounded-xl border border-border/40 bg-card p-5">
        <h2 className="text-sm font-medium mb-4">发布检查清单</h2>

        {checking && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            正在检查发布就绪状态…
          </div>
        )}

        {checkError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            检查失败：{checkError}
          </div>
        )}

        {checkResult && (
          <div className="space-y-3">
            {checkResult.checks.map((check, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={cn(
                  "mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0",
                  check.passed ? "bg-green-500/10 text-green-500" : "bg-amber-500/10 text-amber-500"
                )}>
                  {check.passed ? <Check size={12} /> : <AlertCircle size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-medium",
                      check.passed ? "text-foreground" : "text-amber-600"
                    )}>{check.name}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full",
                      check.passed ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"
                    )}>{check.passed ? "通过" : "未通过"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{check.message}</p>
                </div>
              </div>
            ))}

            {/* Summary */}
            <div className="pt-3 border-t border-border/40">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold">{checkResult.meta.totalChapters}</div>
                  <div className="text-[10px] text-muted-foreground">章节数</div>
                </div>
                <div>
                  <div className="text-lg font-semibold">{checkResult.meta.totalWords.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">总字数</div>
                </div>
                <div>
                  <div className={cn(
                    "text-lg font-semibold",
                    checkResult.ready ? "text-green-500" : "text-amber-500"
                  )}>
                    {checkResult.ready ? "就绪" : "待完善"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">发布状态</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export section */}
      <div className="rounded-xl border border-border/40 bg-card p-5">
        <h2 className="text-sm font-medium mb-2">导出操作</h2>
        <p className="text-xs text-muted-foreground mb-4">
          将《{title}》导出为 {platformInfo.name} 兼容的 TXT 格式文件。
          {selectedPlatform === "qidian" && " 起点中文网支持通过作家专区导入 TXT 文件。"}
        </p>

        {exportError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive mb-3">
            导出失败：{exportError}
          </div>
        )}

        {exportResult && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-xs text-green-600 mb-3">
            导出完成！共 {exportResult.chapterCount} 章，约 {exportResult.totalWords.toLocaleString()} 字
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || checkResult === null}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all",
              exporting || !checkResult
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:opacity-90"
            )}
          >
            {exporting ? (
              <><Loader2 size={16} className="animate-spin" /> 导出中…</>
            ) : (
              <><Download size={16} /> 导出 TXT 文件</>
            )}
          </button>

          {/* P2-3: EPUB export */}
          <a
            href={`/api/publish/${encodeURIComponent(bookId)}/export-epub`}
            download
            className="inline-flex items-center gap-2 rounded-lg border border-border/30 bg-card/80 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-all"
          >
            <BookOpen size={16} />
            下载 EPUB
          </a>

          {/* P2-3: HTML preview */}
          <button
            type="button"
            onClick={async () => {
              try {
                const resp = await fetch(`/api/publish/${encodeURIComponent(bookId)}/preview-html`, { method: "POST" });
                if (!resp.ok) throw new Error("预览生成失败");
                const html = await resp.text();
                const win = window.open("", "_blank");
                if (win) {
                  win.document.write(html);
                  win.document.close();
                }
              } catch {
                alert("预览生成失败，请稍后重试");
              }
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border/30 bg-card/80 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-card transition-all"
          >
            <Eye size={16} />
            HTML 预览
          </button>
        </div>
      </div>
    </div>
  );
}
