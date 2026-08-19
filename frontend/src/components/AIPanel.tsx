"use client";

import { useState, useRef, useEffect } from "react";
import {
  LucideSparkles, LucideX, LucideLoader2, LucideCopy, LucideCheck,
  LucideAlignLeft, LucideWand2, LucideCheckCheck, LucideListChecks,
  LucideScissors, LucideBriefcase, LucideLanguages, LucideClipboardList,
  LucideSend, LucideMessageSquare, LucideZap, LucidePlusCircle,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const COMMANDS = [
  { id: "summarize",        label: "Summarize",     icon: LucideAlignLeft,     description: "Bullet-point summary" },
  { id: "expand",           label: "Expand",         icon: LucideWand2,         description: "Add more detail" },
  { id: "grammar",          label: "Fix Grammar",    icon: LucideCheckCheck,    description: "Correct all errors" },
  { id: "suggest",          label: "Suggest",        icon: LucideListChecks,    description: "Next steps & ideas" },
  { id: "shorten",          label: "Shorten",        icon: LucideScissors,      description: "Cut 40% of words" },
  { id: "tone",             label: "Pro Tone",       icon: LucideBriefcase,     description: "Executive polish" },
  { id: "translate_simple", label: "Simplify",       icon: LucideLanguages,     description: "Plain English" },
  { id: "action_items",     label: "Action Items",   icon: LucideClipboardList, description: "Extract tasks" },
];

interface ChatMessage {
  role: "user" | "ai";
  text: string;
  streaming?: boolean;
}

interface AIPanelProps {
  getEditorContent: () => string;
  isOpen: boolean;
  onClose: () => void;
  onInsertContent?: (text: string) => void;
}

export default function AIPanel({ getEditorContent, isOpen, onClose, onInsertContent }: AIPanelProps) {
  const [tab, setTab] = useState<"commands" | "chat">("commands");

  // Commands tab state
  const [result, setResult] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [cmdError, setCmdError] = useState("");
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);
  const [activeCommand, setActiveCommand] = useState("");

  // Chat tab state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatError, setChatError] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [insertedIdx, setInsertedIdx] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  // ── SSE helper ──────────────────────────────────────────────────────────────
  async function streamSSE(
    endpoint: string,
    body: object,
    onChunk: (text: string) => void,
    onDone: () => void,
    onError: (msg: string) => void,
  ) {
    const res = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let errorMsg = `Request failed (${res.status})`;
      try {
        const text = await res.text();
        if (text.trim().startsWith("{")) {
          const data = JSON.parse(text);
          errorMsg = data.error || data.message || errorMsg;
        } else if (res.status === 502 || res.status === 503 || res.status === 504) {
          errorMsg = "Backend server is waking up (Render cold start). Please try again in 20-30 seconds.";
        } else if (res.status === 404) {
          errorMsg = `AI endpoint not found (404). Please verify backend deployment.`;
        }
      } catch {}
      onError(errorMsg);
      return;
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    if (!reader) { onError("No stream reader"); return; }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") { onDone(); return; }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) { onError(parsed.error); return; }
            if (parsed.text) onChunk(parsed.text);
          } catch {}
        }
      }
    }
    onDone();
  }

  // ── Commands tab ─────────────────────────────────────────────────────────────
  const runCommand = async (commandId: string) => {
    const content = getEditorContent();
    if (!content.trim()) { setCmdError("The editor is empty. Type something first!"); return; }

    setStreaming(true);
    setCmdError("");
    setResult("");
    setActiveCommand(commandId);

    try {
      await streamSSE(
        "/api/ai/stream",
        { command: commandId, content },
        (text) => setResult((p) => p + text),
        () => setStreaming(false),
        (msg) => { setCmdError(msg); setStreaming(false); },
      );
    } catch (err: any) {
      setCmdError(err.message);
      setStreaming(false);
    }
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = (textToInsert: string, isChat?: boolean, index?: number) => {
    if (!textToInsert || !onInsertContent) return;
    onInsertContent(textToInsert);
    if (isChat && index !== undefined) {
      setInsertedIdx(index);
      setTimeout(() => setInsertedIdx(null), 2000);
    } else {
      setInserted(true);
      setTimeout(() => setInserted(false), 2000);
    }
  };

  // ── Chat tab ─────────────────────────────────────────────────────────────────
  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatStreaming) return;

    const userMsg: ChatMessage = { role: "user", text: msg };
    const aiMsg: ChatMessage = { role: "ai", text: "", streaming: true };

    setChatHistory((h) => [...h, userMsg, aiMsg]);
    setChatInput("");
    setChatStreaming(true);
    setChatError("");

    // Build history for context (exclude current streaming message)
    const historyForApi = [...chatHistory, userMsg].map((m) => ({
      role: m.role === "user" ? "user" : "model",
      text: m.text,
    }));

    try {
      await streamSSE(
        "/api/ai/chat/stream",
        { message: msg, history: historyForApi.slice(0, -1) },
        (text) => {
          setChatHistory((h) => {
            const updated = [...h];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              text: updated[updated.length - 1].text + text,
            };
            return updated;
          });
        },
        () => {
          setChatHistory((h) => {
            const updated = [...h];
            updated[updated.length - 1] = { ...updated[updated.length - 1], streaming: false };
            return updated;
          });
          setChatStreaming(false);
        },
        (msg) => {
          setChatError(msg);
          setChatStreaming(false);
          setChatHistory((h) => h.slice(0, -1)); // Remove empty AI message on error
        },
      );
    } catch (err: any) {
      setChatError(err.message);
      setChatStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      width: "360px", minWidth: "360px",
      background: "rgba(12,12,22,0.98)",
      borderLeft: "1px solid rgba(255,255,255,0.07)",
      display: "flex", flexDirection: "column",
      backdropFilter: "blur(20px)",
      position: "relative", zIndex: 20,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "26px", height: "26px", borderRadius: "8px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 12px rgba(99,102,241,0.4)",
          }}>
            <LucideSparkles style={{ width: "13px", height: "13px", color: "white" }} />
          </div>
          <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: "600", fontSize: "14px" }}>AI Assistant</span>
          <span style={{
            fontSize: "9px", padding: "2px 6px", borderRadius: "4px",
            background: "rgba(99,102,241,0.2)", color: "rgba(99,102,241,0.9)",
            border: "1px solid rgba(99,102,241,0.3)", fontWeight: "700", letterSpacing: "0.3px",
          }}>GEMINI 3.5 FLASH-LITE</span>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.3)", padding: "4px", borderRadius: "6px",
        }}>
          <LucideX style={{ width: "15px", height: "15px" }} />
        </button>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: "flex", padding: "10px 16px 0",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        gap: "4px",
      }}>
        {[
          { id: "commands", label: "Commands", icon: LucideZap },
          { id: "chat",     label: "Freeform Chat", icon: LucideMessageSquare },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as "commands" | "chat")}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "6px 12px", borderRadius: "8px 8px 0 0",
              border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600",
              background: tab === id ? "rgba(99,102,241,0.15)" : "transparent",
              color: tab === id ? "rgba(139,92,246,0.9)" : "rgba(255,255,255,0.35)",
              borderBottom: tab === id ? "2px solid rgba(99,102,241,0.6)" : "2px solid transparent",
              transition: "all 0.15s ease",
            }}
          >
            <Icon style={{ width: "12px", height: "12px" }} />
            {label}
          </button>
        ))}
      </div>

      {/* ── COMMANDS TAB ── */}
      {tab === "commands" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px", marginBottom: "14px" }}>
            {COMMANDS.map(({ id, label, icon: Icon, description }) => (
              <button
                key={id}
                onClick={() => runCommand(id)}
                disabled={streaming}
                style={{
                  padding: "10px", borderRadius: "10px",
                  background: activeCommand === id && streaming ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.05)",
                  cursor: streaming ? "not-allowed" : "pointer",
                  textAlign: "left", outline: "none",
                  border: activeCommand === id && streaming
                    ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.07)",
                  transition: "all 0.15s ease",
                } as React.CSSProperties}
                onMouseEnter={(e) => { if (!streaming) (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.12)"; }}
                onMouseLeave={(e) => { if (!streaming && activeCommand !== id) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
              >
                <Icon style={{ width: "13px", height: "13px", color: "#8b5cf6", marginBottom: "5px" }} />
                <div style={{ fontSize: "11px", fontWeight: "600", color: "rgba(255,255,255,0.85)" }}>{label}</div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>{description}</div>
              </button>
            ))}
          </div>

          {streaming && !result && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderRadius: "10px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)" }}>
              <LucideLoader2 style={{ width: "15px", height: "15px", color: "#6366f1", animation: "spin 1s linear infinite", flexShrink: 0 }} />
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Gemini 3.7 Flash is analyzing...</span>
            </div>
          )}

          {cmdError && (
            <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", fontSize: "12px", color: "rgba(244,63,94,0.8)", lineHeight: "1.5" }}>
              {cmdError}
            </div>
          )}

          {result && (
            <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Result</span>
                  {streaming && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#6366f1", display: "inline-block", animation: "pulse-dot 1s ease-in-out infinite" }} />}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {onInsertContent && (
                    <button
                      onClick={() => handleInsert(result)}
                      disabled={streaming}
                      title="Insert directly into document editor"
                      style={{
                        display: "flex", alignItems: "center", gap: "4px",
                        background: inserted ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)",
                        border: inserted ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(99,102,241,0.3)",
                        cursor: streaming ? "not-allowed" : "pointer",
                        color: inserted ? "#10b981" : "#a5b4fc",
                        fontSize: "11px", padding: "3px 7px", borderRadius: "5px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {inserted ? <LucideCheck style={{ width: "11px", height: "11px" }} /> : <LucidePlusCircle style={{ width: "11px", height: "11px" }} />}
                      {inserted ? "Inserted" : "Insert"}
                    </button>
                  )}
                  <button onClick={copyResult} disabled={streaming} style={{ display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: streaming ? "not-allowed" : "pointer", color: copied ? "rgba(16,185,129,0.8)" : "rgba(255,255,255,0.4)", fontSize: "11px", padding: "2px 6px", borderRadius: "4px" }}>
                    {copied ? <LucideCheck style={{ width: "12px", height: "12px" }} /> : <LucideCopy style={{ width: "12px", height: "12px" }} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div style={{ padding: "12px 14px", fontSize: "13px", lineHeight: "1.7", color: "rgba(255,255,255,0.78)", whiteSpace: "pre-wrap", maxHeight: "320px", overflowY: "auto" }}>
                {result}
                {streaming && <span style={{ display: "inline-block", width: "2px", height: "14px", background: "#6366f1", marginLeft: "2px", verticalAlign: "text-bottom", animation: "blink-cursor 0.7s step-end infinite" }} />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CHAT TAB ── */}
      {tab === "chat" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {chatHistory.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 16px" }}>
                <LucideSparkles style={{ width: "24px", height: "24px", color: "rgba(99,102,241,0.5)", margin: "0 auto 10px" }} />
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", fontWeight: "500", marginBottom: "4px" }}>
                  Generate Anything with Gemini
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", lineHeight: "1.5" }}>
                  Code in any language, technical explanations, full documents, or brainstorming.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "16px", justifyContent: "center" }}>
                  {[
                    "Write an auth middleware in Node.js",
                    "Explain WebSocket vs WebRTC",
                    "PostgreSQL schema for SaaS",
                    "Draft an executive pitch summary",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => { setChatInput(suggestion); inputRef.current?.focus(); }}
                      style={{
                        padding: "6px 11px", borderRadius: "20px", border: "1px solid rgba(99,102,241,0.3)",
                        background: "rgba(99,102,241,0.08)", color: "rgba(255,255,255,0.65)",
                        fontSize: "11px", cursor: "pointer", transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.18)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.08)"; }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatHistory.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: "4px" }}>
                <div style={{
                  maxWidth: "92%",
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.25))"
                    : "rgba(255,255,255,0.05)",
                  border: msg.role === "user"
                    ? "1px solid rgba(99,102,241,0.3)"
                    : "1px solid rgba(255,255,255,0.08)",
                  fontSize: "12px", lineHeight: "1.65",
                  color: msg.role === "user" ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.8)",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {msg.text || (msg.streaming ? "" : "...")}
                  {msg.streaming && (
                    <span style={{ display: "inline-block", width: "2px", height: "12px", background: "#6366f1", marginLeft: "2px", verticalAlign: "text-bottom", animation: "blink-cursor 0.7s step-end infinite" }} />
                  )}
                </div>

                {/* AI response action toolbar */}
                {msg.role === "ai" && msg.text && !msg.streaming && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingLeft: "4px" }}>
                    {onInsertContent && (
                      <button
                        onClick={() => handleInsert(msg.text, true, i)}
                        style={{
                          display: "flex", alignItems: "center", gap: "3px",
                          background: insertedIdx === i ? "rgba(16,185,129,0.15)" : "transparent",
                          border: insertedIdx === i ? "1px solid rgba(16,185,129,0.3)" : "none",
                          color: insertedIdx === i ? "#10b981" : "rgba(255,255,255,0.4)",
                          fontSize: "10px", cursor: "pointer", padding: "2px 6px", borderRadius: "4px",
                        }}
                      >
                        {insertedIdx === i ? <LucideCheck style={{ width: "10px", height: "10px" }} /> : <LucidePlusCircle style={{ width: "10px", height: "10px" }} />}
                        {insertedIdx === i ? "Inserted into doc" : "Insert into doc"}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(msg.text);
                        setCopiedIdx(i);
                        setTimeout(() => setCopiedIdx(null), 2000);
                      }}
                      style={{
                        display: "flex", alignItems: "center", gap: "3px",
                        background: "transparent", border: "none",
                        color: copiedIdx === i ? "#10b981" : "rgba(255,255,255,0.4)",
                        fontSize: "10px", cursor: "pointer", padding: "2px 6px", borderRadius: "4px",
                      }}
                    >
                      {copiedIdx === i ? <LucideCheck style={{ width: "10px", height: "10px" }} /> : <LucideCopy style={{ width: "10px", height: "10px" }} />}
                      {copiedIdx === i ? "Copied" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {chatError && (
              <div style={{ padding: "10px 12px", borderRadius: "10px", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", fontSize: "12px", color: "rgba(244,63,94,0.8)" }}>
                {chatError}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", background: "rgba(255,255,255,0.05)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.09)", padding: "8px 8px 8px 12px" }}>
              <textarea
                ref={inputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Gemini anything... (Enter to send, Shift+Enter for newline)"
                rows={1}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: "rgba(255,255,255,0.85)", fontSize: "12px", lineHeight: "1.5",
                  resize: "none", maxHeight: "96px", overflowY: "auto", fontFamily: "inherit",
                }}
              />
              <button
                onClick={sendChat}
                disabled={chatStreaming || !chatInput.trim()}
                style={{
                  width: "30px", height: "30px", borderRadius: "8px", flexShrink: 0,
                  background: chatStreaming || !chatInput.trim() ? "rgba(99,102,241,0.2)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  border: "none", cursor: chatStreaming || !chatInput.trim() ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: !chatStreaming && chatInput.trim() ? "0 0 12px rgba(99,102,241,0.4)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {chatStreaming
                  ? <LucideLoader2 style={{ width: "13px", height: "13px", color: "#6366f1", animation: "spin 1s linear infinite" }} />
                  : <LucideSend style={{ width: "13px", height: "13px", color: "white" }} />}
              </button>
            </div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "6px", textAlign: "center" }}>
              Powered by Gemini 3.7 Flash · Insert directly into document
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.7); } }
        @keyframes blink-cursor { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
