"use client";

import { useState } from "react";
import {
  LucideSparkles, LucideX, LucideLoader2, LucideCopy, LucideCheck,
  LucideAlignLeft, LucideWand2, LucideCheckCheck, LucideListChecks,
  LucideScissors, LucideBriefcase, LucideLanguages, LucideClipboardList,
} from "lucide-react";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const COMMANDS = [
  { id: "summarize",      label: "Summarize",    icon: LucideAlignLeft,       description: "Bullet-point summary" },
  { id: "expand",         label: "Expand",        icon: LucideWand2,           description: "Add more detail" },
  { id: "grammar",        label: "Fix Grammar",   icon: LucideCheckCheck,      description: "Correct all errors" },
  { id: "suggest",        label: "Suggest",       icon: LucideListChecks,      description: "Next steps & ideas" },
  { id: "shorten",        label: "Shorten",       icon: LucideScissors,        description: "Cut 40% of words" },
  { id: "tone",           label: "Pro Tone",      icon: LucideBriefcase,       description: "Executive polish" },
  { id: "translate_simple", label: "Simplify",   icon: LucideLanguages,       description: "Plain English" },
  { id: "action_items",   label: "Action Items",  icon: LucideClipboardList,   description: "Extract tasks" },
];

interface AIPanelProps {
  getEditorContent: () => string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AIPanel({ getEditorContent, isOpen, onClose }: AIPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeCommand, setActiveCommand] = useState("");

  const runCommand = async (commandId: string) => {
    const content = getEditorContent();
    if (!content.trim()) {
      setError("The editor is empty. Type something first!");
      return;
    }

    setStreaming(true);
    setError("");
    setResult("");
    setActiveCommand(commandId);

    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: commandId, content, apiKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "AI request failed");
      }

      // Read the SSE stream word-by-word
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) throw new Error("No stream reader available");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              setStreaming(false);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.text) {
                setResult((prev) => prev + parsed.text);
              }
            } catch (e: any) {
              if (e.message && !e.message.includes("JSON")) throw e;
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStreaming(false);
    }
  };

  const copyResult = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div style={{
      width: "320px", minWidth: "320px",
      background: "rgba(12,12,22,0.98)",
      borderLeft: "1px solid rgba(255,255,255,0.07)",
      display: "flex", flexDirection: "column",
      backdropFilter: "blur(20px)",
      position: "relative", zIndex: 20,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px",
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
            border: "1px solid rgba(99,102,241,0.3)", fontWeight: "700",
            letterSpacing: "0.3px",
          }}>GEMINI 3.7 FLASH</span>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          color: "rgba(255,255,255,0.3)", padding: "4px", borderRadius: "6px",
        }}>
          <LucideX style={{ width: "15px", height: "15px" }} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {/* API Key input */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{
            fontSize: "11px", color: "rgba(255,255,255,0.3)", display: "block",
            marginBottom: "6px", fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase",
          }}>
            Gemini API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza... (or set GEMINI_API_KEY in .env)"
            style={{
              width: "100%", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
              padding: "8px 12px", color: "rgba(255,255,255,0.7)",
              fontSize: "12px", outline: "none", boxSizing: "border-box",
            }}
          />
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>
            Free key at{" "}
            <a href="https://aistudio.google.com" target="_blank" rel="noreferrer"
              style={{ color: "rgba(99,102,241,0.7)" }}>aistudio.google.com</a>
          </p>
        </div>

        {/* Command grid — 2 columns, 8 commands */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{
            fontSize: "11px", color: "rgba(255,255,255,0.3)", display: "block",
            marginBottom: "8px", fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase",
          }}>
            Commands
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "7px" }}>
            {COMMANDS.map(({ id, label, icon: Icon, description }) => (
              <button
                key={id}
                onClick={() => runCommand(id)}
                disabled={streaming}
                style={{
                  padding: "10px 10px", borderRadius: "10px",
                  background: activeCommand === id && streaming
                    ? "rgba(99,102,241,0.2)"
                    : "rgba(255,255,255,0.05)",
                  cursor: streaming ? "not-allowed" : "pointer",
                  textAlign: "left", outline: "none",
                  border: activeCommand === id && streaming
                    ? "1px solid rgba(99,102,241,0.4)"
                    : "1px solid rgba(255,255,255,0.07)",
                  transition: "all 0.15s ease",
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  if (!streaming) (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.12)";
                }}
                onMouseLeave={(e) => {
                  if (!streaming && activeCommand !== id) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                }}
              >
                <Icon style={{ width: "13px", height: "13px", color: "#8b5cf6", marginBottom: "5px" }} />
                <div style={{ fontSize: "11px", fontWeight: "600", color: "rgba(255,255,255,0.85)" }}>{label}</div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>{description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Streaming indicator */}
        {streaming && !result && (
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "12px 14px", borderRadius: "10px",
            background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
          }}>
            <LucideLoader2 style={{ width: "15px", height: "15px", color: "#6366f1", animation: "spin 1s linear infinite", flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
              Gemini 2.5 Flash is thinking...
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: "12px", borderRadius: "10px",
            background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)",
            fontSize: "12px", color: "rgba(244,63,94,0.8)", lineHeight: "1.5",
          }}>
            {error}
          </div>
        )}

        {/* Streaming result */}
        {result && (
          <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 12px",
              background: "rgba(255,255,255,0.04)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{
                  fontSize: "11px", color: "rgba(255,255,255,0.3)", fontWeight: "600",
                  textTransform: "uppercase", letterSpacing: "0.5px",
                }}>
                  Result
                </span>
                {streaming && (
                  <span style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    background: "#6366f1", display: "inline-block",
                    animation: "pulse-dot 1s ease-in-out infinite",
                  }} />
                )}
              </div>
              <button onClick={copyResult} disabled={streaming} style={{
                display: "flex", alignItems: "center", gap: "4px",
                background: "none", border: "none", cursor: streaming ? "not-allowed" : "pointer",
                color: copied ? "rgba(16,185,129,0.8)" : "rgba(255,255,255,0.3)",
                fontSize: "11px", padding: "2px 6px", borderRadius: "4px",
              }}>
                {copied ? <LucideCheck style={{ width: "12px", height: "12px" }} /> : <LucideCopy style={{ width: "12px", height: "12px" }} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div style={{
              padding: "12px 14px", fontSize: "13px", lineHeight: "1.7",
              color: "rgba(255,255,255,0.78)", whiteSpace: "pre-wrap",
              maxHeight: "320px", overflowY: "auto",
            }}>
              {result}
              {streaming && (
                <span style={{
                  display: "inline-block", width: "2px", height: "14px",
                  background: "#6366f1", marginLeft: "2px", verticalAlign: "text-bottom",
                  animation: "blink-cursor 0.7s step-end infinite",
                }} />
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes blink-cursor {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
