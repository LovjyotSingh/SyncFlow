'use client';

import { ChangeEvent, ReactNode, useEffect, useRef, useState } from 'react';
import type * as Y from 'yjs';
import { downloadBlob, formatFileSize } from '@/lib/api';
import {
  deletePageFile,
  listPageFiles,
  looksLikeText,
  MAX_FILE_BYTES,
  readPageFile,
  writePageFile,
  type PageFile,
} from '@/lib/pageFiles';
import { filePreviewKind, type FilePreviewKind } from '@/lib/sharedFile';

interface FileShareProps {
  ydoc: Y.Doc | null;
  userId: string;
  userName: string;
  isOwner: boolean;
  onNotice: (message: string) => void;
  onActivity: () => void;
  onAddToSpace: (name: string, text: string) => boolean;
  children: (parts: { addButton: ReactNode; files: ReactNode }) => ReactNode;
}

export default function FileShare({
  ydoc,
  userId,
  userName,
  isOwner,
  onNotice,
  onActivity,
  onAddToSpace,
  children,
}: FileShareProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PageFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);

  useEffect(() => {
    if (!ydoc) {
      setFiles([]);
      return;
    }
    const sync = () => setFiles(listPageFiles(ydoc));
    sync();
    const meta = ydoc.getMap('shared-files');
    const chunks = ydoc.getMap('shared-file-chunks');
    meta.observeDeep(sync);
    chunks.observeDeep(sync);
    return () => {
      meta.unobserveDeep(sync);
      chunks.unobserveDeep(sync);
    };
  }, [ydoc]);

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size < 1) {
      onNotice('Choose a file to share');
      return;
    }
    if (!ydoc) {
      onNotice('Wait until the page is live, then share the file.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      onNotice('Files must be 32 MB or smaller');
      return;
    }

    setUploading(true);
    onNotice('');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await writePageFile(ydoc, {
        name: file.name,
        mime: file.type,
        bytes,
        uploadedBy: userId,
        uploadedByName: userName,
      });
      onActivity();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Could not share that file');
    } finally {
      setUploading(false);
    }
  }

  function remove(file: PageFile) {
    if (!ydoc) return;
    onNotice('');
    try {
      deletePageFile(ydoc, file.id);
      onActivity();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : 'Could not remove that file');
    }
  }

  function closePreview() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  function open(file: PageFile) {
    if (!ydoc) return;
    onNotice('');
    const bytes = readPageFile(ydoc, file.id);
    if (!bytes) {
      onNotice('That file is still syncing. Try again in a moment.');
      return;
    }
    const namedKind = filePreviewKind(file);
    const kind = namedKind === 'pdf' || namedKind === 'image'
      ? namedKind
      : (namedKind === 'text' || looksLikeText(bytes) ? 'text' : 'download');
    const blob = new Blob([bytes], { type: kind === 'pdf' ? 'application/pdf' : (file.mime || 'application/octet-stream') });
    if (kind === 'download') {
      downloadBlob(blob, file.name);
      return;
    }
    if (kind === 'pdf') {
      const popup = window.open('', '_blank');
      const url = URL.createObjectURL(blob);
      if (popup && !popup.closed) {
        popup.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
    }
    const url = URL.createObjectURL(blob);
    const text = kind === 'text' ? new TextDecoder().decode(bytes) : undefined;
    setOpeningId(file.id);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return { name: file.name, kind, url, text, blob };
    });
    setOpeningId(null);
  }

  const addButton = (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || !ydoc}
        aria-label={uploading ? 'Sharing file' : 'Share a file'}
        title={ydoc ? 'Share a file' : 'Wait until the page is live'}
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
          const canRemove = isOwner || file.uploadedBy === userId;
          return (
            <li key={file.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-2 px-3 py-2">
              <button
                type="button"
                onClick={() => open(file)}
                disabled={openingId === file.id}
                className="min-w-0 flex-1 truncate text-left text-sm hover:text-saffron disabled:opacity-60"
              >
                {openingId === file.id ? 'Opening…' : file.name}
              </button>
              <span className="shrink-0 text-xs text-mist">{formatFileSize(file.size)}</span>
              <span className="hidden shrink-0 text-xs text-mist sm:inline">{file.uploadedByName}</span>
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

  return (
    <>
      {children({ addButton, files: filesList })}
      {preview && (
        <FilePreviewDialog
          preview={preview}
          onClose={closePreview}
          onAddToSpace={onAddToSpace}
        />
      )}
    </>
  );
}

interface FilePreview {
  name: string;
  kind: Exclude<FilePreviewKind, 'download'>;
  url: string;
  text?: string;
  blob: Blob;
}

function FilePreviewDialog({
  preview,
  onClose,
  onAddToSpace,
}: {
  preview: FilePreview;
  onClose: () => void;
  onAddToSpace: (name: string, text: string) => boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-labelledby="file-preview-title"
        className="flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-3xl bg-paper p-4 text-ink shadow-2xl sm:p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="file-preview-title" className="min-w-0 truncate font-serif text-2xl">{preview.name}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {preview.kind === 'text' && preview.text !== undefined && (
              <button
                type="button"
                onClick={() => {
                  if (onAddToSpace(preview.name, preview.text || '')) onClose();
                }}
                className="rounded-full bg-ink px-3 py-1.5 text-sm text-paper"
              >
                Add this to space
              </button>
            )}
            <button type="button" onClick={() => downloadBlob(preview.blob, preview.name)} className="rounded-full border border-ink px-3 py-1.5 text-sm">
              Download
            </button>
            <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-sm text-[#6f675d] hover:bg-[#efe8dc]">
              Close
            </button>
          </div>
        </div>
        {preview.kind === 'text' && (
          <textarea
            readOnly
            value={preview.text}
            aria-label={preview.name}
            className="h-[70dvh] w-full flex-1 resize-none rounded-2xl bg-white p-4 font-mono text-sm leading-relaxed outline-none"
          />
        )}
        {preview.kind === 'image' && (
          <img src={preview.url} alt={preview.name} className="mx-auto max-h-[70dvh] max-w-full rounded-2xl object-contain" />
        )}
        {preview.kind === 'pdf' && (
          <iframe title={preview.name} src={preview.url} className="h-[70dvh] w-full rounded-2xl bg-white" />
        )}
      </div>
    </div>
  );
}
