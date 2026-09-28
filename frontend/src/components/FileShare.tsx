'use client';

import { ChangeEvent, ReactNode, useEffect, useRef, useState } from 'react';
import {
  deleteSharedFile,
  formatFileSize,
  listSharedFiles,
  openSharedFile,
  uploadSharedFile,
  type SharedFileRecord,
} from '@/lib/api';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface FileShareProps {
  documentId: string;
  userId: string;
  isOwner: boolean;
  refreshKey: number;
  onNotice: (message: string) => void;
  onActivity: () => void;
  children: (parts: { addButton: ReactNode; files: ReactNode }) => ReactNode;
}

export default function FileShare({
  documentId,
  userId,
  isOwner,
  refreshKey,
  onNotice,
  onActivity,
  children,
}: FileShareProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<SharedFileRecord[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listSharedFiles(documentId)
      .then((next) => {
        if (!cancelled) setFiles(next);
      })
      .catch((err) => {
        if (!cancelled) onNotice(err instanceof Error ? err.message : 'Could not load shared files');
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, onNotice, refreshKey]);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size < 1) {
      onNotice('Choose a file to share');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      onNotice('Files must be 10 MB or smaller');
      return;
    }

    setUploading(true);
    onNotice('');
    try {
      await uploadSharedFile(documentId, file);
      setFiles(await listSharedFiles(documentId));
      onActivity();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Could not share that file');
    } finally {
      setUploading(false);
    }
  }

  async function remove(file: SharedFileRecord) {
    onNotice('');
    try {
      await deleteSharedFile(documentId, file._id);
      setFiles((current) => current.filter((item) => item._id !== file._id));
      onActivity();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Could not remove that file');
    }
  }

  async function open(file: SharedFileRecord) {
    onNotice('');
    try {
      await openSharedFile(documentId, file);
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Could not open that file');
    }
  }

  const addButton = (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-label={uploading ? 'Sharing file' : 'Share a file'}
        title="Share a file"
        className="grid h-9 w-9 place-items-center rounded-full bg-saffron text-ink disabled:opacity-60"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
          <path d="M8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(event) => void onPick(event)}
      />
    </>
  );

  const filesList = files.length > 0 ? (
    <section className="mb-4" aria-label="Shared files">
      <p className="mb-2 text-xs tracking-[0.18em] text-mist uppercase">Shared files</p>
      <ul className="flex max-h-40 flex-col gap-2 overflow-y-auto">
        {files.map((file) => {
          const canRemove = isOwner || file.uploadedBy._id === userId;
          return (
            <li key={file._id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-2 px-3 py-2">
              <button type="button" onClick={() => void open(file)} className="min-w-0 flex-1 truncate text-left text-sm hover:text-saffron">
                {file.name}
              </button>
              <span className="shrink-0 text-xs text-mist">{formatFileSize(file.size)}</span>
              <span className="hidden shrink-0 text-xs text-mist sm:inline">{file.uploadedBy.name}</span>
              {canRemove && (
                <button type="button" onClick={() => void remove(file)} className="shrink-0 text-xs text-mist hover:text-paper">
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  ) : null;

  return children({ addButton, files: filesList });
}
