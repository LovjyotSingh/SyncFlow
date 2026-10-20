"use client";

import "@blocknote/mantine/style.css";
import { useEffect } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { withCollaboration } from "@blocknote/core/yjs";
import { BlockNoteView, type Theme } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import type * as Y from "yjs";
import type { HttpSyncProvider } from "@/lib/sync/provider";

const theme: Theme = {
  colors: {
    editor: { text: "#f5f5f7", background: "#000000" },
    menu: { text: "#f5f5f7", background: "#111113" },
    tooltip: { text: "#f5f5f7", background: "#18181b" },
    hovered: { text: "#f5f5f7", background: "#1c1c20" },
    selected: { text: "#000000", background: "#f5f5f7" },
    disabled: { text: "#6b6b74", background: "#111113" },
    shadow: "#000000",
    border: "#2a2a2e",
    sideMenu: "#6b6b74",
    highlights: {
      gray: { text: "#a1a1aa", background: "#27272a" },
      brown: { text: "#d6b38a", background: "#3a2c1f" },
      red: { text: "#ff8a8a", background: "#3b1717" },
      orange: { text: "#ffb27a", background: "#3b2412" },
      yellow: { text: "#fde68a", background: "#3a3112" },
      green: { text: "#86efac", background: "#11301f" },
      blue: { text: "#93c5fd", background: "#132a45" },
      purple: { text: "#c4b5fd", background: "#2a1f4a" },
      pink: { text: "#f9a8d4", background: "#3f1730" },
    },
  },
  borderRadius: 10,
  fontFamily: "var(--font-geist), system-ui, sans-serif",
};

export type Editor = BlockNoteEditor;

export default function BlockEditor({
  doc,
  provider,
  user,
  uploadFile,
  onReady,
}: {
  doc: Y.Doc;
  provider: HttpSyncProvider;
  user: { name: string; color: string };
  uploadFile?: (file: File) => Promise<string>;
  onReady?: (editor: Editor) => void;
}) {
  const editor = useCreateBlockNote(
    withCollaboration({
      uploadFile,
      collaboration: {
        fragment: doc.getXmlFragment("document-store"),
        provider,
        user,
        showCursorLabels: "activity",
      },
    }),
    [doc, provider],
  );

  useEffect(() => {
    onReady?.(editor as unknown as Editor);
  }, [editor, onReady]);

  return <BlockNoteView editor={editor} theme={theme} className="sf-editor" />;
}
