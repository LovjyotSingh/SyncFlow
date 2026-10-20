"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, LogOut, MoreHorizontal, Paperclip, Share2, Trash2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { LogoMark } from "@/components/ui/logo";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import type { SessionUser } from "@/lib/auth";
import type { PageDetail } from "@/lib/docs";
import { shareUrl } from "@/lib/share";
import { api, colorFor } from "@/lib/utils";
import type { Editor } from "./block-editor";
import { FilesPanel } from "./files-panel";
import { Presence } from "./presence";
import { ShareDialog } from "./share-dialog";
import { SyncStatus } from "./sync-status";
import { uploadToPage } from "./upload";
import { useMetaValue, usePeers, useProviderState, useSynced, useSyncSession } from "./use-sync";

const BlockEditor = dynamic(() => import("./block-editor"), { ssr: false, loading: () => <EditorSkeleton /> });

export function Workspace({ user, page, filesEnabled }: { user: SessionUser; page: PageDetail; filesEnabled: boolean }) {
  const router = useRouter();
  const session = useSyncSession(page.id);
  const provider = session?.provider;
  const doc = session?.doc;
  const state = useProviderState(provider);
  const synced = useSynced(provider);
  const peers = usePeers(provider);
  const [metaTitle, setMetaTitle] = useMetaValue<string>(doc, "title");
  const [filesRev, setFilesRev] = useMetaValue<number>(doc, "filesRev");

  const [draft, setDraft] = useState(page.title === "Untitled" ? "" : page.title);
  // Once the shared doc has a title, it wins, so everyone sees the same live title.
  const title = typeof metaTitle === "string" ? metaTitle : draft;
  const [shareToken, setShareToken] = useState(page.shareToken);
  const [shareOpen, setShareOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [fileCount, setFileCount] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const self = { name: user.name, color: colorFor(user.id) };
  const isOwner = page.role === "owner";

  // The title lives in the shared doc so it updates live; seed it from the database the first time.
  useEffect(() => {
    if (synced && doc && doc.getMap("meta").get("title") === undefined) {
      doc.getMap("meta").set("title", page.title === "Untitled" ? "" : page.title);
    }
  }, [synced, doc, page.title]);

  useEffect(() => {
    document.title = `${title || "Untitled"} · SyncFlow`;
  }, [title]);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  function onTitleChange(value: string) {
    const clean = value.replace(/\n/g, "");
    if (doc) setMetaTitle(clean);
    else setDraft(clean);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void api(`/api/docs/${page.id}`, { method: "PATCH", json: { title: clean.trim() || "Untitled" } }).catch(() => {});
    }, 700);
  }

  const bumpFiles = useCallback(() => setFilesRev(Date.now()), [setFilesRev]);

  const uploadFile = useCallback(
    async (file: File) => {
      const saved = await uploadToPage(page.id, file);
      bumpFiles();
      return saved.url;
    },
    [page.id, bumpFiles],
  );

  const onReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  function insertBlocks(blocks: unknown[]) {
    const editor = editorRef.current;
    if (!editor) return;
    const last = editor.document[editor.document.length - 1];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.insertBlocks(blocks as any, last, "after");
  }

  function insertText(name: string, text: string) {
    const isCode = /\.(js|jsx|ts|tsx|py|java|c|cpp|h|go|rs|rb|php|css|html|sql|json|yml|yaml|toml|sh)$/i.test(name);
    if (isCode) {
      insertBlocks([{ type: "codeBlock", content: text }]);
    } else {
      insertBlocks(
        text
          .split(/\n{2,}/)
          .slice(0, 400)
          .map((para) => ({ type: "paragraph", content: para.replace(/\n/g, " ") })),
      );
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl(window.location.origin, shareToken));
      toast.success("Link copied");
    } catch {
      setShareOpen(true);
    }
  }

  async function removePage() {
    setRemoving(true);
    try {
      await api(`/api/docs/${page.id}`, { method: "DELETE" });
      toast.success(isOwner ? "Page deleted" : "You left the page");
      router.replace("/app");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work.");
      setRemoving(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-black/75 backdrop-blur-xl">
        <div className="flex h-14 items-center gap-2 px-3 sm:px-5">
          <Link
            href="/app"
            className="flex items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-muted transition-colors hover:bg-white/5 hover:text-ink"
            aria-label="Back to your pages"
          >
            <ArrowLeft className="size-4" />
            <LogoMark className="size-6" />
          </Link>
          <span className="hidden min-w-0 items-center gap-2 text-sm md:flex">
            <span className="text-dim">/</span>
            <span className="max-w-[28ch] truncate text-muted">{title || "Untitled"}</span>
          </span>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <SyncStatus state={state} />
            </div>
            <Presence peers={peers} self={self} />
            <Button variant="ghost" size="sm" className="h-9" onClick={() => setFilesOpen(true)} aria-label="Files on this page">
              <Paperclip className="size-4" />
              {fileCount > 0 ? <span className="font-mono text-xs">{fileCount}</span> : null}
            </Button>
            <Button variant="primary" size="sm" className="h-9 rounded-lg px-3.5" onClick={() => setShareOpen(true)}>
              <Share2 className="size-3.5" /> Share
            </Button>
            <Menu>
              <MenuTrigger className={buttonClass("ghost", "icon", "size-9")} aria-label="More options">
                <MoreHorizontal className="size-4" />
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Copy />} onSelect={copyLink}>
                  Copy share link
                </MenuItem>
                <MenuItem icon={<Paperclip />} onSelect={() => setFilesOpen(true)}>
                  Files
                </MenuItem>
                <MenuSeparator />
                {isOwner ? (
                  <MenuItem danger icon={<Trash2 />} onSelect={() => setConfirmOpen(true)}>
                    Delete page
                  </MenuItem>
                ) : (
                  <MenuItem danger icon={<LogOut />} onSelect={() => setConfirmOpen(true)}>
                    Leave page
                  </MenuItem>
                )}
              </MenuContent>
            </Menu>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[860px] px-2 pt-14 pb-40 sm:px-6 sm:pt-20">
        <div className="px-[28px] sm:px-[54px]">
          <textarea
            ref={titleRef}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editorRef.current?.focus();
              }
            }}
            placeholder="Untitled"
            rows={1}
            maxLength={120}
            aria-label="Page title"
            className="w-full resize-none overflow-hidden bg-transparent text-[clamp(34px,5vw,48px)] leading-[1.08] font-semibold tracking-[-0.045em] text-ink outline-none placeholder:text-s4"
          />
          <p className="mt-3 flex items-center gap-2 text-[13px] text-dim">
            <span className="sm:hidden">
              <SyncStatus state={state} />
            </span>
            <span className="hidden sm:inline">
              {isOwner ? "You own this page" : "Shared with you"} · type <kbd className="rounded border border-line2 px-1 font-mono">/</kbd> for blocks
            </span>
          </p>
        </div>

        <div className="mt-6">
          {session && synced ? (
            <BlockEditor
              doc={session.doc}
              provider={session.provider}
              user={self}
              uploadFile={filesEnabled ? uploadFile : undefined}
              onReady={onReady}
            />
          ) : (
            <EditorSkeleton />
          )}
        </div>
      </main>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        docId={page.id}
        role={page.role}
        selfId={user.id}
        shareToken={shareToken}
        onTokenChange={setShareToken}
      />

      <FilesPanel
        open={filesOpen}
        onOpenChange={setFilesOpen}
        docId={page.id}
        role={page.role}
        selfId={user.id}
        enabled={filesEnabled}
        revision={filesRev}
        onCount={setFileCount}
        onMutated={bumpFiles}
        onInsertText={insertText}
        onInsertImage={(url, name) => insertBlocks([{ type: "image", props: { url, name } }])}
      />

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={isOwner ? "Delete this page?" : "Leave this page?"}
        description={
          isOwner
            ? "It's deleted for everyone, along with its files. This can't be undone."
            : "You'll lose access until someone shares the link with you again."
        }
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={removing} onClick={removePage}>
            {isOwner ? "Delete page" : "Leave page"}
          </Button>
        </div>
      </Dialog>

      {state.status === "denied" ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/85 px-6 backdrop-blur-sm">
          <div className="max-w-sm text-center">
            <h2 className="text-2xl font-semibold tracking-tight">You no longer have access</h2>
            <p className="mt-2 text-muted">The owner removed you, or the page was deleted.</p>
            <Link href="/app" className={buttonClass("primary", "lg", "mt-6")}>
              Back to your pages
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-4 px-[28px] pt-2 sm:px-[54px]" aria-label="Loading the page">
      {[92, 78, 85, 40].map((w, i) => (
        <div key={i} className="h-4 animate-pulse rounded-full bg-s2" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}
