// ── AI Relation Extraction Review Panel (AI-1) ──
// Provides a UI for reviewing, accepting/rejecting/modifying AI-proposed
// character relationships extracted from prose text.

import { useState, useCallback } from "react";
import {
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Check,
  XCircle,
  Pencil,
  ChevronDown,
  ChevronRight,
  FileText,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";
import { postApi } from "../hooks/use-api";

// ── Types ──

export interface RelationProposal {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: string;
  confidence: number;
  evidence: string;
  suggestedAttributes?: {
    closeness?: number;
    trust?: number;
    intensity?: number;
  };
}

interface ExtractionResponse {
  proposals: RelationProposal[];
  sourceChapters: number[];
  sourceCharacters: string[];
  existingRelationsCount: number;
}

// ── Relationship Type Display Config ──

const RELATION_LABELS: Record<string, string> = {
  close_friend: "挚友",
  rival: "敌对",
  alliance: "联盟",
  mentor: "师徒",
  blood: "血缘",
  secret_crush: "暗恋",
};

const RELATION_COLORS: Record<string, string> = {
  close_friend: "#10B981",
  rival: "#EF4444",
  alliance: "#3B82F6",
  mentor: "#8B5CF6",
  blood: "#F59E0B",
  secret_crush: "#EC4899",
};

// ── Props ──

interface RelationExtractionReviewPanelProps {
  bookId: string;
  onClose?: () => void;
}

// ── State ──

type ProposalStatus = "pending" | "accepted" | "rejected";

interface ProposalState extends RelationProposal {
  status: ProposalStatus;
}

// ── Component ──

export function RelationExtractionReviewPanel({
  bookId,
  onClose,
}: RelationExtractionReviewPanelProps) {
  const [prose, setProse] = useState("");
  const [chapterNumbersInput, setChapterNumbersInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<ProposalState[]>([]);
  const [sourceChapters, setSourceChapters] = useState<number[]>([]);
  const [sourceCharacters, setSourceCharacters] = useState<string[]>([]);
  const [expandedProposals, setExpandedProposals] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [modifyingId, setModifyingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    relationshipType: string;
    intensity: number;
    description: string;
  }>({ relationshipType: "close_friend", intensity: 3, description: "" });

  // ── Confidence color helper ──

  const confidenceColor = (score: number): string => {
    if (score >= 0.8) return "text-emerald-600 bg-emerald-50 border-emerald-200";
    if (score >= 0.6) return "text-amber-600 bg-amber-50 border-amber-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  // ── Extract relations handler ──

  const handleExtract = useCallback(async () => {
    if (!prose.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setProposals([]);

    try {
      const chapterNumbers = chapterNumbersInput
        .split(/[,，\s]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n) && n > 0);

      const data = await postApi<ExtractionResponse>(
        `/books/${bookId}/relation-extraction`,
        {
          prose: prose.trim(),
          chapterNumbers,
        },
      );

      setProposals(
        data.proposals.map((p) => ({ ...p, status: "pending" as ProposalStatus })),
      );
      setSourceChapters(data.sourceChapters);
      setSourceCharacters(data.sourceCharacters);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [prose, chapterNumbersInput, bookId]);

  // ── Toggle proposal expansion ──

  const toggleProposal = useCallback((id: string) => {
    setExpandedProposals((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Accept single proposal ──

  const handleAccept = useCallback(async (proposal: ProposalState) => {
    setSaving(true);
    setError(null);
    try {
      await postApi(`/books/${bookId}/relation-extraction/accept`, {
        proposals: [proposal],
      });
      setProposals((prev) =>
        prev.map((p) => (p.id === proposal.id ? { ...p, status: "accepted" as ProposalStatus } : p)),
      );
      setSuccessMessage(`已接受: ${proposal.sourceId} ↔ ${proposal.targetId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [bookId]);

  // ── Reject single proposal ──

  const handleReject = useCallback(async (proposal: ProposalState) => {
    setSaving(true);
    setError(null);
    try {
      await postApi(`/books/${bookId}/relation-extraction/reject`, {
        proposalIds: [proposal.id],
      });
      setProposals((prev) =>
        prev.map((p) => (p.id === proposal.id ? { ...p, status: "rejected" as ProposalStatus } : p)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [bookId]);

  // ── Accept All ──

  const handleAcceptAll = useCallback(async () => {
    const pending = proposals.filter((p) => p.status === "pending");
    if (pending.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      await postApi(`/books/${bookId}/relation-extraction/accept`, {
        proposals: pending,
      });
      setProposals((prev) =>
        prev.map((p) => (p.status === "pending" ? { ...p, status: "accepted" as ProposalStatus } : p)),
      );
      setSuccessMessage(`已批量接受 ${pending.length} 个关系`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [bookId, proposals]);

  // ── Reject All ──

  const handleRejectAll = useCallback(async () => {
    const pending = proposals.filter((p) => p.status === "pending");
    if (pending.length === 0) return;

    setSaving(true);
    setError(null);
    try {
      await postApi(`/books/${bookId}/relation-extraction/reject`, {
        proposalIds: pending.map((p) => p.id),
      });
      setProposals((prev) =>
        prev.map((p) => (p.status === "pending" ? { ...p, status: "rejected" as ProposalStatus } : p)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [bookId, proposals]);

  // ── Start modify ──

  const startModify = useCallback((proposal: ProposalState) => {
    setModifyingId(proposal.id);
    setEditForm({
      relationshipType: proposal.relationshipType,
      intensity: proposal.suggestedAttributes?.intensity ?? 3,
      description: proposal.evidence,
    });
  }, []);

  // ── Submit modify ──

  const handleModifySubmit = useCallback(async () => {
    if (!modifyingId) return;
    const original = proposals.find((p) => p.id === modifyingId);
    if (!original) return;

    setSaving(true);
    setError(null);
    try {
      const modified: ProposalState = {
        ...original,
        relationshipType: editForm.relationshipType,
        suggestedAttributes: {
          ...original.suggestedAttributes,
          intensity: editForm.intensity,
        },
        evidence: editForm.description,
      };

      await postApi(`/books/${bookId}/relation-extraction/accept`, {
        proposals: [modified],
      });

      setProposals((prev) =>
        prev.map((p) =>
          p.id === modifyingId ? { ...modified, status: "accepted" as ProposalStatus } : p,
        ),
      );
      setModifyingId(null);
      setSuccessMessage(`已修改并接受: ${original.sourceId} ↔ ${original.targetId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [modifyingId, proposals, editForm, bookId]);

  // ── Cancel modify ──

  const cancelModify = useCallback(() => {
    setModifyingId(null);
  }, []);

  // ── Key down handler ──

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleExtract();
      }
    },
    [handleExtract],
  );

  // ── Render ──

  const pendingCount = proposals.filter((p) => p.status === "pending").length;
  const acceptedCount = proposals.filter((p) => p.status === "accepted").length;
  const rejectedCount = proposals.filter((p) => p.status === "rejected").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-card border border-border/60 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-lg shadow-sm">
              <Sparkles size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">AI 关系提取</h2>
              <p className="text-[11px] text-muted-foreground/60">
                分析叙事文本，提取角色关系
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Input area */}
          <div className="w-80 border-r border-border/30 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Source text input */}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5 block">
                  叙事文本
                </label>
                <textarea
                  value={prose}
                  onChange={(e) => setProse(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="粘贴小说叙事文本，AI 将分析其中的角色关系…"
                  rows={12}
                  className="w-full px-3 py-2 rounded-xl border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-blue-500/50 resize-none"
                  disabled={loading}
                />
              </div>

              {/* Chapter numbers */}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5 block">
                  章节编号（可选，逗号分隔）
                </label>
                <input
                  type="text"
                  value={chapterNumbersInput}
                  onChange={(e) => setChapterNumbersInput(e.target.value)}
                  placeholder="如：1, 2, 3"
                  className="w-full px-3 py-2 rounded-xl border border-border/40 bg-background text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-blue-500/50"
                  disabled={loading}
                />
              </div>

              {/* Stats */}
              {proposals.length > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20 text-xs text-muted-foreground">
                  <FileText size={14} />
                  <span>
                    共 {proposals.length} 个建议
                    {acceptedCount > 0 && ` · ${acceptedCount} 已接受`}
                    {rejectedCount > 0 && ` · ${rejectedCount} 已拒绝`}
                  </span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 text-destructive text-xs">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">操作失败</p>
                    <p className="text-destructive/70 mt-0.5">{error}</p>
                  </div>
                </div>
              )}

              {/* Success */}
              {successMessage && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/5 text-emerald-600 text-xs">
                  <CheckCircle2 size={14} />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Loader2 size={24} className="animate-spin text-blue-500" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">AI 正在分析角色关系…</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-1">
                      基于叙事文本提取角色互动
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="border-t border-border/30 p-3 space-y-2">
              <button
                type="button"
                onClick={handleExtract}
                disabled={!prose.trim() || loading}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                  prose.trim() && !loading
                    ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                    : "bg-muted-foreground/10 text-muted-foreground/30 cursor-not-allowed",
                )}
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                <span>{loading ? "分析中…" : "提取关系"}</span>
              </button>

              {proposals.length > 0 && pendingCount > 0 && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAcceptAll}
                    disabled={saving}
                    className={cn(
                      "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                      "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
                      saving && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <Check size={14} />
                    接受全部 ({pendingCount})
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectAll}
                    disabled={saving}
                    className={cn(
                      "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                      "bg-red-600 text-white hover:bg-red-700 shadow-sm",
                      saving && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <XCircle size={14} />
                    拒绝全部
                  </button>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground/30 text-center">Ctrl+Enter 发送</p>
            </div>
          </div>

          {/* Right: Proposals list */}
          <div className="flex-1 overflow-y-auto p-4">
            {proposals.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
                <Sparkles size={40} className="opacity-20 mb-3" />
                <p className="text-sm">在左侧粘贴叙事文本，点击"提取关系"</p>
                <p className="text-xs mt-1">AI 将分析角色互动并给出关系建议</p>
              </div>
            )}

            {/* Source info */}
            {proposals.length > 0 && sourceCharacters.length > 0 && (
              <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-secondary/20 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">识别角色：</span>
                {sourceCharacters.join("、")}
                {sourceChapters.length > 0 && (
                  <>
                    <span className="text-muted-foreground/30 mx-1">|</span>
                    <span className="font-medium text-foreground/70">章节：</span>
                    {sourceChapters.join("、")}
                  </>
                )}
              </div>
            )}

            {proposals.map((proposal) => {
              const isExpanded = expandedProposals.has(proposal.id);
              const isAccepted = proposal.status === "accepted";
              const isRejected = proposal.status === "rejected";
              const isModifying = modifyingId === proposal.id;
              const relColor = RELATION_COLORS[proposal.relationshipType] ?? "#6B7280";
              const relLabel = RELATION_LABELS[proposal.relationshipType] ?? proposal.relationshipType;

              if (isModifying) {
                return (
                  <div
                    key={proposal.id}
                    className="mb-3 rounded-xl border border-blue-400/40 bg-blue-50/30 overflow-hidden"
                  >
                    <div className="p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">修改关系</h4>

                      {/* Character pair */}
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <span className="px-2 py-0.5 rounded bg-secondary/30">{proposal.sourceId}</span>
                        <ArrowRight size={14} className="text-muted-foreground/40" />
                        <span className="px-2 py-0.5 rounded bg-secondary/30">{proposal.targetId}</span>
                      </div>

                      {/* Relationship type */}
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1 block">
                          关系类型
                        </label>
                        <select
                          value={editForm.relationshipType}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, relationshipType: e.target.value }))
                          }
                          className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background text-sm focus:outline-none focus:border-blue-500/50"
                        >
                          {Object.entries(RELATION_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Intensity */}
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1 block">
                          强度（1-5）
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={1}
                            max={5}
                            value={editForm.intensity}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, intensity: Number(e.target.value) }))
                            }
                            className="flex-1"
                          />
                          <span className="text-sm font-medium text-foreground w-6 text-center">
                            {editForm.intensity}
                          </span>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1 block">
                          描述/证据
                        </label>
                        <textarea
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm((f) => ({ ...f, description: e.target.value }))
                          }
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-border/40 bg-background text-xs text-foreground resize-none focus:outline-none focus:border-blue-500/50"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleModifySubmit}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
                        >
                          {saving ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={cancelModify}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-border/30 text-muted-foreground hover:bg-secondary/30 transition-all"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={proposal.id}
                  className={cn(
                    "mb-3 rounded-xl border overflow-hidden transition-all",
                    isAccepted && "border-emerald-300 bg-emerald-50/20 opacity-70",
                    isRejected && "border-red-200 bg-red-50/20 opacity-50",
                    !isAccepted && !isRejected && "border-border/20 hover:border-border/40",
                  )}
                >
                  {/* Proposal header (collapsed view) */}
                  <div
                    className={cn(
                      "flex items-center justify-between px-4 py-3",
                      !isRejected && !isAccepted && "cursor-pointer hover:bg-secondary/20 transition-colors",
                    )}
                    onClick={() => {
                      if (!isAccepted && !isRejected) toggleProposal(proposal.id);
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Character pair */}
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground shrink-0">
                        <span>{proposal.sourceId}</span>
                        <ArrowRight size={14} className="text-muted-foreground/40" />
                        <span>{proposal.targetId}</span>
                      </div>

                      {/* Relationship type badge */}
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                        style={{
                          backgroundColor: `${relColor}18`,
                          color: relColor,
                        }}
                      >
                        {relLabel}
                      </span>

                      {/* Confidence */}
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0",
                          confidenceColor(proposal.confidence),
                        )}
                      >
                        {Math.round(proposal.confidence * 100)}%
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {proposal.status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleAccept(proposal);
                            }}
                            disabled={saving}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="接受"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void startModify(proposal);
                            }}
                            disabled={saving}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                            title="修改"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleReject(proposal);
                            }}
                            disabled={saving}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                            title="拒绝"
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      {isAccepted && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 px-2">
                          <Check size={14} />
                          已接受
                        </span>
                      )}
                      {isRejected && (
                        <span className="flex items-center gap-1 text-[11px] text-red-500 px-2">
                          <XCircle size={14} />
                          已拒绝
                        </span>
                      )}

                      {!isAccepted && !isRejected && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleProposal(proposal.id);
                          }}
                          className="p-1 rounded-lg text-muted-foreground/40 hover:text-foreground"
                        >
                          {isExpanded ? (
                            <ChevronDown size={16} />
                          ) : (
                            <ChevronRight size={16} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-3 border-t border-border/10">
                      {/* Evidence */}
                      {proposal.evidence && (
                        <div className="pt-3">
                          <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1">
                            证据原文
                          </p>
                          <blockquote className="text-xs text-foreground/70 italic leading-relaxed bg-secondary/15 rounded-lg p-3 border-l-2 border-blue-400/30">
                            "{proposal.evidence}"
                          </blockquote>
                        </div>
                      )}

                      {/* Suggested attributes */}
                      {proposal.suggestedAttributes && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-1.5">
                            建议属性
                          </p>
                          <div className="flex gap-2">
                            {proposal.suggestedAttributes.closeness !== undefined && (
                              <div className="flex-1 p-2 rounded-lg bg-secondary/20 text-center">
                                <p className="text-[9px] text-muted-foreground/40">亲密度</p>
                                <p className="text-xs font-semibold text-foreground/80">
                                  {proposal.suggestedAttributes.closeness}/5
                                </p>
                              </div>
                            )}
                            {proposal.suggestedAttributes.trust !== undefined && (
                              <div className="flex-1 p-2 rounded-lg bg-secondary/20 text-center">
                                <p className="text-[9px] text-muted-foreground/40">信任度</p>
                                <p className="text-xs font-semibold text-foreground/80">
                                  {proposal.suggestedAttributes.trust}/5
                                </p>
                              </div>
                            )}
                            {proposal.suggestedAttributes.intensity !== undefined && (
                              <div className="flex-1 p-2 rounded-lg bg-secondary/20 text-center">
                                <p className="text-[9px] text-muted-foreground/40">强度</p>
                                <p className="text-xs font-semibold text-foreground/80">
                                  {proposal.suggestedAttributes.intensity}/5
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
