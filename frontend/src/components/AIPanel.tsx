"use client";

import { useState } from "react";
import {
  LucideSparkles, LucideX, LucideLoader2, LucideCopy, LucideCheck,
  LucideAlignLeft, LucideWand2, LucideCheckCheck, LucideListChecks,
  LucideScissors, LucideBriefcase,
} from "lucide-react";

const COMMANDS = [
  { id: "summarize", label: "Summarize", icon: LucideAlignLeft, description: "Bullet-point summary" },
  { id: "expand", label: "Expand", icon: LucideWand2, description: "Add more detail" },
  { id: "grammar", label: "Fix Grammar", icon: LucideCheckCheck, description: "Correct errors" },
  { id: "suggest", label: "Suggest", icon: LucideListChecks, description: "Next steps & improvements" },
  { id: "shorten", label: "Shorten", icon: LucideScissors, description: "Cut 30% of words" },
  { id: "tone", label: "Pro Tone", icon: LucideBriefcase, description: "Make it professional" },
];

interface AIPanelProps {
  getEditorContent: () => string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AIPanel({ getEditorContent, isOpen, onClose }: AIPanelProps) {
  const [apiKey, setApiKey] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeCommand, setActiveCommand] = useState("");

  const runCommand = async (commandId: string) => {
    const content = getEditorContent();
    if (!content.trim()) {
      setError("The editor is empty. Write something first!");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");
    setActiveCommand(commandId);

    try {
      const res = await fetch("http://localhost:5000/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: commandId, content, apiKey }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI request failed");
      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            fontSize: "10px", padding: "2px 6px", borderRadius: "4px",
            background: "rgba(99,102,241,0.2)", color: "rgba(99,102,241,0.9)",
            border: "1px solid rgba(99,102,241,0.3)", fontWeight: "600",
          }}>GEMINI</span>
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
          <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", display: "block", marginBottom: "6px", fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase" }}>
            Gemini API Key (optional if set in .env)
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza..."
            style={{
              width: "100%", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
              padding: "8px 12px", color: "rgba(255,255,255,0.7)",
              fontSize: "12px", outline: "none", boxSizing: "border-box",
            }}
          />
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "4px" }}>
            Get free key at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: "rgba(99,102,241,0.7)" }}>aistudio.google.com</a>
          </p>
        </div>

        {/* Command grid */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", display: "block", marginBottom: "8px", fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase" }}>
            Commands
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {COMMANDS.map(({ id, label, icon: Icon, description }) => (
              <button
                key={id}
                onClick={() => runCommand(id)}
                disabled={loading}
                style={{
                  padding: "10px 12px", borderRadius: "10px", border: "none",
                  background: activeCommand === id && loading
                    ? "rgba(99,102,241,0.2)"
                    : "rgba(255,255,255,0.05)",
                  cursor: loading ? "not-allowed" : "pointer",
                  textAlign: "left", outline: "none",
                  border: "1px solid rgba(255,255,255,0.07)",
                  transition: "all 0.15s ease",
                  boxShadow: activeCommand === id && loading ? "0 0 0 1px rgba(99,102,241,0.4)" : "none",
                } as React.CSSProperties}
                onMouseEnter={(e) => {
                  if (!loading) (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.12)";
                }}
                onMouseLeave={(e) => {
                  if (!loading && activeCommand !== id) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                }}
              >
                <Icon style={{ width: "14px", height: "14px", color: "#8b5cf6", marginBottom: "6px" }} />
                <div style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.85)" }}>{label}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>{description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "14px", borderRadius: "10px",
            background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)",
          }}>
            <LucideLoader2 style={{ width: "16px", height: "16px", color: "#6366f1", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>Thinking with Gemini...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: "12px", borderRadius: "10px",
            background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)",
            fontSize: "12px", color: "rgba(244,63,94,0.8)",
          }}>
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ borderRadius: "10px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 12px",
              background: "rgba(255,255,255,0.04)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Result
              </span>
              <button onClick={copyResult} style={{
                display: "flex", alignItems: "center", gap: "4px",
                background: "none", border: "none", cursor: "pointer",
                color: copied ? "rgba(16,185,129,0.8)" : "rgba(255,255,255,0.3)",
                fontSize: "11px", padding: "2px 6px", borderRadius: "4px",
              }}>
                {copied ? <LucideCheck style={{ width: "12px", height: "12px" }} /> : <LucideCopy style={{ width: "12px", height: "12px" }} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div style={{
              padding: "12px", fontSize: "13px", lineHeight: "1.6",
              color: "rgba(255,255,255,0.75)", whiteSpace: "pre-wrap",
              maxHeight: "300px", overflowY: "auto",
            }}>
              {result}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
