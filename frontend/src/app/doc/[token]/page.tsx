"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { isLoggedIn, getToken, BACKEND_URL } from "@/lib/auth";
import { LucideLoader2, LucideShieldX, LucideSparkles, LucideChevronRight } from "lucide-react";
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

  const editorRef = useRef<EditorHandle | null>(null);

  const handlePresenceChange = useCallback((users: Presence[]) => setPresence(users), []);
  const handleConnectionChange = useCallback((connected: boolean) => setIsConnected(connected), []);

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

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 10 }}>
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", height: "56px", background: "rgba(8,8,16,0.7)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "28px", height: "28px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800", color: "white", boxShadow: "0 0 12px rgba(99,102,241,0.4)" }}>SF</div>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>Shared Workspace</span>
            <LucideChevronRight style={{ width: "12px", height: "12px", color: "rgba(255,255,255,0.2)" }} />
            <span style={{ color: "rgba(255,255,255,0.9)", fontSize: "13px", fontWeight: "600" }}>{docTitle}</span>
            <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.25)", fontWeight: "600" }}>
              Collaborator View
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Live presence */}
            {presence.length > 0 && (
              <div style={{ display: "flex", alignItems: "center" }}>
                {presence.slice(0, 4).map((user, i) => (
                  <div key={i} title={user.name} style={{ width: "28px", height: "28px", borderRadius: "50%", background: user.color, border: "2px solid #080810", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700", color: "white", marginLeft: i > 0 ? "-8px" : "0", boxShadow: `0 0 10px ${user.color}66`, position: "relative", zIndex: presence.length - i }}>
                    {user.name.slice(0, 2).toUpperCase()}
                  </div>
                ))}
              </div>
            )}

            {/* Connection dot */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "20px", background: isConnected ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)", border: `1px solid ${isConnected ? "rgba(16,185,129,0.2)" : "rgba(244,63,94,0.2)"}` }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: isConnected ? "#10b981" : "#f43f5e", boxShadow: `0 0 6px ${isConnected ? "rgba(16,185,129,0.8)" : "rgba(244,63,94,0.8)"}` }} />
              <span style={{ fontSize: "11px", color: isConnected ? "rgba(16,185,129,0.8)" : "rgba(244,63,94,0.8)", fontWeight: "500" }}>
                {isConnected ? "Live Sync" : "Connecting..."}
              </span>
            </div>

            {/* AI button */}
            <button
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", background: aiPanelOpen ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.07)", border: aiPanelOpen ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.1)", color: aiPanelOpen ? "rgba(139,92,246,0.95)" : "rgba(255,255,255,0.75)", fontSize: "13px", fontWeight: "500", cursor: "pointer", outline: "none", transition: "all 0.15s ease" }}
            >
              <LucideSparkles style={{ width: "13px", height: "13px" }} />
              Gemini AI
            </button>

            <button
              onClick={() => router.push("/")}
              style={{ padding: "7px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: "500", cursor: "pointer", outline: "none" }}
            >
              My Workspace
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
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#ff5f57" }} />
                    <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#febc2e" }} />
                    <div style={{ width: "11px", height: "11px", borderRadius: "50%", background: "#28c840" }} />
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", fontWeight: "500" }}>
                        syncflow · shared channel ({docId.slice(-6)})
                      </span>
                    </div>
                  </div>
                  <div style={{ padding: "24px 32px 32px" }} className="editor-dark-wrapper">
                    {docId && (
                      <Editor
                        key={docId}
                        ref={editorRef}
                        documentId={docId}
                        onPresenceChange={handlePresenceChange}
                        onConnectionChange={handleConnectionChange}
                      />
                    )}
                  </div>
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
