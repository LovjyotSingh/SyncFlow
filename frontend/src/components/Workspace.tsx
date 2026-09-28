'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createDocument,
  deleteDocument,
  formatWhen,
  initials,
  leaveDocument,
  listDocuments,
  ownerId,
  renameDocument,
  type SyncDocument,
} from '@/lib/api';
import { ApiError, api, getAuthSnapshot, logout, subscribeAuth, type AuthUser } from '@/lib/auth';
import type { PresenceUser } from '@/lib/collab';
import ShareDialog from './ShareDialog';

const Editor = dynamic(() => import('./Editor'), { ssr: false });

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function BootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-ink text-paper">
      <p className="font-serif text-3xl">SyncFlow</p>
    </div>
  );
}

export default function Workspace() {
  const mounted = useMounted();
  const user = useSyncExternalStore(subscribeAuth, getAuthSnapshot, () => null);
  const router = useRouter();
  const search = useSearchParams();
  const requestedId = search.get('doc');
  const [documents, setDocuments] = useState<SyncDocument[]>([]);
  const [activeId, setActiveId] = useState<string | null>(requestedId);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mounted && !user) router.replace('/login');
  }, [mounted, router, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        await api('/api/auth/me');
        const pages = await listDocuments();
        if (cancelled) return;
        setDocuments(pages);
        setActiveId((current) => {
          if (requestedId && pages.some((page) => page._id === requestedId)) return requestedId;
          if (current && pages.some((page) => page._id === current)) return current;
          return pages[0]?._id ?? null;
        });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          logout();
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Could not load pages');
      }
    })();
    return () => { cancelled = true; };
  }, [requestedId, router, user]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      void makePage();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((document) => document.title.toLowerCase().includes(needle));
  }, [documents, query]);

  const active = documents.find((document) => document._id === activeId) ?? null;

  async function makePage() {
    setError('');
    try {
      const created = await createDocument('Untitled');
      setDocuments((current) => [created, ...current]);
      setActiveId(created._id);
      setMenuOpen(false);
      router.replace(`/?doc=${created._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a page');
    }
  }

  function openPage(id: string) {
    setActiveId(id);
    setMenuOpen(false);
    router.replace(`/?doc=${id}`);
  }

  function signOut() {
    logout();
    router.replace('/login');
  }

  if (!mounted || !user) return <BootScreen />;

  return (
    <div className="min-h-dvh bg-ink text-paper lg:grid lg:grid-cols-[292px_1fr]">
      {menuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[292px] flex-col border-r border-white/10 bg-ink transition-transform lg:static lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 pt-5">
          <div>
            <p className="font-serif text-2xl leading-none">SyncFlow</p>
            <p className="mt-1 text-xs tracking-[0.18em] text-mist uppercase">Pages</p>
          </div>
          <button type="button" onClick={() => setMenuOpen(false)} className="text-sm text-mist lg:hidden">Close</button>
        </div>
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => void makePage()}
            className="flex w-full items-center justify-between rounded-2xl bg-saffron px-4 py-3 text-sm font-medium text-ink"
          >
            New page
            <kbd className="rounded-md bg-ink/10 px-1.5 py-0.5 text-[11px]">N</kbd>
          </button>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search pages"
            className="mt-3 w-full rounded-2xl border border-white/10 bg-ink-2 px-3 py-2.5 text-sm outline-none placeholder:text-mist focus:border-saffron"
          />
        </div>
        <nav className="mt-3 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {visible.length === 0 && (
            <p className="px-2 py-6 text-sm text-mist">No pages yet.</p>
          )}
          {visible.map((document) => {
            const selected = document._id === activeId;
            const shared = ownerId(document) !== user.id;
            return (
              <button
                key={document._id}
                type="button"
                onClick={() => openPage(document._id)}
                className={`w-full rounded-2xl px-3 py-3 text-left ${selected ? 'bg-white/10 ring-1 ring-saffron/50' : 'hover:bg-white/5'}`}
              >
                <span className="block truncate text-sm">{document.title || 'Untitled'}</span>
                <span className="mt-1 block text-xs text-mist">
                  {formatWhen(document.updatedAt)}{shared ? ' · Shared with you' : ''}
                </span>
              </button>
            );
          })}
        </nav>
        <div className="flex items-center gap-3 border-t border-white/10 px-4 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-full text-xs text-white" style={{ background: user.avatarColor }}>
            {initials(user.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{user.name}</span>
            <span className="block truncate text-xs text-mist">{user.email}</span>
          </span>
          <button type="button" onClick={signOut} className="text-sm text-saffron">Sign out</button>
        </div>
      </aside>

      <section className="min-h-dvh min-w-0">
        <header className="flex items-center gap-3 px-4 py-3 lg:hidden">
          <button type="button" onClick={() => setMenuOpen(true)} className="rounded-full border border-white/15 px-3 py-1.5 text-sm">
            Pages
          </button>
          <p className="truncate font-serif text-lg">{active?.title || 'SyncFlow'}</p>
        </header>
        {error && <p className="mx-4 mt-3 rounded-2xl bg-[#3a221c] px-4 py-3 text-sm text-[#f3c2b6] lg:mx-10">{error}</p>}
        {active ? (
          <DocCanvas
            key={active._id}
            document={active}
            user={user}
            onUpdated={(next) => setDocuments((current) => current.map((item) => item._id === next._id ? { ...item, ...next } : item))}
            onRemoved={(id) => {
              setDocuments((current) => current.filter((item) => item._id !== id));
              setActiveId((current) => {
                const rest = documents.filter((item) => item._id !== id);
                const next = rest[0]?._id ?? null;
                router.replace(next ? `/?doc=${next}` : '/');
                return current === id ? next : current;
              });
            }}
          />
        ) : (
          <div className="grid min-h-[70dvh] place-items-center px-6">
            <div className="max-w-md text-center">
              <h1 className="font-serif text-5xl">Start a page</h1>
              <p className="mt-3 text-mist">A blank sheet, shared the moment you send the link.</p>
              <button type="button" onClick={() => void makePage()} className="mt-6 rounded-full bg-saffron px-5 py-3 text-sm font-medium text-ink">
                New page
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function DocCanvas({
  document,
  user,
  onUpdated,
  onRemoved,
}: {
  document: SyncDocument;
  user: AuthUser;
  onUpdated: (document: SyncDocument) => void;
  onRemoved: (id: string) => void;
}) {
  const [title, setTitle] = useState(document.title);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [words, setWords] = useState(0);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [confirming, setConfirming] = useState(false);
  const isOwner = ownerId(document) === user.id;
  const others = presence.filter((person) => person.userId !== user.id);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = title.trim();
      if (!next || next === document.title) return;
      void renameDocument(document._id, next)
        .then((saved) => onUpdated({ ...document, title: saved.title, updatedAt: saved.updatedAt }))
        .catch((err) => setNotice(err instanceof Error ? err.message : 'Could not save the title'));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [document, onUpdated, title]);

  async function remove() {
    try {
      if (isOwner) await deleteDocument(document._id);
      else await leaveDocument(document._id);
      onRemoved(document._id);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Could not update the page');
    }
  }

  const statusLabel = status === 'live' ? 'Live' : status === 'offline' ? 'Offline' : 'Connecting';

  return (
    <div className="px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm text-mist">
          <span className={`inline-flex items-center gap-2 ${status === 'live' ? 'text-[#b7d7a8]' : ''}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status === 'live' ? 'bg-[#b7d7a8]' : 'bg-saffron'}`} />
            {statusLabel}
          </span>
          <span>{words} {words === 1 ? 'word' : 'words'}</span>
          <span className="hidden sm:inline">{formatWhen(document.updatedAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {presence.slice(0, 4).map((person) => (
              <span
                key={person.socketId}
                title={person.name}
                className="grid h-8 w-8 place-items-center rounded-full border-2 border-ink text-[11px] text-white"
                style={{ background: person.color }}
              >
                {initials(person.name)}
              </span>
            ))}
          </div>
          <button type="button" onClick={() => setShareOpen(true)} className="rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink">
            Share
          </button>
          {confirming ? (
            <span className="flex items-center gap-2 text-sm">
              <span className="text-mist">{isOwner ? 'Delete for everyone?' : 'Leave this page?'}</span>
              <button type="button" onClick={() => void remove()} className="text-clay">Confirm</button>
              <button type="button" onClick={() => setConfirming(false)} className="text-mist">Cancel</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className="rounded-full px-3 py-2 text-sm text-mist hover:text-paper">
              {isOwner ? 'Delete' : 'Leave'}
            </button>
          )}
        </div>
      </div>

      {others.length > 0 && (
        <p className="mb-3 text-sm text-mist">
          {others.map((person) => person.name).join(', ')} {others.length === 1 ? 'is' : 'are'} here
        </p>
      )}
      {notice && <p className="mb-3 text-sm text-[#f3c2b6]">{notice}</p>}

      <article className="mx-auto min-h-[72dvh] max-w-3xl rounded-[28px] bg-paper px-5 py-7 text-ink shadow-[0_30px_80px_rgba(0,0,0,0.28)] sm:px-10 sm:py-10">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Page title"
          className="w-full bg-transparent font-serif text-4xl leading-tight outline-none placeholder:text-[#c8bbaa] sm:text-5xl"
          placeholder="Untitled"
        />
        <p className="mt-2 mb-6 text-sm text-[#8a7f72]">Type / for headings, lists, and quotes.</p>
        <Editor
          documentId={document._id}
          user={user}
          onPresence={setPresence}
          onStatus={setStatus}
          onWords={setWords}
          onForbidden={setNotice}
        />
      </article>

      {shareOpen && (
        <ShareDialog
          document={document}
          isOwner={isOwner}
          onClose={() => setShareOpen(false)}
          onToken={(shareToken) => onUpdated({ ...document, shareToken })}
        />
      )}
    </div>
  );
}
