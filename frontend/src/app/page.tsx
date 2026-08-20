"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import JSZip from "jszip";
import {
  LucideSearch, LucideUsers,
  LucideSparkles, LucideChevronRight, LucidePlus,
  LucideZap, LucideLink2, LucideMoreHorizontal, LucideClock,
  LucideLogOut, LucideCheck, LucideTrash2, LucideDownload,
  LucideFileText, LucideUserPlus, LucideRotateCcw, LucideShield,
  LucideUserMinus, LucideUserX, LucideRefreshCw, LucideLock,
  LucideFolder, LucideFolderPlus, LucideUpload, LucidePrinter,
  LucideArchive, LucideFile, LucideChevronDown, LucideFileCode,
} from "lucide-react";
import type { Presence, EditorHandle } from "@/components/Editor";
import AIPanel from "@/components/AIPanel";
import { isLoggedIn, getUser, getToken, logout, type AuthUser, BACKEND_URL } from "@/lib/auth";

const Editor = dynamic(() => import("@/components/Editor"), { ssr: false });

export interface DocumentItem {
  _id: string;
  title: string;
  owner: string;
  collaborators?: string[];
  shareToken: string;
  updatedAt?: string;
}

export interface CollaboratorUser {
  _id: string;
  name: string;
  email: string;
  avatarColor: string;
}

export default function Home() {
  const router = useRouter();

  // Document states
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [docFilter, setDocFilter] = useState<"all" | "shared">("all");
  const [docTitle, setDocTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [lastSaved, setLastSaved] = useState("Just now");

  // User & Presence
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // UI Modals & Dropdowns
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [presenceMenuOpen, setPresenceMenuOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [zenMode, setZenMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && zenMode) {
        setZenMode(false);
        setToastMessage("Zen Mode Deactivated");
        setTimeout(() => setToastMessage(null), 2500);
      }
    };
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest?.(".header-menu-container")) {
        setOpenMenuOpen(false);
        setMoreMenuOpen(false);
        setPresenceMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [zenMode]);

  // Join Document states
  const [joinInput, setJoinInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");

  // Share / Collaborator states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [collaboratorsList, setCollaboratorsList] = useState<{
    owner?: CollaboratorUser;
    collaborators?: CollaboratorUser[];
    invitedEmails?: string[];
  }>({});

  // Document Stats
  const [editorText, setEditorText] = useState("");

  const editorRef = useRef<EditorHandle | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Auth & Initial Data Fetch ───────────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const text = await res.text();
        const data: DocumentItem[] = text && text.trim().startsWith("[") ? JSON.parse(text) : [];
        if (data.length > 0) {
          setDocuments(data);
          setActiveDocId((prev) => prev || data[0]._id);
          setDocTitle((prev) => prev || data[0].title);
        } else {
          // Create initial document for new user
          const createRes = await fetch(`${BACKEND_URL}/api/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ title: "Welcome to SyncFlow" }),
          });
          if (createRes.ok) {
            const createText = await createRes.text();
            if (createText && createText.trim().startsWith("{")) {
              const newDoc = JSON.parse(createText);
              setDocuments([newDoc]);
              setActiveDocId(newDoc._id);
              setDocTitle(newDoc.title);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching documents:", err);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    setCurrentUser(getUser());
    fetchDocuments();
  }, [router, fetchDocuments]);

  // Update active document title when activeDocId changes
  useEffect(() => {
    const current = documents.find((d) => d._id === activeDocId);
    if (current) {
      setDocTitle(current.title);
    }
  }, [activeDocId, documents]);

  // Fetch collaborators when share modal opens
  useEffect(() => {
    if (shareModalOpen && activeDocId) {
      const token = getToken();
      if (!token) return;
      fetch(`${BACKEND_URL}/api/documents/${activeDocId}/collaborators`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : {}))
        .then((data) => setCollaboratorsList(data))
        .catch(() => {});
    }
  }, [shareModalOpen, activeDocId]);

  // ── Document Management ─────────────────────────────────────────────────────
  const createNewDocument = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: "Untitled Workspace" }),
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith("{")) {
          const newDoc: DocumentItem = JSON.parse(text);
          setDocuments((prev) => [newDoc, ...prev]);
          setActiveDocId(newDoc._id);
          setDocTitle(newDoc.title);
        }
      }
    } catch (err) {
      console.error("Error creating document:", err);
    }
  };

  const handleTitleChange = (newTitle: string) => {
    setDocTitle(newTitle);
    setSavingTitle(true);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(async () => {
      const token = getToken();
      if (!token || !activeDocId) return;
      try {
        await fetch(`${BACKEND_URL}/api/documents/${activeDocId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: newTitle }),
        });
        setDocuments((prev) =>
          prev.map((d) => (d._id === activeDocId ? { ...d, title: newTitle } : d))
        );
        setSavingTitle(false);
        setLastSaved("Just now");
      } catch {
        setSavingTitle(false);
      }
    }, 600);
  };

  const deleteActiveDocument = async () => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    const token = getToken();
    if (!token || !activeDocId) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents/${activeDocId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const remaining = documents.filter((d) => d._id !== activeDocId);
        setDocuments(remaining);
        if (remaining.length > 0) {
          setActiveDocId(remaining[0]._id);
          setDocTitle(remaining[0].title);
        } else {
          createNewDocument();
        }
        setMoreMenuOpen(false);
      }
    } catch (err) {
      console.error("Error deleting document:", err);
    }
  };

  const handleLeaveDocument = async (docIdToLeave?: string) => {
    const targetId = docIdToLeave || activeDocId;
    if (!targetId) return;
    const targetDoc = documents.find((d) => d._id === targetId);
    const title = targetDoc?.title || "this shared workspace";
    if (!confirm(`Are you sure you want to exit collaboration and leave "${title}"?`)) return;

    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/documents/${targetId}/leave`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const remaining = documents.filter((d) => d._id !== targetId);
        setDocuments(remaining);
        setToastMessage(`Left "${title}" successfully`);
        setTimeout(() => setToastMessage(null), 4000);

        if (targetId === activeDocId) {
          if (remaining.length > 0) {
            setActiveDocId(remaining[0]._id);
            setDocTitle(remaining[0].title);
          } else {
            createNewDocument();
          }
        }
        setMoreMenuOpen(false);
        setShareModalOpen(false);
      } else {
        const text = await res.text();
        const err = text && text.trim().startsWith("{") ? JSON.parse(text) : {};
        alert(err.message || "Failed to leave workspace");
      }
    } catch {
      alert("Network error leaving workspace");
    }
  };

  const handleRemoveCollaborator = async (userId: string, userName: string) => {
    if (!activeDocId) return;
    if (!confirm(`Kick ${userName} from this workspace?`)) return;

    // 1. Fire instant real-time socket kick to kick them off the screen immediately
    editorRef.current?.kickUser({ targetUserId: userId, targetName: userName });

    // 2. Remove locally from presence
    setPresence((prev) => prev.filter((p) => p.userId !== userId && p.name !== userName));

    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/documents/${activeDocId}/collaborators/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setCollaboratorsList((prev) => ({
          ...prev,
          collaborators: prev.collaborators?.filter((c) => c._id !== userId) || [],
        }));
        setToastMessage(`Kicked ${userName} from workspace`);
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        const text = await res.text();
        const err = text && text.trim().startsWith("{") ? JSON.parse(text) : {};
        alert(err.message || "Failed to remove collaborator");
      }
    } catch {
      alert("Network error removing collaborator");
    }
  };

  const handleKickPresenceUser = async (user: Presence) => {
    if (!activeDocId) return;
    if (user.userId === currentUser?.id || user.name === currentUser?.name) return;
    if (!confirm(`Kick ${user.name} from this workspace right now?`)) return;

    // 1. Kick via real-time socket
    editorRef.current?.kickUser({
      targetSocketId: user.socketId,
      targetUserId: user.userId,
      targetName: user.name,
    });

    // 2. Remove from presence locally
    setPresence((prev) => prev.filter((p) => (user.socketId ? p.socketId !== user.socketId : p.name !== user.name)));
    setToastMessage(`Kicked ${user.name} from workspace`);
    setTimeout(() => setToastMessage(null), 3000);

    // 3. If registered user, delete from DB
    if (user.userId) {
      const token = getToken();
      if (token) {
        try {
          await fetch(`${BACKEND_URL}/api/documents/${activeDocId}/collaborators/${user.userId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          setCollaboratorsList((prev) => ({
            ...prev,
            collaborators: prev.collaborators?.filter((c) => c._id !== user.userId) || [],
          }));
        } catch {}
      }
    }
  };

  const handleRevokeShareLink = async () => {
    if (!activeDocId) return;
    if (!confirm("Revoke this share link? Anyone with the old link will no longer be able to join.")) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents/${activeDocId}/revoke-link`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const text = await res.text();
        const data = text && text.trim().startsWith("{") ? JSON.parse(text) : {};
        if (data.shareToken) {
          setDocuments((prev) =>
            prev.map((d) => (d._id === activeDocId ? { ...d, shareToken: data.shareToken } : d))
          );
        }
        setToastMessage("Share link revoked & new link generated");
        setTimeout(() => setToastMessage(null), 3500);
      } else {
        alert("Failed to revoke share link");
      }
    } catch {
      alert("Network error revoking share link");
    }
  };

  const handleAdminExitCollab = async () => {
    if (!activeDocId) return;
    if (!confirm("End collaboration session? This will kick all collaborators, revoke the share link, and make this workspace private.")) return;
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents/${activeDocId}/kick-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const text = await res.text();
        const data = text && text.trim().startsWith("{") ? JSON.parse(text) : {};
        setCollaboratorsList((prev) => ({ ...prev, collaborators: [] }));
        if (data.shareToken) {
          setDocuments((prev) =>
            prev.map((d) => (d._id === activeDocId ? { ...d, shareToken: data.shareToken, collaborators: [] } : d))
          );
        }
        setToastMessage("Ended collaboration: all collaborators kicked & workspace is now private");
        setTimeout(() => setToastMessage(null), 4000);
        setMoreMenuOpen(false);
        setShareModalOpen(false);
      } else {
        alert("Failed to end collaboration session");
      }
    } catch {
      alert("Network error ending collaboration");
    }
  };

  const exportMarkdown = () => {
    const text = editorRef.current?.getText() || "";
    const blob = new Blob([`# ${docTitle}\n\n${text}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docTitle.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setMoreMenuOpen(false);
  };

  // ── Invite Collaborator ─────────────────────────────────────────────────────
  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeDocId) return;
    setInviting(true);
    setInviteSuccess("");
    const token = getToken();
    try {
      const res = await fetch(`${BACKEND_URL}/api/documents/${activeDocId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const text = await res.text();
      const data = text && text.trim().startsWith("{") ? JSON.parse(text) : {};
      if (res.ok) {
        setInviteSuccess(data.message || "Invite sent!");
        setInviteEmail("");
        // Refresh collaborators
        fetch(`${BACKEND_URL}/api/documents/${activeDocId}/collaborators`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((r) => r.text())
          .then((t) => (t && t.trim().startsWith("{") ? JSON.parse(t) : {}))
          .then((d) => setCollaboratorsList(d))
          .catch(() => {});
      } else {
        setInviteSuccess(data.message || "Failed to send invite");
      }
    } catch {
      setInviteSuccess("Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  // ── Join Workspace by Share Link / Token ───────────────────────────────────
  const handleJoinDocument = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const raw = joinInput.trim();
    if (!raw) return;

    setJoining(true);
    setJoinError("");
    setJoinSuccess("");

    // Extract token from full URL (e.g. https://domain.com/doc/TOKEN), relative URL (/doc/TOKEN), or raw token
    let token = raw;
    const docMatch = raw.match(/\/doc\/([a-zA-Z0-9_-]+)/);
    if (docMatch && docMatch[1]) {
      token = docMatch[1];
    } else {
      token = raw.split("?")[0].split("#")[0].replace(/^\/+|\/+$/g, "");
    }

    const authToken = getToken();
    if (!authToken) {
      setJoinError("You must be signed in to join a workspace.");
      setJoining(false);
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/documents/share/${token}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (res.status === 404) {
        setJoinError("Workspace not found or invite link has expired.");
        setJoining(false);
        return;
      }
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        setJoinError("Backend server is waking up. Please retry in a few seconds.");
        setJoining(false);
        return;
      }

      const text = await res.text();
      if (!res.ok) {
        let errMsg = "Failed to join workspace.";
        try {
          if (text.trim().startsWith("{")) {
            const errData = JSON.parse(text);
            errMsg = errData.message || errMsg;
          }
        } catch {}
        setJoinError(errMsg);
        setJoining(false);
        return;
      }

      if (!text || !text.trim().startsWith("{")) {
        setJoinError("Invalid server response. Please try again.");
        setJoining(false);
        return;
      }

      const joinedDoc: DocumentItem = JSON.parse(text);

      setDocuments((prev) => {
        const exists = prev.some((d) => d._id === joinedDoc._id);
        if (exists) {
          return prev.map((d) => (d._id === joinedDoc._id ? joinedDoc : d));
        }
        return [joinedDoc, ...prev];
      });

      setActiveDocId(joinedDoc._id);
      setDocTitle(joinedDoc.title || "Shared Workspace");
      setJoinSuccess(`Joined "${joinedDoc.title || "Shared Workspace"}" successfully!`);
      setToastMessage(`Joined "${joinedDoc.title || "Shared Workspace"}" as collaborator`);
      setTimeout(() => setToastMessage(null), 4000);

      setTimeout(() => {
        setJoinModalOpen(false);
        setJoinInput("");
        setJoinSuccess("");
      }, 700);
    } catch {
      setJoinError("Network error. Please check your connection.");
    } finally {
      setJoining(false);
    }
  };

  // ── Import / Export (Files & Folders) ───────────────────────────────────────
  const processImportedFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const token = getToken();
    if (!token) return;

    let importedCount = 0;
    let lastCreatedDocId: string | null = null;
    let lastCreatedDocTitle: string | null = null;
    let lastCreatedContent: string | null = null;

    for (const file of files) {
      if (file.name.startsWith(".") || file.name === "Thumbs.db" || file.name === "desktop.ini") continue;
      
      try {
        const text = await file.text();
        const cleanTitle = (file.webkitRelativePath || file.name).replace(/^\/+/, "");

        const res = await fetch(`${BACKEND_URL}/api/documents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: cleanTitle }),
        });

        if (res.ok) {
          const newDoc: DocumentItem = await res.json();
          importedCount++;
          lastCreatedDocId = newDoc._id;
          lastCreatedDocTitle = newDoc.title;
          lastCreatedContent = text;
        }
      } catch (err) {
        console.error("Error importing file:", file.name, err);
      }
    }

    if (importedCount > 0) {
      await fetchDocuments();
      if (lastCreatedDocId) {
        setActiveDocId(lastCreatedDocId);
        if (lastCreatedDocTitle) setDocTitle(lastCreatedDocTitle);
        if (lastCreatedContent) {
          setTimeout(() => {
            editorRef.current?.setContent(lastCreatedContent!);
          }, 300);
        }
      }
      setToastMessage(`Imported ${importedCount} file${importedCount !== 1 ? "s" : ""} into workspace`);
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processImportedFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processImportedFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processImportedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const downloadAsMarkdown = () => {
    const text = editorRef.current?.getText() || "";
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(docTitle || "document").replace(/[/\\?%*:|"<>]/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setToastMessage(`Downloaded "${docTitle || "document"}.md"`);
    setTimeout(() => setToastMessage(null), 2500);
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
    setToastMessage(`Downloaded "${docTitle || "document"}.txt"`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const downloadAsHtml = () => {
    const text = editorRef.current?.getText() || "";
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle || "SyncFlow Document"}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #080810; color: rgba(255,255,255,0.9); max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
    h1 { color: white; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; margin-bottom: 24px; font-size: 28px; }
    pre { background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; }
    footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; color: rgba(255,255,255,0.4); text-align: center; }
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
    setToastMessage(`Downloaded "${docTitle || "document"}.html"`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const downloadWorkspaceZip = async () => {
    try {
      setToastMessage("Generating workspace ZIP archive...");
      const zip = new JSZip();
      const currentText = editorRef.current?.getText() || "";

      // Add each document to the zip
      for (const doc of documents) {
        const safeName = (doc.title || "Untitled").replace(/[/\\?%*:|"<>]/g, "-");
        if (doc._id === activeDocId) {
          zip.file(`${safeName}.md`, currentText);
        } else {
          zip.file(`${safeName}.md`, `# ${doc.title}\n\n*Document ID: ${doc._id}*\n*Exported from SyncFlow Workspace*`);
        }
      }

      // Add README
      zip.file(
        "README.md",
        `# SyncFlow Workspace Export\n\n- **Exported at**: ${new Date().toLocaleString()}\n- **Total Documents**: ${documents.length}\n- **Author / Creator**: Lovjyot Singh\n\n*Generated by SyncFlow Real-Time Collaborative Platform.*`
      );

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `syncflow-workspace-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setToastMessage("Workspace ZIP downloaded successfully!");
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      alert("Failed to generate ZIP archive");
    }
  };

  // ── Filtered Documents ──────────────────────────────────────────────────────
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (docFilter === "shared") {
      return doc.owner !== currentUser?.id;
    }
    return true;
  });

  const activeDoc = documents.find((d) => d._id === activeDocId);
  const isOwner = activeDoc ? activeDoc.owner === currentUser?.id : true;
  const isCollaborator = activeDoc ? !isOwner : false;
  const shareUrl = typeof window !== "undefined" && activeDoc
    ? `${window.location.origin}/doc/${activeDoc.shareToken}`
    : "";

  const wordCount = editorText.trim() ? editorText.trim().split(/\s+/).length : 0;
  const charCount = editorText.length;

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{ background: "#080810", fontFamily: "'Inter', system-ui, sans-serif" }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      {/* Hidden File & Folder Inputs for Workspace import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        style={{ display: "none" }}
        multiple
        accept=".md,.txt,.json,.csv,.js,.ts,.tsx,.jsx,.html,.css,.py,.java,.cpp,.c,.rs,.go,.sh,.yaml,.yml,.xml,.sql"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderInputChange}
        style={{ display: "none" }}
        {...({ webkitdirectory: "", directory: "", multiple: true } as any)}
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(10,10,25,0.92)", backdropFilter: "blur(20px)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          border: "3px dashed rgba(99,102,241,0.7)", pointerEvents: "none",
        }}>
          <div style={{
            width: "84px", height: "84px", borderRadius: "24px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 50px rgba(99,102,241,0.7)", marginBottom: "24px",
          }}>
            <LucideUpload style={{ width: "38px", height: "38px", color: "white" }} />
          </div>
          <h2 style={{ color: "white", fontSize: "26px", fontWeight: "800", marginBottom: "8px", letterSpacing: "-0.5px" }}>
            Drop Files or Folders Here
          </h2>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>
            SyncFlow will automatically open and import them into your workspace
          </p>
        </div>
      )}

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
      </div>

      {/* ─── SIDEBAR ─── */}
      <aside style={{
        width: zenMode ? "0px" : "260px",
        minWidth: zenMode ? "0px" : "260px",
        background: "rgba(10,10,20,0.85)",
        borderRight: zenMode ? "none" : "1px solid rgba(255,255,255,0.07)",
        display: zenMode ? "none" : "flex",
        flexDirection: "column",
        backdropFilter: "blur(20px)",
        position: "relative", zIndex: 20,
        transition: "all 0.3s ease",
      }}>
        {/* Workspace Brand Header */}
        <div style={{
          padding: "16px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "8px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", fontWeight: "900", color: "white",
              boxShadow: "0 0 16px rgba(99,102,241,0.5)",
            }}>SF</div>
            <span style={{ color: "white", fontWeight: "700", fontSize: "14px", letterSpacing: "-0.3px" }}>SyncFlow</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={() => setJoinModalOpen(true)}
              title="Join shared document via link"
              style={{
                padding: "4px 8px", borderRadius: "7px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#a5b4fc", display: "flex", alignItems: "center", gap: "4px",
                fontSize: "11px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
            >
              <LucideLink2 style={{ width: "12px", height: "12px", color: "#a5b4fc" }} />
              <span>Join</span>
            </button>

            <button
              onClick={createNewDocument}
              title="Create new document"
              style={{
                width: "28px", height: "28px", borderRadius: "7px",
                background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                color: "#a5b4fc", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.3)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)"; }}
            >
              <LucidePlus style={{ width: "15px", height: "15px" }} />
            </button>
          </div>
        </div>

        {/* Real-time Search */}
        <div style={{ padding: "12px 14px 6px" }}>
          <div style={{ position: "relative" }}>
            <LucideSearch style={{ position: "absolute", left: "10px", top: "9px", width: "13px", height: "13px", color: "rgba(255,255,255,0.3)" }} />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%", background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px",
                padding: "7px 10px 7px 30px", color: "rgba(255,255,255,0.8)",
                fontSize: "12px", outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Quick File & Folder Actions */}
        <div style={{ display: "flex", gap: "5px", padding: "0 14px 10px" }}>
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Open & import local file(s) into workspace"
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
              padding: "6px 4px", borderRadius: "7px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.75)", fontSize: "11px", fontWeight: "500", cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)"; (e.currentTarget as HTMLElement).style.color = "#a5b4fc"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)"; }}
          >
            <LucideUpload style={{ width: "12px", height: "12px", color: "#818cf8" }} />
            <span>Open File</span>
          </button>

          <button
            onClick={() => folderInputRef.current?.click()}
            title="Open & batch-import entire local folder"
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
              padding: "6px 4px", borderRadius: "7px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.75)", fontSize: "11px", fontWeight: "500", cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)"; (e.currentTarget as HTMLElement).style.color = "#a5b4fc"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)"; }}
          >
            <LucideFolderPlus style={{ width: "12px", height: "12px", color: "#38bdf8" }} />
            <span>Open Folder</span>
          </button>

          <button
            onClick={downloadWorkspaceZip}
            title="Download entire workspace as a ZIP archive"
            style={{
              padding: "6px 8px", borderRadius: "7px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.75)", fontSize: "11px", fontWeight: "500", cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.15)"; (e.currentTarget as HTMLElement).style.color = "#6ee7b7"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.75)"; }}
          >
            <LucideArchive style={{ width: "12px", height: "12px", color: "#34d399" }} />
          </button>
        </div>

        {/* Document Filter Tabs */}
        <div style={{ display: "flex", gap: "4px", padding: "0 14px 6px" }}>
          <button
            onClick={() => setDocFilter("all")}
            style={{
              flex: 1, padding: "5px 0", borderRadius: "6px", border: "none",
              background: docFilter === "all" ? "rgba(255,255,255,0.08)" : "transparent",
              color: docFilter === "all" ? "white" : "rgba(255,255,255,0.35)",
              fontSize: "11px", fontWeight: "600", cursor: "pointer",
            }}
          >
            All Docs ({documents.length})
          </button>
          <button
            onClick={() => setDocFilter("shared")}
            style={{
              flex: 1, padding: "5px 0", borderRadius: "6px", border: "none",
              background: docFilter === "shared" ? "rgba(255,255,255,0.08)" : "transparent",
              color: docFilter === "shared" ? "white" : "rgba(255,255,255,0.35)",
              fontSize: "11px", fontWeight: "600", cursor: "pointer",
            }}
          >
            Shared with me
          </button>
        </div>

        {/* Dynamic Document list */}
        <div style={{ padding: "4px 8px", flex: 1, overflowY: "auto" }}>
          {filteredDocuments.length === 0 ? (
            <div style={{ padding: "24px 10px", textAlign: "center" }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", marginBottom: "8px" }}>
                {searchQuery ? "No matching documents" : docFilter === "shared" ? "No shared documents yet" : "No documents found"}
              </div>
              {docFilter === "shared" && !searchQuery && (
                <button
                  onClick={() => setJoinModalOpen(true)}
                  style={{
                    padding: "6px 12px", borderRadius: "6px",
                    background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)",
                    color: "#a5b4fc", fontSize: "11px", fontWeight: "600", cursor: "pointer",
                  }}
                >
                  Join via Share Link
                </button>
              )}
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <button
                key={doc._id}
                onClick={() => setActiveDocId(doc._id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 10px", borderRadius: "8px", border: "none", cursor: "pointer",
                  background: activeDocId === doc._id ? "rgba(99,102,241,0.18)" : "transparent",
                  outline: "none", textAlign: "left",
                  boxShadow: activeDocId === doc._id ? "inset 0 0 0 1px rgba(99,102,241,0.35)" : "none",
                  transition: "all 0.15s ease",
                  marginBottom: "2px",
                } as React.CSSProperties}
                onMouseEnter={(e) => { if (activeDocId !== doc._id) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { if (activeDocId !== doc._id) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <LucideFileText style={{ width: "14px", height: "14px", color: activeDocId === doc._id ? "#818cf8" : "rgba(255,255,255,0.35)", flexShrink: 0 }} />
                <span style={{
                  flex: 1, fontSize: "13px", fontWeight: activeDocId === doc._id ? "500" : "400",
                  color: activeDocId === doc._id ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{doc.title}</span>
                {doc.owner !== currentUser?.id && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "9px", padding: "1px 5px", borderRadius: "4px", background: "rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
                      Shared
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLeaveDocument(doc._id);
                      }}
                      title="Exit collaboration and remove from your list"
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "rgba(244,63,94,0.6)", padding: "2px 4px", borderRadius: "4px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#f43f5e"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(244,63,94,0.6)"; }}
                    >
                      <LucideLogOut style={{ width: "11px", height: "11px" }} />
                    </button>
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Bottom User profile & status */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "7px 10px", borderRadius: "8px",
            background: isConnected ? "rgba(16,185,129,0.08)" : "rgba(244,63,94,0.08)",
            border: `1px solid ${isConnected ? "rgba(16,185,129,0.18)" : "rgba(244,63,94,0.18)"}`,
            marginBottom: "8px",
          }}>
            <div style={{
              width: "6px", height: "6px", borderRadius: "50%",
              background: isConnected ? "#10b981" : "#f43f5e",
              boxShadow: `0 0 8px ${isConnected ? "rgba(16,185,129,0.8)" : "rgba(244,63,94,0.8)"}`,
            }} />
            <span style={{ fontSize: "11px", color: isConnected ? "rgba(16,185,129,0.9)" : "rgba(244,63,94,0.9)", fontWeight: "500" }}>
              {isConnected ? `${presence.length} live in workspace` : "Connecting..."}
            </span>
          </div>

          {currentUser && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 6px" }}>
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
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.name}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentUser.email}</div>
              </div>
              <button onClick={logout} title="Sign out" style={{
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.3)", padding: "4px", borderRadius: "6px",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(244,63,94,0.8)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.3)"; }}
              >
                <LucideLogOut style={{ width: "14px", height: "14px" }} />
              </button>
            </div>
          )}

          {/* Sidebar copyright */}
          <div style={{
            marginTop: "10px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)",
            textAlign: "center", fontSize: "10px", color: "rgba(255,255,255,0.3)",
          }}>
            &copy; {new Date().getFullYear()} <span style={{ color: "rgba(255,255,255,0.6)", fontWeight: "600" }}>Lovjyot Singh</span>
          </div>
        </div>
      </aside>

      {/* ─── MAIN WORKSPACE ─── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", position: "relative", zIndex: 10, overflow: "hidden" }}>
        {/* Top Header */}
        <header style={{
          display: zenMode ? "none" : "flex",
          flexWrap: "nowrap",
          alignItems: "center", justifyContent: "space-between",
          padding: "0 24px", height: "56px", minHeight: "56px",
          background: "rgba(8,8,16,0.85)", borderBottom: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(20px)", position: "relative", zIndex: 50,
          gap: "16px",
        }}>
          {/* Left: Breadcrumb & Save Status */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flexShrink: 1 }}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", fontWeight: "500", whiteSpace: "nowrap" }}>Workspace</span>
            <LucideChevronRight style={{ width: "12px", height: "12px", color: "rgba(255,255,255,0.15)", flexShrink: 0 }} />
            <div style={{
              fontSize: "13px", color: "rgba(255,255,255,0.9)", fontWeight: "600",
              background: "rgba(255,255,255,0.06)", padding: "3px 10px",
              borderRadius: "7px", border: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              maxWidth: "240px",
            }}>
              {docTitle || "Untitled"}
            </div>

            {/* Sync status indicator */}
            <div style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "3px 7px", borderRadius: "6px",
              background: "rgba(255,255,255,0.03)", fontSize: "11px", color: "rgba(255,255,255,0.3)",
              flexShrink: 0, whiteSpace: "nowrap",
            }} title={savingTitle ? "Saving changes to server..." : `Last saved ${lastSaved}`}>
              <div style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: isConnected ? "#10b981" : "#f59e0b",
                boxShadow: isConnected ? "0 0 6px rgba(16,185,129,0.8)" : "none",
              }} />
              <span>{savingTitle ? "Saving..." : "Saved"}</span>
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            {/* Live presence avatar stack */}
            {presence.length > 0 && (
              <div className="header-menu-container" style={{ position: "relative" }}>
                <div
                  onClick={() => setPresenceMenuOpen(!presenceMenuOpen)}
                  style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
                  title="Click to view online users and manage collaborators"
                >
                  {presence.slice(0, 3).map((user, i) => (
                    <div key={i} title={user.name} style={{
                      width: "28px", height: "28px", borderRadius: "50%",
                      background: user.color, border: "2px solid #080810",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "10px", fontWeight: "700", color: "white",
                      marginLeft: i > 0 ? "-7px" : "0",
                      boxShadow: `0 0 8px ${user.color}66`,
                      zIndex: presence.length - i, position: "relative",
                      outline: user.isTyping ? `2px solid ${user.color}` : "none",
                      outlineOffset: "1px",
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

                {presenceMenuOpen && (
                  <div style={{
                    position: "absolute", right: 0, top: "40px", width: "260px",
                    background: "#121224", border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "12px", padding: "10px", zIndex: 99999,
                    boxShadow: "0 20px 60px rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
                  }}>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: "600", textTransform: "uppercase", marginBottom: "8px" }}>
                      Active in Room ({presence.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "180px", overflowY: "auto" }}>
                      {presence.map((user, idx) => {
                        const isSelf = user.userId === currentUser?.id || user.name === currentUser?.name;
                        return (
                          <div key={idx} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "6px 8px", borderRadius: "8px", background: "rgba(255,255,255,0.03)",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{
                                width: "22px", height: "22px", borderRadius: "50%",
                                background: user.color, display: "flex", alignItems: "center",
                                justifyContent: "center", fontSize: "10px", fontWeight: "700", color: "white",
                              }}>
                                {user.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.9)", fontWeight: "500" }}>
                                {user.name} {isSelf && <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>(You)</span>}
                              </div>
                            </div>
                            {isOwner && !isSelf && (
                              <button
                                onClick={() => handleKickPresenceUser(user)}
                                title={`Kick ${user.name} from workspace`}
                                style={{
                                  display: "flex", alignItems: "center", gap: "4px",
                                  padding: "3px 8px", borderRadius: "6px",
                                  background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)",
                                  color: "#fca5a5", fontSize: "10px", fontWeight: "600",
                                  cursor: "pointer", transition: "all 0.15s ease",
                                }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.3)"; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.15)"; }}
                              >
                                <LucideUserMinus style={{ width: "10px", height: "10px", color: "#f43f5e" }} />
                                <span>Kick</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Assistant Pill */}
            <button
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 13px", borderRadius: "8px",
                background: aiPanelOpen ? "rgba(99,102,241,0.22)" : "rgba(255,255,255,0.06)",
                border: aiPanelOpen ? "1px solid rgba(99,102,241,0.45)" : "1px solid rgba(255,255,255,0.09)",
                color: aiPanelOpen ? "#c7d2fe" : "rgba(255,255,255,0.8)",
                fontSize: "12px", fontWeight: "600", cursor: "pointer", outline: "none",
                boxShadow: aiPanelOpen ? "0 0 12px rgba(99,102,241,0.3)" : "none",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.18)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = aiPanelOpen ? "rgba(99,102,241,0.22)" : "rgba(255,255,255,0.06)"; }}
            >
              <LucideSparkles style={{ width: "13px", height: "13px", color: "#a5b4fc" }} />
              <span>AI</span>
            </button>

            {/* Unified Files & Export Dropdown */}
            <div className="header-menu-container" style={{ position: "relative" }}>
              <button
                onClick={() => { setOpenMenuOpen(!openMenuOpen); setMoreMenuOpen(false); setPresenceMenuOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "8px",
                  background: openMenuOpen ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)",
                  border: openMenuOpen ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(255,255,255,0.09)",
                  color: "rgba(255,255,255,0.85)", fontSize: "12px", fontWeight: "500", cursor: "pointer", outline: "none",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = openMenuOpen ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.06)"; }}
              >
                <LucideFolder style={{ width: "13px", height: "13px", color: "#38bdf8" }} />
                <span>Files</span>
                <LucideChevronDown style={{ width: "11px", height: "11px", opacity: 0.6 }} />
              </button>

              {openMenuOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "40px", width: "230px",
                  background: "#121224", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px", padding: "6px", zIndex: 99999,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
                }}>
                  <div style={{ padding: "4px 8px", fontSize: "10px", color: "rgba(255,255,255,0.35)", fontWeight: "700", textTransform: "uppercase" }}>
                    Open & Import
                  </div>
                  <button
                    onClick={() => { fileInputRef.current?.click(); setOpenMenuOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "8px",
                      padding: "7px 8px", borderRadius: "6px", border: "none",
                      background: "transparent", color: "rgba(255,255,255,0.85)", fontSize: "12px",
                      cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <LucideUpload style={{ width: "13px", height: "13px", color: "#818cf8" }} />
                    <span>Open File(s)</span>
                  </button>

                  <button
                    onClick={() => { folderInputRef.current?.click(); setOpenMenuOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "8px",
                      padding: "7px 8px", borderRadius: "6px", border: "none",
                      background: "transparent", color: "rgba(255,255,255,0.85)", fontSize: "12px",
                      cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <LucideFolderPlus style={{ width: "13px", height: "13px", color: "#38bdf8" }} />
                    <span>Open Folder</span>
                  </button>

                  <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />

                  <div style={{ padding: "4px 8px", fontSize: "10px", color: "rgba(255,255,255,0.35)", fontWeight: "700", textTransform: "uppercase" }}>
                    Download Document
                  </div>
                  <button
                    onClick={() => { downloadAsMarkdown(); setOpenMenuOpen(false); }}
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
                    onClick={() => { downloadAsPlainText(); setOpenMenuOpen(false); }}
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
                    onClick={() => { downloadAsHtml(); setOpenMenuOpen(false); }}
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
                    onClick={() => { window.print(); setOpenMenuOpen(false); }}
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

                  <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />

                  <button
                    onClick={() => { downloadWorkspaceZip(); setOpenMenuOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "8px",
                      padding: "7px 8px", borderRadius: "6px", border: "none",
                      background: "rgba(16,185,129,0.1)", color: "#6ee7b7", fontSize: "12px", fontWeight: "600",
                      cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.2)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.1)"; }}
                  >
                    <LucideArchive style={{ width: "13px", height: "13px", color: "#34d399" }} />
                    <span>Export Entire Workspace (.zip)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Share Button (Opens full collaboration & kick modal) */}
            <button
              onClick={() => setShareModalOpen(true)}
              style={{
                display: "flex", alignItems: "center", gap: "5px", padding: "6px 14px", borderRadius: "8px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "1px solid rgba(99,102,241,0.5)",
                color: "white", fontSize: "12px", fontWeight: "600", cursor: "pointer", outline: "none",
                boxShadow: "0 0 16px rgba(99,102,241,0.35)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(99,102,241,0.6)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 16px rgba(99,102,241,0.35)"; }}
            >
              <LucideZap style={{ width: "12px", height: "12px" }} />
              <span>Share</span>
            </button>

            {/* More Options Dropdown */}
            <div className="header-menu-container" style={{ position: "relative" }}>
              <button
                onClick={() => { setMoreMenuOpen(!moreMenuOpen); setOpenMenuOpen(false); setPresenceMenuOpen(false); }}
                style={{
                  width: "30px", height: "30px", borderRadius: "8px",
                  background: moreMenuOpen ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", outline: "none",
                }}
              >
                <LucideMoreHorizontal style={{ width: "14px", height: "14px", color: "rgba(255,255,255,0.7)" }} />
              </button>

              {moreMenuOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "40px", width: "230px",
                  background: "#121224", border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px", padding: "6px", zIndex: 99999,
                  boxShadow: "0 20px 60px rgba(0,0,0,0.85)", backdropFilter: "blur(20px)",
                }}>
                  <div style={{ padding: "6px 8px", fontSize: "10px", color: "rgba(255,255,255,0.3)", fontWeight: "600", textTransform: "uppercase" }}>
                    Stats: {wordCount} words · {charCount} chars
                  </div>

                  <button
                    onClick={() => { setJoinModalOpen(true); setMoreMenuOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "8px",
                      padding: "7px 8px", borderRadius: "6px", border: "none",
                      background: "transparent", color: "rgba(255,255,255,0.85)", fontSize: "12px",
                      cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <LucideUserPlus style={{ width: "13px", height: "13px", color: "#a5b4fc" }} />
                    <span>Join Shared Workspace</span>
                  </button>

                  <button
                    onClick={() => {
                      if (shareUrl) {
                        navigator.clipboard.writeText(shareUrl);
                        setLinkCopied(true);
                        setToastMessage("Invite link copied to clipboard");
                        setTimeout(() => setToastMessage(null), 2500);
                        setMoreMenuOpen(false);
                      }
                    }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "8px",
                      padding: "7px 8px", borderRadius: "6px", border: "none",
                      background: "transparent", color: "rgba(255,255,255,0.85)", fontSize: "12px",
                      cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <LucideLink2 style={{ width: "13px", height: "13px", color: "#38bdf8" }} />
                    <span>Copy Secret Invite Link</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm("Clear all editor content?")) {
                        editorRef.current?.clearContent();
                        setToastMessage("Document content cleared");
                        setTimeout(() => setToastMessage(null), 2000);
                        setMoreMenuOpen(false);
                      }
                    }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: "8px",
                      padding: "7px 8px", borderRadius: "6px", border: "none",
                      background: "transparent", color: "rgba(255,255,255,0.85)", fontSize: "12px",
                      cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.15)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <LucideRotateCcw style={{ width: "13px", height: "13px", color: "#fbbf24" }} />
                    <span>Clear Document Content</span>
                  </button>

                  <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "4px 0" }} />

                  {isCollaborator ? (
                    <button
                      onClick={() => { handleLeaveDocument(); setMoreMenuOpen(false); }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: "8px",
                        padding: "7px 8px", borderRadius: "6px", border: "none",
                        background: "transparent", color: "#f43f5e", fontSize: "12px",
                        cursor: "pointer", textAlign: "left",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.15)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <LucideLogOut style={{ width: "13px", height: "13px" }} />
                      <span>Exit Collaboration</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => { handleAdminExitCollab(); setMoreMenuOpen(false); }}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: "8px",
                          padding: "7px 8px", borderRadius: "6px", border: "none",
                          background: "transparent", color: "#fbbf24", fontSize: "12px",
                          cursor: "pointer", textAlign: "left",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(251,191,36,0.12)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <LucideUserX style={{ width: "13px", height: "13px" }} />
                        <span>End Collaboration (Kick All)</span>
                      </button>

                      <button
                        onClick={() => { deleteActiveDocument(); setMoreMenuOpen(false); }}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: "8px",
                          padding: "7px 8px", borderRadius: "6px", border: "none",
                          background: "transparent", color: "#f43f5e", fontSize: "12px",
                          cursor: "pointer", textAlign: "left",
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.15)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <LucideTrash2 style={{ width: "13px", height: "13px" }} />
                        <span>Delete Document</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Editor & AI Panel Split */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Editor scrollable area */}
          <div style={{ flex: 1, overflowY: "auto", padding: "48px 40px" }}>
            <div style={{ maxWidth: "780px", margin: "0 auto" }}>
              {/* Dynamic Editable Title */}
              <div style={{ marginBottom: "32px", position: "relative" }}>
                <div style={{
                  position: "absolute", left: "-24px", top: "8px",
                  width: "3px", height: "36px", borderRadius: "2px",
                  background: "linear-gradient(180deg, #6366f1, #8b5cf6)",
                  boxShadow: "0 0 12px rgba(99,102,241,0.6)",
                }} />
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Untitled Document"
                  style={{
                    background: "transparent", border: "none", outline: "none",
                    fontSize: "38px", fontWeight: "800", color: "rgba(255,255,255,0.95)",
                    letterSpacing: "-1.2px", width: "100%", lineHeight: "1.1",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "10px" }}>
                  <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
                    Syncing in real-time · {presence.length} collaborator{presence.length !== 1 ? "s" : ""} online
                  </span>
                  {presence.filter((u) => u.isTyping).map((u, i) => (
                    <span key={i} style={{ fontSize: "12px", color: u.color, display: "flex", alignItems: "center", gap: "4px" }}>
                      <span>{u.name} is typing</span>
                      <span style={{ animation: "blink 1s infinite" }}>...</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Editor Surface */}
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
                  <div style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                  }}>
                    {/* Interactive Traffic Light Buttons */}
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      {/* Red: Clear Content */}
                      <button
                        onClick={() => {
                          if (confirm("Clear all content in this document?")) {
                            editorRef.current?.clearContent();
                            setToastMessage("Document content cleared");
                            setTimeout(() => setToastMessage(null), 2500);
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
                        onClick={() => {
                          const next = !zenMode;
                          setZenMode(next);
                          setToastMessage(next ? "Zen Focus Mode Activated (Press Esc or click yellow dot to exit)" : "Zen Focus Mode Deactivated");
                          setTimeout(() => setToastMessage(null), 3500);
                        }}
                        title={zenMode ? "Exit Zen Focus Mode (Yellow Dot)" : "Toggle Zen Focus Mode (Distraction-Free) (Yellow Dot)"}
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
                        title={isFullscreen ? "Exit Browser Fullscreen (Green Dot)" : "Toggle Browser Fullscreen (Green Dot)"}
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
                      <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", fontWeight: "500" }}>
                        syncflow · {activeDocId ? `doc:${activeDocId.slice(-6)}` : "isolated workspace"} {zenMode && "· [Zen Mode Active]"}
                      </span>
                    </div>

                    {zenMode && (
                      <button
                        onClick={() => {
                          setZenMode(false);
                          setToastMessage("Zen Mode Deactivated");
                          setTimeout(() => setToastMessage(null), 2000);
                        }}
                        style={{
                          fontSize: "11px", color: "#febc2e", background: "rgba(254,188,46,0.12)",
                          border: "1px solid rgba(254,188,46,0.3)", borderRadius: "6px",
                          padding: "3px 8px", cursor: "pointer", fontWeight: "600",
                        }}
                      >
                        Exit Zen (Esc)
                      </button>
                    )}
                  </div>

                  <div style={{ padding: "24px 32px 32px" }} className="editor-dark-wrapper">
                    {activeDocId ? (
                      <Editor
                        key={activeDocId}
                        ref={editorRef}
                        documentId={activeDocId}
                        onPresenceChange={setPresence}
                        onConnectionChange={setIsConnected}
                        onChangeContent={setEditorText}
                        onKicked={(msg?: string) => {
                          alert(msg || "You have been removed from this workspace by the owner.");
                          const token = getToken();
                          if (token) {
                            fetch(`${BACKEND_URL}/api/documents/user/me`, {
                              headers: { Authorization: `Bearer ${token}` },
                            })
                              .then((r) => (r.ok ? r.json() : []))
                              .then((docs) => {
                                if (Array.isArray(docs) && docs.length > 0) {
                                  setDocuments(docs);
                                  setActiveDocId(docs[0]._id);
                                  setDocTitle(docs[0].title);
                                } else {
                                  createNewDocument();
                                }
                              })
                              .catch(() => createNewDocument());
                          }
                        }}
                      />
                    ) : (
                      <div style={{ color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "40px 0" }}>
                        Loading document...
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Main Document Copyright Footer */}
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

          {/* AI Panel with Direct Insertion & Freeform Chat */}
          <AIPanel
            getEditorContent={() => editorRef.current?.getText() || ""}
            isOpen={aiPanelOpen}
            onClose={() => setAiPanelOpen(false)}
            onInsertContent={(text) => editorRef.current?.insertContent(text)}
          />
        </div>
      </main>

      {/* ── Real Share & Collaborators Modal ── */}
      {shareModalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
          }}
          onClick={() => setShareModalOpen(false)}
        >
          <div
            style={{
              background: "rgba(15,15,25,0.98)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "20px", padding: "28px", width: "440px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(99,102,241,0.4)" }}>
                <LucideZap style={{ width: "16px", height: "16px", color: "white" }} />
              </div>
              <div>
                <div style={{ color: "rgba(255,255,255,0.95)", fontWeight: "700", fontSize: "16px" }}>Share Workspace</div>
                <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "12px" }}>Invite friends & collaborators securely</div>
              </div>
            </div>

            {/* Collaborator Leave Banner */}
            {isCollaborator && (
              <div style={{
                background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)",
                borderRadius: "10px", padding: "10px 14px", marginBottom: "16px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px",
              }}>
                <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.8)" }}>
                  You are collaborating on this workspace.
                </span>
                <button
                  onClick={() => handleLeaveDocument()}
                  style={{
                    padding: "5px 10px", borderRadius: "6px",
                    background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)",
                    color: "#fca5a5", fontSize: "11px", fontWeight: "600", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "4px",
                  }}
                >
                  <LucideLogOut style={{ width: "11px", height: "11px" }} />
                  Leave Workspace
                </button>
              </div>
            )}

            {/* Invite by Email */}
            <form onSubmit={sendInvite} style={{ marginBottom: "18px" }}>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "6px", fontWeight: "600", textTransform: "uppercase" }}>
                Invite by Email / Username
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="email"
                  placeholder="friend@domain.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{
                    flex: 1, background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)", borderRadius: "9px",
                    padding: "9px 12px", color: "rgba(255,255,255,0.9)",
                    fontSize: "13px", outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  style={{
                    padding: "9px 16px", borderRadius: "9px",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none", color: "white", fontSize: "13px", fontWeight: "600",
                    cursor: inviting || !inviteEmail.trim() ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  <LucideUserPlus style={{ width: "13px", height: "13px" }} />
                  {inviting ? "Inviting..." : "Invite"}
                </button>
              </div>
              {inviteSuccess && (
                <div style={{ fontSize: "11px", color: "#10b981", marginTop: "6px" }}>{inviteSuccess}</div>
              )}
            </form>

            {/* Share Link Copy */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "12px 14px", marginBottom: "18px" }}>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginBottom: "4px", fontWeight: "600", textTransform: "uppercase" }}>
                Secret Invite Link
              </div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.65)", wordBreak: "break-all", lineHeight: "1.4", marginBottom: "10px" }}>
                {shareUrl || "Loading link..."}
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
                  style={{
                    flex: 1, padding: "9px", borderRadius: "8px",
                    background: shareCopied ? "rgba(16,185,129,0.15)" : "rgba(99,102,241,0.15)",
                    border: shareCopied ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(99,102,241,0.3)",
                    color: shareCopied ? "#10b981" : "#a5b4fc", fontSize: "12px", fontWeight: "600",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  }}
                >
                  {shareCopied ? <LucideCheck style={{ width: "13px", height: "13px" }} /> : <LucideLink2 style={{ width: "13px", height: "13px" }} />}
                  {shareCopied ? "Invite Link Copied" : "Copy Secret Invite Link"}
                </button>
                {isOwner && (
                  <button
                    onClick={handleRevokeShareLink}
                    title="Revoke old link and generate a new invite link"
                    style={{
                      padding: "9px 12px", borderRadius: "8px",
                      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.75)", fontSize: "12px", fontWeight: "600",
                      cursor: "pointer", display: "flex", alignItems: "center", gap: "5px",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"; }}
                  >
                    <LucideRefreshCw style={{ width: "12px", height: "12px" }} />
                    <span>Revoke</span>
                  </button>
                )}
              </div>
            </div>

            {/* Real Collaborators List */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "8px", fontWeight: "600", textTransform: "uppercase" }}>
                Workspace Members
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "120px", overflowY: "auto" }}>
                {collaboratorsList.owner && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: collaboratorsList.owner.avatarColor || "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700", color: "white" }}>
                        {collaboratorsList.owner.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.85)", fontWeight: "500" }}>{collaboratorsList.owner.name}</div>
                        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{collaboratorsList.owner.email}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(99,102,241,0.2)", color: "#a5b4fc", fontWeight: "600" }}>
                      Owner (Admin)
                    </span>
                  </div>
                )}
                {collaboratorsList.collaborators?.map((c) => (
                  <div key={c._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", background: "rgba(255,255,255,0.03)", borderRadius: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: c.avatarColor || "#10b981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700", color: "white" }}>
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.85)", fontWeight: "500" }}>{c.name}</div>
                        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{c.email}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "4px", background: "rgba(16,185,129,0.2)", color: "#6ee7b7", fontWeight: "600" }}>
                        Collaborator
                      </span>
                      {isOwner && c._id !== currentUser?.id && (
                        <button
                          onClick={() => handleRemoveCollaborator(c._id, c.name)}
                          title={`Kick ${c.name} from workspace`}
                          style={{
                            display: "flex", alignItems: "center", gap: "4px",
                            padding: "3px 8px", borderRadius: "6px",
                            background: "rgba(244,63,94,0.15)", border: "1px solid rgba(244,63,94,0.3)",
                            color: "#fca5a5", fontSize: "11px", fontWeight: "600",
                            cursor: "pointer", transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.3)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.15)"; }}
                        >
                          <LucideUserMinus style={{ width: "11px", height: "11px", color: "#f43f5e" }} />
                          <span>Kick</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {isOwner && (collaboratorsList.collaborators?.length || 0) > 0 && (
                <button
                  onClick={handleAdminExitCollab}
                  style={{
                    marginTop: "10px", width: "100%", padding: "8px 12px", borderRadius: "8px",
                    background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.25)",
                    color: "#fca5a5", fontSize: "12px", fontWeight: "600", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(244,63,94,0.1)"; }}
                >
                  <LucideUserX style={{ width: "13px", height: "13px", color: "#f43f5e" }} />
                  <span>Kick All Collaborators & Make Workspace Private</span>
                </button>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                &copy; {new Date().getFullYear()} Lovjyot Singh
              </span>
              <button
                onClick={() => setShareModalOpen(false)}
                style={{ padding: "8px 18px", borderRadius: "8px", background: "rgba(255,255,255,0.08)", border: "none", color: "rgba(255,255,255,0.8)", fontSize: "12px", fontWeight: "500", cursor: "pointer" }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Join Workspace Modal ── */}
      {joinModalOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
          }}
          onClick={() => setJoinModalOpen(false)}
        >
          <div
            style={{
              background: "rgba(15,15,25,0.98)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "20px", padding: "28px", width: "450px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div style={{
                width: "40px", height: "40px", borderRadius: "12px",
                background: "linear-gradient(135deg, #6366f1, #06b6d4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 20px rgba(99,102,241,0.4)"
              }}>
                <LucideLink2 style={{ width: "18px", height: "18px", color: "white" }} />
              </div>
              <div>
                <div style={{ color: "rgba(255,255,255,0.95)", fontWeight: "700", fontSize: "17px" }}>Join Shared Workspace</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>Paste an invite link or token to collaborate in real-time</div>
              </div>
            </div>

            <form onSubmit={handleJoinDocument} style={{ marginTop: "16px" }}>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginBottom: "6px", fontWeight: "600", textTransform: "uppercase" }}>
                Share Link or Invite Code
              </div>
              <div style={{ position: "relative", marginBottom: "12px" }}>
                <input
                  type="text"
                  placeholder="e.g. https://syncflow.com/doc/... or share code"
                  value={joinInput}
                  onChange={(e) => {
                    setJoinInput(e.target.value);
                    setJoinError("");
                  }}
                  autoFocus
                  style={{
                    width: "100%", background: "rgba(255,255,255,0.05)",
                    border: joinError ? "1px solid rgba(244,63,94,0.6)" : "1px solid rgba(255,255,255,0.12)",
                    borderRadius: "10px", padding: "11px 70px 11px 12px", color: "rgba(255,255,255,0.95)",
                    fontSize: "13px", outline: "none", boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) {
                        setJoinInput(text.trim());
                        setJoinError("");
                      }
                    } catch {}
                  }}
                  style={{
                    position: "absolute", right: "6px", top: "7px",
                    padding: "4px 8px", borderRadius: "6px",
                    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  Paste
                </button>
              </div>

              {joinError && (
                <div style={{ fontSize: "12px", color: "#f43f5e", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>⚠️ {joinError}</span>
                </div>
              )}

              {joinSuccess && (
                <div style={{ fontSize: "12px", color: "#10b981", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>✓ {joinSuccess}</span>
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => {
                    setJoinModalOpen(false);
                    setJoinInput("");
                    setJoinError("");
                  }}
                  style={{
                    padding: "10px 18px", borderRadius: "9px",
                    background: "rgba(255,255,255,0.06)", border: "none",
                    color: "rgba(255,255,255,0.7)", fontSize: "13px", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={joining || !joinInput.trim()}
                  style={{
                    padding: "10px 22px", borderRadius: "9px",
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none", color: "white", fontSize: "13px", fontWeight: "600",
                    cursor: joining || !joinInput.trim() ? "not-allowed" : "pointer",
                    boxShadow: "0 0 20px rgba(99,102,241,0.4)",
                    opacity: joining || !joinInput.trim() ? 0.6 : 1,
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  {joining ? "Joining..." : "Join Workspace"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px", zIndex: 110,
          background: "rgba(15,23,42,0.95)", border: "1px solid rgba(99,102,241,0.4)",
          borderRadius: "12px", padding: "12px 18px", display: "flex", alignItems: "center", gap: "10px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.6), 0 0 20px rgba(99,102,241,0.2)",
          color: "white", fontSize: "13px", fontWeight: "500",
        }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
          {toastMessage}
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
