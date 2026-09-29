'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { withCollaboration } from '@blocknote/core/yjs';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import type { AuthUser } from '@/lib/auth';
import { connectDocument, type PresenceUser } from '@/lib/collab';

interface EditorProps {
  documentId: string;
  user: AuthUser;
  onPresence: (users: PresenceUser[]) => void;
  onStatus: (status: 'connecting' | 'live' | 'offline') => void;
  onWords: (words: number) => void;
  onForbidden: (message: string) => void;
  onDocument?: (ydoc: Y.Doc | null) => void;
}

interface Session {
  ydoc: Y.Doc;
  awareness: Awareness;
}

function plainText(blocks: Array<{ content?: unknown }>) {
  return blocks.map((block) => {
    if (!Array.isArray(block.content)) return '';
    return block.content.map((item) => {
      if (item && typeof item === 'object' && 'text' in item) {
        const text = (item as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      }
      return '';
    }).join('');
  }).join('\n');
}

function countWords(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function BoundEditor({
  session,
  user,
  onWords,
}: {
  session: Session;
  user: AuthUser;
  onWords: (words: number) => void;
}) {
  const provider = useMemo(() => ({ awareness: session.awareness }), [session.awareness]);
  const editor = useCreateBlockNote(
    withCollaboration({
      collaboration: {
        fragment: session.ydoc.getXmlFragment('document-store'),
        user: { name: user.name, color: user.avatarColor },
        provider,
        showCursorLabels: 'always',
      },
    }),
    [session.ydoc],
  );

  return (
    <BlockNoteView
      editor={editor}
      theme="light"
      onChange={() => onWords(countWords(plainText(editor.document)))}
    />
  );
}

export default function Editor({
  documentId,
  user,
  onPresence,
  onStatus,
  onWords,
  onForbidden,
  onDocument,
}: EditorProps) {
  const [session, setSession] = useState<Session | null>(null);
  const onPresenceRef = useRef(onPresence);
  const onStatusRef = useRef(onStatus);
  const onForbiddenRef = useRef(onForbidden);
  const onDocumentRef = useRef(onDocument);

  useEffect(() => {
    onPresenceRef.current = onPresence;
    onStatusRef.current = onStatus;
    onForbiddenRef.current = onForbidden;
    onDocumentRef.current = onDocument;
  });

  useEffect(() => {
    const ydoc = new Y.Doc();
    const awareness = new Awareness(ydoc);
    let cancelled = false;
    onStatusRef.current('connecting');

    const stop = connectDocument({
      documentId,
      ydoc,
      awareness,
      onReady: () => {
        if (cancelled) return;
        setSession({ ydoc, awareness });
        onDocumentRef.current?.(ydoc);
      },
      onStatus: (status) => onStatusRef.current(status),
      onPresence: (users) => onPresenceRef.current(users),
      onForbidden: (message) => onForbiddenRef.current(message),
    });

    return () => {
      cancelled = true;
      onDocumentRef.current?.(null);
      stop();
      ydoc.destroy();
    };
  }, [documentId]);

  if (!session) {
    return (
      <div className="space-y-3 py-2" aria-hidden>
        <div className="h-4 w-2/3 animate-pulse rounded bg-line" />
        <div className="h-4 w-full animate-pulse rounded bg-line" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-line" />
      </div>
    );
  }

  return <BoundEditor session={session} user={user} onWords={onWords} />;
}
