"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { isLoggedIn, getToken, BACKEND_URL } from "@/lib/auth";
import {
  LucideLoader2, LucideShieldX, LucideSparkles, LucideChevronRight,
  LucideLogOut, LucideDownload, LucideFileText, LucideFile, LucideFileCode,
  LucidePrinter, LucideChevronDown
} from "lucide-react";
import dynamic from "next/dynamic";
import type { Presence, EditorHandle } from "@/components/Editor";
import AIPanel from "@/components/AIPanel";

const Editor = dynamic(() => import("@/components/Editor"), { ssr: false });

export default function SharedDocPage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [status, setStatus] = useState<"loading" | "authorized" | "denied" | "notfound">("loading");
  const [docId, setDocId] = useState<string>("");
  const [docTitle, setDocTitle] = useState("Shared Workspace");
  const [presence, setPresence] = useState<Presence[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && zenMode) {
        setZenMode(false);
      }
    };
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [zenMode]);

  const editorRef = useRef<EditorHandle | null>(null);

  const handlePresenceChange = useCallback((users: Presence[]) => setPresence(users), []);
  const handleConnectionChange = useCallback((connected: boolean) => setIsConnected(connected), []);

  const downloadAsMarkdown = () => {
    const text = editorRef.current?.getText() || "";
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(docTitle || "document").replace(/[/\\?%*:|"<>]/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsPlainText = () => {
    const text = editorRef.current?.getText() || "";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(docTitle || "document").replace(/[/\\?%*:|"<>]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsHtml = () => {
    const text = editorRef.current?.getText() || "";
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${docTitle || "SyncFlow Document"}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #080810; color: rgba(255,255,255,0.9); max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
    h1 { color: white; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 24px; }
    pre { background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; white-space: pre-wrap; }
    footer { margin-top: 50px; font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; }
  </style>
</head>
<body>
  <h1>${docTitle || "Untitled Document"}</h1>
  <pre>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
  <footer>Exported from SyncFlow &bull; Created by Lovjyot Singh</footer>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(docTitle || "document").replace(/[/\\?%*:|"<>]/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLeave = async () => {
    if (!confirm(`Are you sure you want to exit collaboration on "${docTitle}"?`)) return;
    try {
      if (docId) {
        await fetch(`${BACKEND_URL}/api/documents/${docId}/leave`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
        });
      }
      router.push("/");
    } catch {
      router.push("/");
    }
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest?.(".header-menu-container")) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace(`/login?redirect=/doc/${token}`);
      return;
    }

    // Validate the share token with the backend
    const validate = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/documents/share/${token}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });

        if (res.status === 404) { setStatus("notfound"); return; }
        if (res.status === 403) { setStatus("denied"); return; }
        if (!res.ok) { setStatus("denied"); return; }

        const text = await res.text();
        if (!text || !text.trim().startsWith("{")) {
          setStatus("denied");
          return;
        }
        const doc = JSON.parse(text);
        setDocId(doc._id);
        setDocTitle(doc.title || "Shared Workspace");
        setStatus("authorized");
      } catch {
        setStatus("denied");
      }
    };

    validate();
  }, [token, router]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#080810" }}>
        <div style={{ textAlign: "center" }}>
          <LucideLoader2 style={{ width: "28px", height: "28px", color: "#6366f1", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px", fontWeight: "500" }}>Verifying access to workspace...</div>
          <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px", marginTop: "4px" }}>Securing real-time collaboration channel</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Access Denied / Not Found ────────────────────────────────────────────────
  if (status === "denied" || status === "notfound") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#080810", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", padding: "40px", maxWidth: "420px" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <LucideShieldX style={{ width: "28px", height: "28px", color: "rgba(244,63,94,0.8)" }} />
          </div>
          <h1 style={{ color: "rgba(255,255,255,0.9)", fontSize: "22px", fontWeight: "700", marginBottom: "10px" }}>
            {status === "notfound" ? "Workspace Not Found" : "Private Workspace"}
          </h1>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px" }}>
            {status === "notfound"
              ? "This invite link doesn't exist or has been deleted by the owner."
              : "This workspace is strictly private. Only users who receive an invite link or direct invitation can view or edit this document."}
          </p>
          <button
            onClick={() => router.push("/")}
            style={{ padding: "11px 24px", borderRadius: "10px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", color: "white", fontSize: "14px", fontWeight: "600", cursor: "pointer", boxShadow: "0 0 20px rgba(99,102,241,0.35)" }}
          >
            Back to My Workspace
          </button>
        </div>
      </div>
    );
  }

  // ── Authorized — render full workspace ──────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#080810", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Ambient orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div style={{ position: "absolute", top: "-20%", left: "-10%", width: "50%", height: "60%", background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-10%", width: "45%", height: "55%", background: "radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)", filter: "blur(40px)" }} />
      </div>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", position: "relative", zIndex: 10, overflow: "hidden" }}>
        {/* Header */}
        <header style={{
          display: zenMode ? "none" : "flex",
          flexWrap: "nowrap",
          alignItems: "center", justifyContent: "space-between",
          padding: "0 24px", height: "56px", minHeight: "56px", background: "rgba(8,8,16,0.85)",
          borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)",
          position: "relative", zIndex: 50,
          gap: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flexShrink: 1 }}>
            <div style={{ width: "26px", height: "26px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", color: "white", boxShadow: "0 0 12px rgba(99,102,241,0.4)", flexShrink: 0 }}>SF</div>
            <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px", fontWeight: "500", flexShrink: 0, whiteSpace: "nowrap" }}>Shared</span>
            <LucideChevronRight style={{ width: "12px", height: "12px", color: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
            <div style={{
              color: "rgba(255,255,255,0.9)", fontSize: "13px", fontWeight: "600",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: "220px", background: "rgba(255,255,255,0.06)", padding: "3px 10px", borderRadius: "7px",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              {docTitle || "Untitled Document"}
            </div>
            <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "6px", background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.25)", fontWeight: "600", flexShrink: 0, whiteSpace: "nowrap" }}>
              Guest
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {/* Live presence */}
            {presence.length > 0 && (
              <div style={{ display: "flex", alignItems: "center" }}>
                {presence.slice(0, 3).map((user, i) => (
                  <div key={i} title={user.name} style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: user.color, border: "2px solid #080810",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "10px", fontWeight: "700", color: "white",
                    marginLeft: i > 0 ? "-7px" : "0",
                    boxShadow: `0 0 8px ${user.color}66`, position: "relative", zIndex: presence.length - i,
                  }}>
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                ))}
                {presence.length > 3 && (
                  <div style={{
                    width: "24px", height: "24px", borderRadius: "50%",
                    background: "rgba(255,255,255,0.12)", border: "2px solid #080810",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "9px", fontWeight: "700", color: "rgba(255,255,255,0.8)",
                    marginLeft: "-6px", zIndex: 0, position: "relative",
                  }}>
                    +{presence.length - 3}
                  </div>
                )}
              </div>
            )}

            {/* Connection dot */}
            <div style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "3px 7px", borderRadius: "6px",
              background: "rgba(255,255,255,0.03)", fontSize: "11px", color: "rgba(255,255,255,0.3)",
              whiteSpace: "nowrap",
            }}>
              <div style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: isConnected ? "#10b981" : "#f43f5e",
                boxShadow: isConnected ? "0 0 6px rgba(16,185,129,0.8)" : "none",
              }} />
              <span>{isConnected ? "Live" : "Offline"}</span>
            </div>

            {/* AI button */}
            <button
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 13px", borderRadius: "8px",
                background: aiPanelOpen ? "rgba(99,102,241,0.22)" : "rgba(255,255,255,0.06)",
                border: aiPanelOpen ? "1px solid rgba(99,102,241,0.45)" : "1px solid rgba(255,255,255,0.09)",
                color: aiPanelOpen ? "#c7d2fe" : "rgba(255,255,255,0.8)",
                fontSize: "12px", fontWeight: "600", cursor: "pointer", outline: "none",
                transition: "all 0.15s ease",
              }}
            >
              <LucideSparkles style={{ width: "13px", height: "13px", color: "#a5b4fc" }} />
              <span>AI</span>
            </button>

            {/* Download Dropdown */}
            <div className="header-menu-container" style={{ position: "relative" }}>
              <button
                onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
                style={{
                  display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "8px",
                  background: downloadMenuOpen ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)",
                  border: downloadMenuOpen ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.85)", fontSize: "12px", fontWeight: "500", cursor: "pointer", outline: "none",
                  transition: "all 0.15s ease",
                }}
              >
                <LucideDownload style={{ width: "13px", height: "13px", color: "#34d399" }} />
                <span>Download</span>
                <LucideChevronDown style={{ width: "11px", height: "11px", opacity: 0.6 }} />
              </button>

              {downloadMenuOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "40px", width: "210px",
                  background: "#121224", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px", padding: "6px", zIndex: 99999,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
                }}>
                  <button
                    onClick={() => { downloadAsMarkdown(); setDownloadMenuOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "8px",
                      padding: "7px 8px", borderRadius: "6px", border: "none",
                      background: "transparent", color: "rgba(255,255,255,0.85)", fontSize: "12px",
                      cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <LucideFileText style={{ width: "13px", height: "13px", color: "#818cf8" }} />
                    <span>Markdown (.md)</span>
                  </button>

                  <button
                    onClick={() => { downloadAsPlainText(); setDownloadMenuOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "8px",
                      padding: "7px 8px", borderRadius: "6px", border: "none",
                      background: "transparent", color: "rgba(255,255,255,0.85)", fontSize: "12px",
                      cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <LucideFile style={{ width: "13px", height: "13px", color: "#94a3b8" }} />
                    <span>Plain Text (.txt)</span>
                  </button>

                  <button
                    onClick={() => { downloadAsHtml(); setDownloadMenuOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "8px",
                      padding: "7px 8px", borderRadius: "6px", border: "none",
                      background: "transparent", color: "rgba(255,255,255,0.85)", fontSize: "12px",
                      cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <LucideFileCode style={{ width: "13px", height: "13px", color: "#38bdf8" }} />
                    <span>Web Page (.html)</span>
                  </button>

                  <button
                    onClick={() => { window.print(); setDownloadMenuOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "8px",
                      padding: "7px 8px", borderRadius: "6px", border: "none",
                      background: "transparent", color: "rgba(255,255,255,0.85)", fontSize: "12px",
                      cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <LucidePrinter style={{ width: "13px", height: "13px", color: "#f59e0b" }} />
                    <span>Print / Save as PDF</span>
                  </button>
                </div>
              )}
            </div>

            {/* Exit Collaboration Button */}
            <button
              onClick={handleLeave}
              title="Exit collaboration and leave this shared workspace"
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "6px 11px", borderRadius: "8px",
                background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)",
                color: "#fca5a5", fontSize: "12px", fontWeight: "500", cursor: "pointer", outline: "none",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.22)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.12)"; }}
            >
              <LucideLogOut style={{ width: "12px", height: "12px", color: "#f43f5e" }} />
              <span>Exit</span>
            </button>

            <button
              onClick={() => router.push("/")}
              style={{
                padding: "6px 11px", borderRadius: "8px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
                color: "rgba(255,255,255,0.75)", fontSize: "12px", fontWeight: "500", cursor: "pointer", outline: "none",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
            >
              Workspace
            </button>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "48px 40px" }}>
            <div style={{ maxWidth: "780px", margin: "0 auto" }}>
              <div style={{ marginBottom: "28px" }}>
                <h1 style={{ fontSize: "38px", fontWeight: "800", color: "rgba(255,255,255,0.95)", letterSpacing: "-1px" }}>{docTitle}</h1>
                <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", marginTop: "8px" }}>
                  Shared collaborative space · {presence.length} active editor{presence.length !== 1 ? "s" : ""} · Real-time Redis state
                </p>
              </div>

              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", inset: "-1px", borderRadius: "18px", background: "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15), rgba(6,182,212,0.1))", zIndex: 0 }} />
                <div style={{ position: "relative", zIndex: 1, background: "rgba(15,15,25,0.95)", backdropFilter: "blur(20px)", borderRadius: "17px", overflow: "hidden", boxShadow: "0 8px 60px rgba(0,0,0,0.5)" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                  }}>
                    {/* Traffic Light Buttons */}
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      {/* Red: Clear Content */}
                      <button
                        onClick={() => {
                          if (confirm("Clear all content in this document?")) {
                            editorRef.current?.clearContent();
                          }
                        }}
                        title="Clear Document Content (Red Dot)"
                        style={{
                          width: "12px", height: "12px", borderRadius: "50%",
                          background: "#ff5f57", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          padding: 0, transition: "all 0.15s ease", outline: "none",
                          boxShadow: "0 0 6px rgba(255,95,87,0.4)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.transform = "scale(1.25)";
                          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 10px rgba(255,95,87,0.9)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 6px rgba(255,95,87,0.4)";
                        }}
                      />

                      {/* Yellow / Orange: Zen Focus Mode */}
                      <button
                        onClick={() => setZenMode(!zenMode)}
                        title={zenMode ? "Exit Zen Focus Mode (Yellow Dot)" : "Toggle Zen Focus Mode (Yellow Dot)"}
                        style={{
                          width: "12px", height: "12px", borderRadius: "50%",
                          background: "#febc2e", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          padding: 0, transition: "all 0.15s ease", outline: "none",
                          boxShadow: zenMode ? "0 0 10px rgba(254,188,46,0.9)" : "0 0 6px rgba(254,188,46,0.4)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.transform = "scale(1.25)";
                          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 10px rgba(254,188,46,0.9)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                          (e.currentTarget as HTMLElement).style.boxShadow = zenMode ? "0 0 10px rgba(254,188,46,0.9)" : "0 0 6px rgba(254,188,46,0.4)";
                        }}
                      />

                      {/* Green: Fullscreen Toggle */}
                      <button
                        onClick={() => {
                          if (!document.fullscreenElement) {
                            document.documentElement.requestFullscreen().catch(() => {});
                            setIsFullscreen(true);
                          } else {
                            document.exitFullscreen().catch(() => {});
                            setIsFullscreen(false);
                          }
                        }}
                        title={isFullscreen ? "Exit Fullscreen (Green Dot)" : "Toggle Fullscreen (Green Dot)"}
                        style={{
                          width: "12px", height: "12px", borderRadius: "50%",
                          background: "#28c840", border: "none", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          padding: 0, transition: "all 0.15s ease", outline: "none",
                          boxShadow: isFullscreen ? "0 0 10px rgba(40,200,64,0.9)" : "0 0 6px rgba(40,200,64,0.4)",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.transform = "scale(1.25)";
                          (e.currentTarget as HTMLElement).style.boxShadow = "0 0 10px rgba(40,200,64,0.9)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                          (e.currentTarget as HTMLElement).style.boxShadow = isFullscreen ? "0 0 10px rgba(40,200,64,0.9)" : "0 0 6px rgba(40,200,64,0.4)";
                        }}
                      />
                    </div>

                    <div style={{ flex: 1, textAlign: "center" }}>
                      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", fontWeight: "500" }}>
                        syncflow · shared channel ({docId.slice(-6)}) {zenMode && "· [Zen Mode Active]"}
                      </span>
                    </div>

                    {zenMode && (
                      <button
                        onClick={() => setZenMode(false)}
                        style={{
                          fontSize: "11px", color: "#febc2e", background: "rgba(254,188,46,0.12)",
                          border: "1px solid rgba(254,188,46,0.3)", borderRadius: "6px",
                          padding: "2px 8px", cursor: "pointer", fontWeight: "600",
                        }}
                      >
                        Exit Zen (Esc)
                      </button>
                    )}
                  </div>
                  <div style={{ padding: "24px 32px 32px" }} className="editor-dark-wrapper">
                    {docId && (
                      <Editor
                        key={docId}
                        ref={editorRef}
                        documentId={docId}
                        onPresenceChange={handlePresenceChange}
                        onConnectionChange={handleConnectionChange}
                        onKicked={(msg) => {
                          alert(msg || "You have been removed from this workspace by the owner.");
                          router.push("/");
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Document Copyright Footer */}
              <div style={{
                marginTop: "48px", paddingTop: "20px",
                borderTop: "1px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                flexWrap: "wrap", gap: "12px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "22px", height: "22px", borderRadius: "6px",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "10px", fontWeight: "800", color: "white",
                    boxShadow: "0 0 10px rgba(99,102,241,0.3)",
                  }}>SF</div>
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", fontWeight: "500" }}>
                    SyncFlow &bull; Real-Time Collaborative Workspace
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
                  &copy; {new Date().getFullYear()} <strong style={{ color: "rgba(255,255,255,0.8)", fontWeight: "600" }}>Lovjyot Singh</strong>. All rights reserved.
                </div>
              </div>
            </div>
          </div>

          <AIPanel
            getEditorContent={() => editorRef.current?.getText() || ""}
            isOpen={aiPanelOpen}
            onClose={() => setAiPanelOpen(false)}
            onInsertContent={(text) => editorRef.current?.insertContent(text)}
          />
        </div>
      </main>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .editor-dark-wrapper .bn-editor { background: transparent !important; color: rgba(255,255,255,0.88) !important; }
        .editor-dark-wrapper .bn-block-content { color: rgba(255,255,255,0.88) !important; }
        .editor-dark-wrapper .bn-editor * { color: rgba(255,255,255,0.88) !important; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
      `}</style>
    </div>
  );
}
