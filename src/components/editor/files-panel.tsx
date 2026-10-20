"use client";

import * as D from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, ExternalLink, FileCode2, FileImage, FileText, File as FileIcon, Plus, Trash2, Upload, X } from "lucide-react";
import type { Role, SharedFile } from "@/lib/docs";
import { fileKind } from "@/lib/files";
import { api, cn, formatBytes, timeAgo } from "@/lib/utils";
import { uploadToPage } from "./upload";

export function FilesPanel({
  open,
  onOpenChange,
  docId,
  role,
  selfId,
  enabled,
  revision,
  onCount,
  onMutated,
  onInsertText,
  onInsertImage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docId: string;
  role: Role;
  selfId: string;
  enabled: boolean;
  revision: number | undefined;
  onCount: (count: number) => void;
  onMutated: () => void;
  onInsertText: (name: string, text: string) => void;
  onInsertImage: (url: string, name: string) => void;
}) {
  const [files, setFiles] = useState<SharedFile[] | null>(null);
  const [progress, setProgress] = useState<{ name: string; percent: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [reloadKey, setReloadKey] = useState(0);

  // Load on mount (for the count), when the panel opens, and when anyone adds or removes a file.
  useEffect(() => {
    let alive = true;
    api<{ files: SharedFile[] }>(`/api/docs/${docId}/files`)
      .then(({ files }) => {
        if (!alive) return;
        setFiles(files);
        onCount(files.length);
      })
      .catch((err) => alive && toast.error(err instanceof Error ? err.message : "Couldn't load files."));
    return () => {
      alive = false;
    };
  }, [docId, open, revision, reloadKey, onCount]);

  async function uploadMany(list: FileList | File[]) {
    if (!enabled) return toast.error("File sharing isn't set up on this deployment yet.");
    for (const file of Array.from(list)) {
      setProgress({ name: file.name, percent: 0 });
      try {
        await uploadToPage(docId, file, (percent) => setProgress({ name: file.name, percent }));
        toast.success(`Shared “${file.name}”`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : `Couldn't upload “${file.name}”.`);
      }
    }
    setProgress(null);
    onMutated();
  }

  async function remove(file: SharedFile) {
    setFiles((list) => list?.filter((f) => f.id !== file.id) ?? null);
    try {
      await api(`/api/files/${file.id}`, { method: "DELETE" });
      onMutated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that file.");
      setReloadKey((k) => k + 1);
    }
  }

  async function insert(file: SharedFile) {
    const kind = fileKind(file.contentType, file.name);
    if (kind === "image") return onInsertImage(file.url, file.name);
    try {
      const res = await fetch(file.url);
      const text = await res.text();
      onInsertText(file.name, text.slice(0, 100_000));
      toast.success(`Added “${file.name}” to the page`);
    } catch {
      toast.error("Couldn't read that file.");
    }
  }

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-fade" />
        <D.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col pb-[env(safe-area-inset-bottom)] border-l border-line2 bg-s1 shadow-[0_0_120px_rgb(0_0_0/0.9)] outline-none data-[state=open]:animate-[sf-slide_0.45s_var(--ease-out-expo)]"
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files.length) void uploadMany(e.dataTransfer.files);
          }}
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <D.Title className="font-semibold tracking-tight">Files on this page</D.Title>
              <D.Description className="text-xs text-dim">Everyone on the page can open these. Up to 10 MB each.</D.Description>
            </div>
            <D.Close className="grid size-8 place-items-center rounded-lg text-dim hover:bg-white/5 hover:text-ink pointer-coarse:size-10" aria-label="Close">
              <X className="size-4" />
            </D.Close>
          </div>

          <div className="p-5">
            <button
              onClick={() => inputRef.current?.click()}
              disabled={!enabled || Boolean(progress)}
              className={cn(
                "flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-7 text-center transition-colors",
                dragging ? "border-c3 bg-c3/10" : "border-line2 hover:border-white/30 hover:bg-white/[0.02]",
                !enabled && "cursor-not-allowed opacity-60",
              )}
            >
              <Upload className="size-5 text-muted" />
              <span className="text-sm font-medium">
                {enabled ? (
                  <>
                    <span className="pointer-coarse:hidden">Drop files or click to upload</span>
                    <span className="hidden pointer-coarse:inline">Tap to upload a file</span>
                  </>
                ) : (
                  "File sharing isn't set up yet"
                )}
              </span>
              <span className="text-xs text-dim">
                {enabled ? "Images, PDFs, docs and code" : "The owner of this deployment needs to connect Vercel Blob."}
              </span>
            </button>
            <input ref={inputRef} type="file" multiple hidden onChange={(e) => e.target.files && uploadMany(e.target.files)} />
            {progress ? (
              <div className="mt-3 rounded-xl border border-line bg-s2 p-3">
                <div className="flex justify-between text-xs">
                  <span className="truncate text-muted">Uploading {progress.name}</span>
                  <span className="font-mono text-dim">{progress.percent}%</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-s4">
                  <div className="h-full rounded-full bg-[image:var(--grad)] transition-[width]" style={{ width: `${progress.percent}%` }} />
                </div>
              </div>
            ) : null}
          </div>

          <ul className="flex-1 space-y-1 overflow-y-auto px-3 pb-6 scrollbar-thin">
            {files === null
              ? [0, 1, 2].map((i) => <li key={i} className="mx-2 h-16 animate-pulse rounded-xl bg-s2" />)
              : files.length === 0
                ? <li className="px-4 py-10 text-center text-sm text-dim">No files yet.</li>
                : files.map((f) => {
                    const kind = fileKind(f.contentType, f.name);
                    const canRemove = role === "owner" || f.uploaderId === selfId;
                    return (
                      <li key={f.id} className="group flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.03]">
                        <FileThumb file={f} kind={kind} />
                        <div className="min-w-0 flex-1">
                          <a href={f.url} target="_blank" rel="noopener" className="block truncate text-sm font-medium hover:underline">
                            {f.name}
                          </a>
                          <span className="block truncate text-xs text-dim" suppressHydrationWarning>
                            {formatBytes(f.size)} · {f.uploaderName ?? "Someone"} · {timeAgo(f.createdAt)}
                          </span>
                        </div>
                        <div className="flex opacity-60 transition-opacity group-hover:opacity-100 pointer-coarse:opacity-100">
                          {kind === "text" || kind === "image" ? (
                            <IconButton label="Add to page" onClick={() => insert(f)}>
                              <Plus />
                            </IconButton>
                          ) : null}
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener"
                            className="grid size-8 place-items-center rounded-lg text-dim hover:bg-white/5 hover:text-ink pointer-coarse:size-10"
                            aria-label={kind === "other" ? "Download" : "Open"}
                          >
                            {kind === "other" ? <Download className="size-4" /> : <ExternalLink className="size-4" />}
                          </a>
                          {canRemove ? (
                            <IconButton label="Remove file" onClick={() => remove(f)} danger>
                              <Trash2 />
                            </IconButton>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
          </ul>
          <style>{`@keyframes sf-slide { from { transform: translateX(100%) } }`}</style>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-dim hover:bg-white/5 [&>svg]:size-4 pointer-coarse:size-10",
        danger ? "hover:text-bad" : "hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function FileThumb({ file, kind }: { file: SharedFile; kind: ReturnType<typeof fileKind> }) {
  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={file.url} alt="" className="size-11 rounded-lg border border-line object-cover" loading="lazy" />;
  }
  const Icon = kind === "pdf" ? FileText : kind === "text" ? FileCode2 : kind === "other" ? FileIcon : FileImage;
  return (
    <span
      className={cn(
        "grid size-11 place-items-center rounded-lg border border-line",
        kind === "pdf" ? "bg-c1/10 text-c1" : kind === "text" ? "bg-c3/10 text-[#b9a3ff]" : "bg-s3 text-muted",
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}
