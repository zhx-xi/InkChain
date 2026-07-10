// ── Persona Test Dialog (Per-8) ──
// Popup modal for testing a Persona configuration via instant chat.
// Uses the existing session and agent API.
// Messages are stored in local state and scoped to the current test session.

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Send, Loader2, AlertCircle, Bot, User } from "lucide-react";
import { fetchJson, postApi } from "../hooks/use-api";
import type { AgentRole } from "@actalk/inkchain-core/models/persona-config.js";

// ── Types ──

interface ChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly timestamp: number;
}

interface AgentResponse {
  readonly response?: string;
  readonly error?: string | { code?: string; message?: string };
}

interface SessionResponse {
  readonly session: {
    readonly sessionId: string;
    readonly bookId?: string | null;
    readonly sessionKind?: string;
  };
}

// ── Props ──

interface TestDialogProps {
  readonly agentRole: AgentRole;
  readonly agentLabel: string;
  readonly agentIcon: string;
  readonly agentColor: string;
  readonly onClose: () => void;
}

// ── Helpers ──

let msgIdCounter = 0;
function nextMsgId(): string {
  msgIdCounter += 1;
  return `msg-${Date.now()}-${msgIdCounter}`;
}

// ── Component ──

export function TestDialog({
  agentRole,
  agentLabel,
  agentIcon,
  agentColor,
  onClose,
}: TestDialogProps) {
  const [messages, setMessages] = useState<ReadonlyArray<ChatMessage>>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Create a test session on mount ──

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const data = await postApi<SessionResponse>("/sessions", {
          sessionKind: "test",
          playMode: "standard",
        });
        if (!cancelled) {
          setSessionId(data.session.sessionId);
          setInitializing(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setInitializing(false);
        }
      }
    }

    void init();
    return () => { cancelled = true; };
  }, []);

  // ── Auto-scroll to bottom when messages change ──

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Focus input when session is ready ──

  useEffect(() => {
    if (!initializing && sessionId && inputRef.current) {
      inputRef.current.focus();
    }
  }, [initializing, sessionId]);

  // ── Escape to close ──

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // ── Send message ──

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending || !sessionId) return;

    setInput("");
    setSending(true);
    setError(null);

    // Add user message
    const userMsg: ChatMessage = {
      id: nextMsgId(),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const data = await fetchJson<AgentResponse>("/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: text,
          sessionId,
          sessionKind: "test",
          actionSource: "free-text",
        }),
      });

      const responseText = data.response ?? data.error
        ? (typeof data.error === "string" ? data.error : data.error?.message ?? "未知错误")
        : "(空响应)";

      const assistantMsg: ChatMessage = {
        id: nextMsgId(),
        role: "assistant",
        content: responseText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }, [input, sending, sessionId]);

  // ── Keyboard: Enter to send ──

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }, [handleSend]);

  // ── Render ──

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm fade-in">
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl shadow-primary/10 w-full max-w-lg mx-4 flex flex-col overflow-hidden"
        style={{ height: "600px", maxHeight: "85vh" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-base shadow-sm"
              style={{ backgroundColor: `${agentColor}15` }}
            >
              <span role="img" aria-label={agentLabel}>{agentIcon}</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">测试 {agentLabel}</h3>
              <p className="text-[11px] text-muted-foreground/60">即时对话测试</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Messages ── */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {initializing && (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">创建测试会话…</span>
              </div>
            </div>
          )}

          {!initializing && messages.length === 0 && !error && (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-2 text-center max-w-xs">
                <Bot size={28} className="text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground/50 leading-relaxed">
                  输入测试 Prompt 开始对话
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs shadow-sm mt-1"
                  style={{ backgroundColor: `${agentColor}15` }}
                >
                  <span>{agentIcon}</span>
                </div>
              )}

              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary/60 text-foreground rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>

              {msg.role === "user" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs shadow-sm mt-1">
                  <User size={14} className="text-primary" />
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex gap-3 justify-start">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs shadow-sm mt-1"
                style={{ backgroundColor: `${agentColor}15` }}
              >
                <span>{agentIcon}</span>
              </div>
              <div className="max-w-[75%] rounded-2xl rounded-bl-md px-4 py-2.5 bg-secondary/40">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-[11px] text-muted-foreground/40">思考中…</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 justify-center py-2">
              <AlertCircle size={14} className="text-destructive shrink-0" />
              <span className="text-xs text-destructive">{error}</span>
            </div>
          )}
        </div>

        {/* ── Input ── */}
        <div className="shrink-0 border-t border-border/30 px-4 py-3">
          {!sessionId && !initializing && (
            <div className="flex items-center gap-2 text-xs text-destructive/70 mb-2">
              <AlertCircle size={12} />
              <span>无法创建测试会话，请稍后重试</span>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sessionId ? `输入测试 Prompt…` : "初始化中…"}
              disabled={!sessionId || sending}
              rows={1}
              className="flex-1 resize-none rounded-xl bg-secondary/40 border border-border/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-border/50 disabled:opacity-50 leading-relaxed"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || !sessionId || sending}
              className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0 shadow-sm"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
