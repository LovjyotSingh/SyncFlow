'use client';

import { ChangeEvent, ReactNode, useEffect, useRef, useState } from 'react';
import {
  deleteSharedFile,
  downloadBlob,
  fetchSharedFile,
  formatFileSize,
  listSharedFiles,
  uploadSharedFile,
  type SharedFileRecord,
} from '@/lib/api';
import { filePreviewKind, type FilePreviewKind } from '@/lib/sharedFile';

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
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);

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

  function closePreview() {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

  async function open(file: SharedFileRecord) {
    onNotice('');
    const kind = filePreviewKind(file);
    const popup = kind === 'pdf' ? window.open('', '_blank') : null;
    setOpeningId(file._id);
    try {
      const blob = await fetchSharedFile(documentId, file);
      if (kind === 'download') {
        popup?.close();
        downloadBlob(blob, file.name);
        return;
      }
      if (kind === 'pdf' && popup && !popup.closed) {
        const url = URL.createObjectURL(blob);
        popup.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
      popup?.close();
      const url = URL.createObjectURL(blob);
      const text = kind === 'text' ? await blob.text() : undefined;
      setPreview((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { name: file.name, kind, url, text, blob };
      });
    } catch (err) {
      popup?.close();
      onNotice(err instanceof Error ? err.message : 'Could not open that file');
    } finally {
      setOpeningId(null);
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
              <button
                type="button"
                onClick={() => void open(file)}
                disabled={openingId === file._id}
                className="min-w-0 flex-1 truncate text-left text-sm hover:text-saffron disabled:opacity-60"
              >
                {openingId === file._id ? 'Opening…' : file.name}
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

  return (
    <>
      {children({ addButton, files: filesList })}
      {preview && (
        <FilePreviewDialog
          preview={preview}
          onClose={closePreview}
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

function FilePreviewDialog({ preview, onClose }: { preview: FilePreview; onClose: () => void }) {
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
            <button type="button" onClick={() => downloadBlob(preview.blob, preview.name)} className="rounded-full border border-ink px-3 py-1.5 text-sm">
              Download
            </button>
            <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-sm text-[#6f675d] hover:bg-[#efe8dc]">
              Close
            </button>
          </div>
        </div>
        {preview.kind === 'text' && (
          <pre className="min-h-40 flex-1 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-sm leading-relaxed">{preview.text}</pre>
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
