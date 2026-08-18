"use client";

import { useEffect, useRef, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { io, Socket } from "socket.io-client";
import { getUser } from "@/lib/auth";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

const DOCUMENT_ID = "syncflow-alpha-room";
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export type Presence = { name: string; color: string; isTyping?: boolean };

interface EditorProps {
  onPresenceChange?: (users: Presence[]) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export default function Editor({ onPresenceChange, onConnectionChange }: EditorProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const isApplyingRemote = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userName = useRef<string>("Guest");

  const editor = useCreateBlockNote();

  // Set real username from JWT on mount
  useEffect(() => {
    const user = getUser();
    if (user) userName.current = user.name;
  }, []);

  useEffect(() => {
    const s = io(BACKEND_URL, { transports: ["websocket", "polling"] });

    s.on("connect", () => {
      setIsConnected(true);
      onConnectionChange?.(true);
      // Join document and send username for presence
      s.emit("join-document", DOCUMENT_ID, userName.current);
    });

    s.on("disconnect", () => {
      setIsConnected(false);
      onConnectionChange?.(false);
    });

    // Load persisted document state when joining
    s.on("load-document", (savedBlocks) => {
      if (savedBlocks && Array.isArray(savedBlocks) && savedBlocks.length > 0) {
        isApplyingRemote.current = true;
        editor.replaceBlocks(editor.document, savedBlocks);
        setTimeout(() => { isApplyingRemote.current = false; }, 100);
      }
    });

    // Receive live changes from other users
    s.on("receive-changes", (incomingBlocks) => {
      isApplyingRemote.current = true;
      editor.replaceBlocks(editor.document, incomingBlocks);
      setTimeout(() => { isApplyingRemote.current = false; }, 50);
    });

    // Receive presence updates
    s.on("presence-update", (users: Presence[]) => {
      onPresenceChange?.(users);
    });

    setSocket(s);
    return () => { s.disconnect(); };
  }, [editor, onPresenceChange, onConnectionChange]);

  const onChange = () => {
    if (!socket || isApplyingRemote.current) return;

    // Typing indicator: send typing=true, then stop after 1.5s of inactivity
    socket.emit("typing", DOCUMENT_ID, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit("typing", DOCUMENT_ID, false);
    }, 1500);

    // Debounce actual content sync
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      socket.emit("send-changes", DOCUMENT_ID, editor.document);
    }, 80);
  };

  return (
    <div className="w-full relative">
      {/* Connection status dot */}
      <div style={{
        position: "absolute", top: "-12px", right: "0",
        display: "flex", alignItems: "center", gap: "5px",
      }}>
        <div style={{
          width: "6px", height: "6px", borderRadius: "50%",
          background: isConnected ? "#10b981" : "#f43f5e",
          boxShadow: isConnected ? "0 0 6px rgba(16,185,129,0.8)" : "0 0 6px rgba(244,63,94,0.8)",
          transition: "all 0.3s ease",
        }} />
        <span style={{ fontSize: "11px", color: isConnected ? "rgba(16,185,129,0.7)" : "rgba(244,63,94,0.7)" }}>
          {isConnected ? "Connected" : "Reconnecting..."}
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
}
