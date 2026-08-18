"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  LucideFileText, LucideSearch, LucideSettings, LucideUsers,
  LucideSparkles, LucideChevronRight, LucideHash, LucidePlus,
  LucideZap, LucideLink2, LucideMoreHorizontal, LucideClock,
  LucideLogOut, LucideCheck,
} from "lucide-react";
import type { Presence } from "@/components/Editor";
import AIPanel from "@/components/AIPanel";
import { isLoggedIn, getUser, getToken, logout, type AuthUser } from "@/lib/auth";
import { BACKEND_URL } from "@/lib/auth";

const Editor = dynamic(() => import("@/components/Editor"), { ssr: false });

const documents = [
  { id: 1, name: "Project Alpha: Q3 Roadmap", active: true, icon: "📄", time: "now" },
  { id: 2, name: "Team Sync Notes", active: false, icon: "📝", time: "2h ago" },
  { id: 3, name: "Design System v2", active: false, icon: "🎨", time: "Yesterday" },
  { id: 4, name: "API Architecture", active: false, icon: "⚙️", time: "2d ago" },
  { id: 5, name: "AI Feature Spec", active: false, icon: "✨", time: "3d ago" },
];

export default function Home() {
  const router = useRouter();
  const [activeDoc, setActiveDoc] = useState(1);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const getEditorContent = useRef<() => string>(() => "");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    setCurrentUser(getUser());
    // Generate a share URL for the default document
    const token = getToken();
    if (token) {
      fetch(`${BACKEND_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: "Project Alpha: Q3 Roadmap" }),
      })
        .then((r) => r.json())
        .then((doc) => {
          if (doc.shareToken) {
            const base = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(":5000", ":3000") || window.location.origin;
            setShareUrl(`${window.location.origin}/doc/${doc.shareToken}`);
          }
        })
        .catch(() => {
          setShareUrl(`${window.location.origin}/doc/demo-link`);
        });
    }
  }, [router]);

  const handlePresenceChange = useCallback((users: Presence[]) => {
    setPresence(users);
  }, []);

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#080810", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div style={{
          position: "absolute", top: "-20%", left: "-10%", width: "50%", height: "60%",
          background: "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
          filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", bottom: "-20%", right: "-10%", width: "45%", height: "55%",
          background: "radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)",
          filter: "blur(40px)",
        }} />
        <div style={{
          position: "absolute", top: "40%", right: "20%", width: "30%", height: "30%",
          background: "radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)",
          filter: "blur(60px)",
        }} />
      </div>

      {/* ─── SIDEBAR ─── */}
      <aside style={{
        width: "260px", minWidth: "260px",
        background: "rgba(255,255,255,0.03)",
        borderRight: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(20px)",
        display: "flex", flexDirection: "column",
        position: "relative", zIndex: 20,
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "32px", height: "32px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 16px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.2)",
              fontSize: "13px", fontWeight: "800", color: "white", letterSpacing: "0.5px",
            }}>SF</div>
            <span style={{ color: "white", fontWeight: "700", fontSize: "15px", letterSpacing: "-0.3px" }}>SyncFlow</span>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 16px" }}>
          <div style={{ position: "relative" }}>
            <LucideSearch style={{ position: "absolute", left: "10px", top: "9px", width: "14px", height: "14px", color: "rgba(255,255,255,0.3)" }} />
            <input type="text" placeholder="Search..." style={{
              width: "100%", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px",
              padding: "7px 10px 7px 32px", color: "rgba(255,255,255,0.7)",
              fontSize: "13px", outline: "none", boxSizing: "border-box",
            }} />
          </div>
        </div>

        {/* Document list */}
        <div style={{ padding: "0 8px", flex: 1, overflowY: "auto" }}>
          <div style={{ padding: "8px 10px 4px", fontSize: "11px", color: "rgba(255,255,255,0.25)", fontWeight: "600", letterSpacing: "0.8px", textTransform: "uppercase" }}>
            Documents
          </div>
          {documents.map((doc) => (
            <button key={doc.id} onClick={() => setActiveDoc(doc.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 10px", borderRadius: "8px", border: "none", cursor: "pointer",
              background: activeDoc === doc.id ? "rgba(99,102,241,0.15)" : "transparent",
              outline: "none", textAlign: "left",
              boxShadow: activeDoc === doc.id ? "inset 0 0 0 1px rgba(99,102,241,0.3)" : "none",
              transition: "all 0.15s ease",
            } as React.CSSProperties}
            onMouseEnter={(e) => { if (activeDoc !== doc.id) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={(e) => { if (activeDoc !== doc.id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: "14px" }}>{doc.icon}</span>
              <span style={{
                flex: 1, fontSize: "13px", fontWeight: activeDoc === doc.id ? "500" : "400",
                color: activeDoc === doc.id ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>{doc.name}</span>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", whiteSpace: "nowrap" }}>{doc.time}</span>
            </button>
          ))}

          <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "12px 4px" }} />

          {[{ icon: LucideUsers, label: "Shared with me" }, { icon: LucideHash, label: "Templates" }].map(({ icon: Icon, label }) => (
            <button key={label} style={{
              width: "100%", display: "flex", alignItems: "center", gap: "8px",
              padding: "7px 10px", borderRadius: "8px", border: "none",
              background: "transparent", cursor: "pointer", outline: "none", textAlign: "left",
            } as React.CSSProperties}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <Icon style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.3)" }} />
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)" }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Bottom status */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "8px 10px", borderRadius: "8px",
            background: isConnected ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)",
            border: `1px solid ${isConnected ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)"}`,
            marginBottom: "8px", transition: "all 0.3s ease",
          }}>
            <div style={{
              width: "7px", height: "7px", borderRadius: "50%",
              background: isConnected ? "#10b981" : "#f43f5e",
              boxShadow: `0 0 8px ${isConnected ? "rgba(16,185,129,0.8)" : "rgba(244,63,94,0.8)"}`,
            }} />
            <span style={{ fontSize: "12px", color: isConnected ? "rgba(16,185,129,0.9)" : "rgba(244,63,94,0.9)", fontWeight: "500" }}>
              {isConnected ? `${presence.length} collaborator${presence.length !== 1 ? "s" : ""} live` : "Connecting..."}
            </span>
          </div>

          {/* User profile row */}
          {currentUser && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 10px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%",
                background: currentUser.avatarColor,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "11px", fontWeight: "700", color: "white",
                boxShadow: `0 0 8px ${currentUser.avatarColor}66`, flexShrink: 0,
              }}>
                {currentUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.name}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.email}</div>
              </div>
              <button onClick={logout} title="Sign out" style={{
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.25)", padding: "4px", borderRadius: "6px",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(244,63,94,0.7)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.25)"; }}
              >
                <LucideLogOut style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ─── MAIN ─── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 10 }}>
        {/* Top Header */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 28px", height: "56px", minHeight: "56px",
          background: "rgba(8,8,16,0.7)", borderBottom: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 30,
        }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.25)" }}>Workspace</span>
            <LucideChevronRight style={{ width: "13px", height: "13px", color: "rgba(255,255,255,0.15)" }} />
            <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.25)" }}>Documents</span>
            <LucideChevronRight style={{ width: "13px", height: "13px", color: "rgba(255,255,255,0.15)" }} />
            <span style={{
              fontSize: "13px", color: "rgba(255,255,255,0.85)", fontWeight: "500",
              background: "rgba(255,255,255,0.07)", padding: "3px 8px",
              borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)",
            }}>Project Alpha</span>
          </div>

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <LucideClock style={{ width: "12px", height: "12px", color: "rgba(255,255,255,0.2)" }} />
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)" }}>Saved just now</span>
            </div>

            {/* Live presence avatars */}
            {presence.length > 0 && (
              <div style={{ display: "flex", alignItems: "center" }}>
                {presence.slice(0, 4).map((user, i) => (
                  <div key={i} title={user.name} style={{
                    width: "28px", height: "28px", borderRadius: "50%",
                    background: user.color, border: "2px solid #080810",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "10px", fontWeight: "700", color: "white",
                    marginLeft: i > 0 ? "-8px" : "0",
                    boxShadow: `0 0 10px ${user.color}66`,
                    cursor: "pointer", zIndex: presence.length - i, position: "relative",
                    outline: user.isTyping ? `2px solid ${user.color}` : "none",
                    outlineOffset: "1px",
                    transition: "outline 0.2s ease",
                  }}>
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                ))}
              </div>
            )}

            {/* AI button */}
            <button
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "7px 14px", borderRadius: "8px",
                background: aiPanelOpen ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.07)",
                border: aiPanelOpen ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)",
                color: aiPanelOpen ? "rgba(139,92,246,0.9)" : "rgba(255,255,255,0.7)",
                fontSize: "13px", fontWeight: "500", cursor: "pointer", outline: "none",
                boxShadow: aiPanelOpen ? "0 0 12px rgba(99,102,241,0.2)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              <LucideSparkles style={{ width: "13px", height: "13px" }} />
              AI
            </button>

            <button onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setLinkCopied(true);
              setTimeout(() => setLinkCopied(false), 2000);
            }} style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px",
              background: linkCopied ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.07)",
              border: linkCopied ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.1)",
              color: linkCopied ? "rgba(16,185,129,0.9)" : "rgba(255,255,255,0.7)",
              fontSize: "13px", fontWeight: "500", cursor: "pointer", outline: "none",
              transition: "all 0.2s ease",
            }}>
              {linkCopied ? <LucideCheck style={{ width: "13px", height: "13px" }} /> : <LucideLink2 style={{ width: "13px", height: "13px" }} />}
              {linkCopied ? "Copied!" : "Copy link"}
            </button>

            <button onClick={() => setShareModalOpen(true)} style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "7px 16px", borderRadius: "8px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              border: "1px solid rgba(99,102,241,0.5)",
              color: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer", outline: "none",
              boxShadow: "0 0 20px rgba(99,102,241,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}>
              <LucideZap style={{ width: "13px", height: "13px" }} />
              Share
            </button>

            <button style={{
              width: "32px", height: "32px", borderRadius: "8px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", outline: "none",
            }}>
              <LucideMoreHorizontal style={{ width: "15px", height: "15px", color: "rgba(255,255,255,0.4)" }} />
            </button>
          </div>
        </header>

        {/* Content row */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Editor scrollable area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "48px 40px" }}>
            <div style={{ maxWidth: "760px", margin: "0 auto" }}>
              {/* Title */}
              <div style={{ marginBottom: "32px", position: "relative" }}>
                <div style={{
                  position: "absolute", left: "-24px", top: "8px",
                  width: "3px", height: "36px", borderRadius: "2px",
                  background: "linear-gradient(180deg, #6366f1, #8b5cf6)",
                  boxShadow: "0 0 12px rgba(99,102,241,0.6)",
                }} />
                <input type="text" defaultValue="Project Alpha: Q3 Roadmap" style={{
                  background: "transparent", border: "none", outline: "none",
                  fontSize: "42px", fontWeight: "800", color: "rgba(255,255,255,0.95)",
                  letterSpacing: "-1.5px", width: "100%", lineHeight: "1.1",
                }} />
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "10px" }}>
                  <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.2)" }}>
                    Syncing in real-time · {presence.length} online
                  </span>
                  {/* Typing indicators */}
                  {presence.filter(u => u.isTyping).map((u, i) => (
                    <span key={i} style={{
                      fontSize: "12px", color: u.color, display: "flex", alignItems: "center", gap: "4px",
                    }}>
                      <span style={{ opacity: 0.8 }}>{u.name}</span>
                      <span style={{ letterSpacing: "2px", animation: "blink 1s infinite" }}>...</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Editor card */}
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", inset: "-1px", borderRadius: "18px",
                  background: "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15), rgba(6,182,212,0.1))",
                  zIndex: 0,
                }} />
                <div style={{
                  position: "relative", zIndex: 1,
                  background: "rgba(15,15,25,0.95)", backdropFilter: "blur(20px)",
                  borderRadius: "17px", overflow: "hidden",
                  boxShadow: "0 8px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
                }}>
                  {/* Window chrome */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                  }}>
                    <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#ff5f57" }} />
                    <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#febc2e" }} />
                    <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#28c840" }} />
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", fontWeight: "500" }}>
                        syncflow · shared document
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: "24px 32px 32px" }} className="editor-dark-wrapper">
                    <Editor
                      onPresenceChange={handlePresenceChange}
                      onConnectionChange={handleConnectionChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Panel */}
          <AIPanel
            getEditorContent={getEditorContent.current}
            isOpen={aiPanelOpen}
            onClose={() => setAiPanelOpen(false)}
          />
        </div>
      </main>

      {/* Share Modal */}
      {shareModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
          onClick={() => setShareModalOpen(false)}
        >
          <div style={{ background: "rgba(15,15,25,0.98)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", padding: "28px", width: "420px", boxShadow: "0 24px 80px rgba(0,0,0,0.7)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(99,102,241,0.4)" }}>
                <LucideZap style={{ width: "16px", height: "16px", color: "white" }} />
              </div>
              <div>
                <div style={{ color: "rgba(255,255,255,0.9)", fontWeight: "700", fontSize: "16px" }}>Share Document</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px" }}>Anyone with this link can collaborate</div>
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "10px 14px", marginBottom: "14px" }}>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>Invite Link</div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", wordBreak: "break-all", lineHeight: "1.5" }}>
                {shareUrl || "Generating link..."}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px", padding: "12px", background: "rgba(99,102,241,0.06)", borderRadius: "10px", border: "1px solid rgba(99,102,241,0.15)" }}>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: "6px" }}>
                <LucideCheck style={{ width: "12px", height: "12px", color: "#10b981" }} /> Only people with this exact link can access
              </div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: "6px" }}>
                <LucideCheck style={{ width: "12px", height: "12px", color: "#10b981" }} /> They must be logged in to SyncFlow
              </div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", gap: "6px" }}>
                <LucideCheck style={{ width: "12px", height: "12px", color: "#10b981" }} /> Edits sync in real-time once they join
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => {
                  if (shareUrl) {
                    navigator.clipboard.writeText(shareUrl);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  }
                }}
                style={{ flex: 1, padding: "11px", borderRadius: "10px", background: shareCopied ? "rgba(16,185,129,0.15)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", border: shareCopied ? "1px solid rgba(16,185,129,0.3)" : "none", color: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", boxShadow: shareCopied ? "none" : "0 0 20px rgba(99,102,241,0.35)", transition: "all 0.2s ease" }}
              >
                {shareCopied ? <LucideCheck style={{ width: "14px", height: "14px" }} /> : <LucideLink2 style={{ width: "14px", height: "14px" }} />}
                {shareCopied ? "Link Copied!" : "Copy Invite Link"}
              </button>
              <button onClick={() => setShareModalOpen(false)} style={{ padding: "11px 18px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontSize: "13px", cursor: "pointer" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::selection { background: rgba(99,102,241,0.3); color: white; }

        .editor-dark-wrapper .bn-editor { background: transparent !important; color: rgba(255,255,255,0.88) !important; }
        .editor-dark-wrapper .bn-block-content { color: rgba(255,255,255,0.88) !important; }
        .editor-dark-wrapper .bn-editor * { color: rgba(255,255,255,0.88) !important; }
        .editor-dark-wrapper [data-node-type="blockContainer"]:hover { background: rgba(255,255,255,0.03) !important; }
        .editor-dark-wrapper [contenteditable]:empty::before { color: rgba(255,255,255,0.2) !important; }
        .editor-dark-wrapper .mantine-Menu-dropdown { background: rgba(20,20,35,0.98) !important; border: 1px solid rgba(255,255,255,0.1) !important; }
        .editor-dark-wrapper .mantine-Menu-item { color: rgba(255,255,255,0.8) !important; }
        .editor-dark-wrapper .mantine-Menu-item:hover { background: rgba(99,102,241,0.15) !important; }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }

        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}
