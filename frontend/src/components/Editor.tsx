"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { io, Socket } from "socket.io-client";
import { getUser } from "@/lib/auth";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export type Presence = { socketId?: string; userId?: string; name: string; color: string; isTyping?: boolean };

export interface EditorHandle {
  getText: () => string;
  insertContent: (text: string) => void;
  clearContent: () => void;
  kickUser: (target: { targetSocketId?: string; targetUserId?: string; targetName?: string }) => void;
}

interface EditorProps {
  documentId: string;
  onPresenceChange?: (users: Presence[]) => void;
  onConnectionChange?: (connected: boolean) => void;
  onChangeContent?: (text: string) => void;
  onKicked?: (message?: string) => void;
}

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { documentId, onPresenceChange, onConnectionChange, onChangeContent, onKicked },
  ref
) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const isApplyingRemote = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userName = useRef<string>("Guest");

  // Keep latest callbacks in refs to avoid socket reconnect loops
  const onPresenceChangeRef = useRef(onPresenceChange);
  const onConnectionChangeRef = useRef(onConnectionChange);
  const onChangeContentRef = useRef(onChangeContent);
  const onKickedRef = useRef(onKicked);

  useEffect(() => {
    onPresenceChangeRef.current = onPresenceChange;
    onConnectionChangeRef.current = onConnectionChange;
    onChangeContentRef.current = onChangeContent;
    onKickedRef.current = onKicked;
  });

  const editor = useCreateBlockNote();

  // Set real username from JWT on mount
  useEffect(() => {
    const user = getUser();
    if (user) userName.current = user.name;
  }, []);

  // Expose helper methods to parent (for AIPanel & More Options & Kicking)
  useImperativeHandle(ref, () => ({
    getText: () => {
      try {
        return editor.document
          .map((b) => {
            if (Array.isArray(b.content)) {
              return b.content.map((c: any) => c.text || "").join("");
            }
            return "";
          })
          .filter(Boolean)
          .join("\n");
      } catch {
        return "";
      }
    },
    insertContent: async (text: string) => {
      if (!text?.trim()) return;
      try {
        const blocks = await editor.tryParseMarkdownToBlocks(text);
        if (blocks && blocks.length > 0) {
          editor.insertBlocks(blocks, editor.document[editor.document.length - 1], "after");
        } else {
          editor.insertBlocks(
            [{ type: "paragraph", content: text }],
            editor.document[editor.document.length - 1],
            "after"
          );
        }
        if (socket && isConnected) {
          socket.emit("send-changes", documentId, editor.document);
        }
      } catch {
        editor.insertBlocks(
          [{ type: "paragraph", content: text }],
          editor.document[editor.document.length - 1],
          "after"
        );
        if (socket && isConnected) {
          socket.emit("send-changes", documentId, editor.document);
        }
      }
    },
    clearContent: () => {
      editor.replaceBlocks(editor.document, [{ type: "paragraph", content: "" }]);
      if (socket && isConnected) {
        socket.emit("send-changes", documentId, editor.document);
      }
    },
    kickUser: (target: { targetSocketId?: string; targetUserId?: string; targetName?: string }) => {
      if (socket && isConnected) {
        socket.emit("kick-user", { documentId, ...target });
      }
    },
  }));

  // Stable Socket.io connection that only resets when documentId changes
  useEffect(() => {
    if (!documentId) return;

    const s = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    s.on("connect", () => {
      setIsConnected(true);
      onConnectionChangeRef.current?.(true);
      const user = getUser();
      // Join document with isolated document ID room and full user profile
      s.emit("join-document", documentId, {
        name: user?.name || userName.current || "Guest",
        userId: user?.id,
        color: user?.avatarColor,
      });
    });

    s.on("disconnect", (reason) => {
      setIsConnected(false);
      onConnectionChangeRef.current?.(false);
    });

    s.on("connect_error", () => {
      setIsConnected(false);
      onConnectionChangeRef.current?.(false);
    });

    // Load persisted document state when joining
    s.on("load-document", (savedBlocks) => {
      if (savedBlocks && Array.isArray(savedBlocks) && savedBlocks.length > 0) {
        isApplyingRemote.current = true;
        editor.replaceBlocks(editor.document, savedBlocks);
        setTimeout(() => {
          isApplyingRemote.current = false;
        }, 100);
      }
    });

    // Receive live changes from other users
    s.on("receive-changes", (incomingBlocks) => {
      isApplyingRemote.current = true;
      editor.replaceBlocks(editor.document, incomingBlocks);
      setTimeout(() => {
        isApplyingRemote.current = false;
      }, 50);
    });

    // Receive presence updates
    s.on("presence-update", (users: Presence[]) => {
      onPresenceChangeRef.current?.(users);
    });

    // Handle being kicked by owner
    s.on("kicked", (data: any) => {
      const msg = data?.message || "You have been removed from this workspace by the owner.";
      if (onKickedRef.current) {
        onKickedRef.current(msg);
      } else {
        alert(msg);
        window.location.href = "/";
      }
    });

    setSocket(s);

    return () => {
      s.off("connect");
      s.off("disconnect");
      s.off("connect_error");
      s.off("load-document");
      s.off("receive-changes");
      s.off("presence-update");
      s.off("kicked");
      s.disconnect();
    };
  }, [documentId]);

  const onChange = () => {
    if (!socket || isApplyingRemote.current) return;

    // Notify parent of text change
    try {
      const text = editor.document
        .map((b) => (Array.isArray(b.content) ? b.content.map((c: any) => c.text || "").join("") : ""))
        .join("\n");
      onChangeContentRef.current?.(text);
    } catch {}

    // Typing indicator: send typing=true, then stop after 1.5s of inactivity
    socket.emit("typing", documentId, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit("typing", documentId, false);
    }, 1500);

    // Debounce actual content sync
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      socket.emit("send-changes", documentId, editor.document);
    }, 80);
  };

  return (
    <div className="w-full relative">
      {/* Connection status dot */}
      <div
        style={{
          position: "absolute",
          top: "-12px",
          right: "0",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: isConnected ? "#10b981" : "#f43f5e",
            boxShadow: isConnected
              ? "0 0 6px rgba(16,185,129,0.8)"
              : "0 0 6px rgba(244,63,94,0.8)",
            transition: "all 0.3s ease",
          }}
        />
        <span
          style={{
            fontSize: "11px",
            color: isConnected ? "rgba(16,185,129,0.7)" : "rgba(244,63,94,0.7)",
          }}
        >
          {isConnected ? "Live Sync" : "Connecting..."}
        </span>
      </div>

      <BlockNoteView
        editor={editor}
        onChange={onChange}
        className="min-h-[400px] w-full"
        theme="dark"
      />
    </div>
  );
});

export default Editor;
