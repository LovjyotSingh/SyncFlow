"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { FileText, Link2, LogOut, MoreHorizontal, Plus, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlowCard } from "@/components/ui/glow";
import { Logo } from "@/components/ui/logo";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";
import type { SessionUser } from "@/lib/auth";
import type { PageSummary } from "@/lib/docs";
import { api, cn, colorFor, timeAgo } from "@/lib/utils";
import { ConnectDialog } from "./connect-dialog";
import { UserMenu } from "./user-menu";

type Filter = "all" | "mine" | "shared";

const noopSubscribe = () => () => {};

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function Dashboard({ user, initialPages }: { user: SessionUser; initialPages: PageSummary[] }) {
  const router = useRouter();
  const [pages, setPages] = useState(initialPages);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [creating, setCreating] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  // The greeting depends on the viewer's clock, so the server renders a neutral one.
  const hello = useSyncExternalStore(noopSubscribe, greeting, () => "Welcome back");
  const searchRef = useRef<HTMLInputElement>(null);

  async function createPage() {
    if (creating) return;
    setCreating(true);
    try {
      const { id } = await api<{ id: string }>("/api/docs", { method: "POST", json: {} });
      router.push(`/p/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create a page.");
      setCreating(false);
    }
  }

  async function removePage(page: PageSummary) {
    const owner = page.role === "owner";
    setPages((list) => list.filter((p) => p.id !== page.id));
    try {
      await api(`/api/docs/${page.id}`, { method: "DELETE" });
      toast.success(owner ? `Deleted “${page.title}”` : `Left “${page.title}”`);
    } catch (err) {
      setPages((list) => [page, ...list]);
      toast.error(err instanceof Error ? err.message : "That didn't work.");
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, [contenteditable=true]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        void createPage();
      } else if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pages.filter(
      (p) =>
        (filter === "all" || (filter === "mine" ? p.role === "owner" : p.role !== "owner")) &&
        (!q || p.title.toLowerCase().includes(q) || p.ownerName.toLowerCase().includes(q)),
    );
  }, [pages, query, filter]);

  const mine = pages.filter((p) => p.role === "owner").length;
  const shared = pages.length - mine;
  const firstName = user.name.split(" ")[0] || user.name;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-5">
          <Logo href="/app" />
          <div className="relative ml-4 hidden max-w-sm flex-1 sm:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages"
              aria-label="Search pages"
              className="h-9 w-full rounded-lg border border-line bg-s1 pr-10 pl-9 text-sm outline-none placeholder:text-dim focus:border-line2"
            />
            <kbd className="absolute top-1/2 right-2 -translate-y-1/2 rounded border border-line2 px-1.5 font-mono text-[11px] text-dim">/</kbd>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConnectOpen(true)} className="h-9">
              <Link2 className="size-4" /> <span className="hidden sm:inline">Join with link</span>
            </Button>
            <Button variant="primary" size="sm" onClick={createPage} loading={creating} className="h-9 rounded-lg px-3.5">
              {creating ? null : <Plus className="size-4" />} New page
              <kbd className="ml-1 hidden rounded border border-black/15 px-1 font-mono text-[11px] text-black/50 sm:inline">N</kbd>
            </Button>
            <div className="ml-1">
              <UserMenu user={user} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pt-14 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-[clamp(34px,5vw,52px)] leading-none font-semibold tracking-[-0.05em]">
              {hello}, <span className="serif-accent text-grad">{firstName}.</span>
            </h1>
            <p className="mt-3 text-muted">
              {pages.length === 0
                ? "You don't have any pages yet."
                : `${mine} ${mine === 1 ? "page" : "pages"} of yours · ${shared} shared with you`}
            </p>
          </div>
          {pages.length > 0 ? (
            <div className="flex rounded-full border border-line p-1" role="tablist" aria-label="Filter pages">
              {(["all", "mine", "shared"] as const).map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm capitalize transition-colors",
                    filter === f ? "bg-ink font-medium text-black" : "text-muted hover:text-ink",
                  )}
                >
                  {f === "mine" ? "Mine" : f === "shared" ? "Shared" : "All"}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {pages.length === 0 ? (
          <EmptyState onCreate={createPage} creating={creating} onConnect={() => setConnectOpen(true)} />
        ) : visible.length === 0 ? (
          <p className="mt-16 text-center text-muted">No pages match “{query}”.</p>
        ) : (
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <li>
              <button
                onClick={createPage}
                className="group flex h-full min-h-[208px] w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line2 text-muted transition-colors hover:border-white/30 hover:bg-white/[0.02] hover:text-ink"
              >
                <span className="grid size-11 place-items-center rounded-xl border border-line2 bg-s2 transition-transform group-hover:scale-105">
                  <Plus className="size-5" />
                </span>
                <span className="text-sm font-medium">New page</span>
              </button>
            </li>
            {visible.map((page) => (
              <PageCard key={page.id} page={page} onRemove={() => removePage(page)} />
            ))}
          </ul>
        )}
      </main>

      <ConnectDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  );
}

function PageCard({ page, onRemove }: { page: PageSummary; onRemove: () => void }) {
  const router = useRouter();
  const color = colorFor(page.id);
  const owner = page.role === "owner";
  return (
    <GlowCard as="li" className="group relative rounded-2xl border border-line bg-[linear-gradient(180deg,#0a0a0b,#050506)] transition-transform duration-300 hover:-translate-y-0.5">
      <Link href={`/p/${page.id}`} className="block p-5 outline-none">
        <div className="relative h-24 overflow-hidden rounded-xl border border-line bg-s1">
          <div className="absolute -top-10 -right-6 size-32 rounded-full opacity-40 blur-2xl" style={{ background: color }} />
          <div className="relative flex flex-col gap-2 p-4">
            <span className="h-2 w-2/3 rounded-full bg-white/15" />
            <span className="h-1.5 w-5/6 rounded-full bg-white/[0.07]" />
            <span className="h-1.5 w-1/2 rounded-full bg-white/[0.07]" />
          </div>
        </div>
        <h2 className="mt-5 truncate pr-8 text-[17px] font-semibold tracking-tight">{page.title || "Untitled"}</h2>
        <div className="mt-2 flex items-center gap-3 text-[13px] text-dim">
          <span suppressHydrationWarning>Edited {timeAgo(page.updatedAt)}</span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" /> {page.memberCount}
          </span>
          <span
            className={cn(
              "ml-auto truncate rounded-full border px-2 py-0.5 text-[11px]",
              owner ? "border-line text-muted" : "border-c3/30 bg-c3/10 text-[#b9a3ff]",
            )}
          >
            {owner ? "Owner" : `Shared by ${page.ownerName.split(" ")[0]}`}
          </span>
        </div>
      </Link>
      <div className="absolute top-7 right-7 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <Menu>
          <MenuTrigger
            className="grid size-8 place-items-center rounded-lg border border-line2 bg-black/70 text-muted backdrop-blur hover:text-ink"
            aria-label={`Options for ${page.title}`}
          >
            <MoreHorizontal className="size-4" />
          </MenuTrigger>
          <MenuContent>
            <MenuItem icon={<FileText />} onSelect={() => router.push(`/p/${page.id}`)}>
              Open
            </MenuItem>
            {owner ? (
              <MenuItem danger icon={<Trash2 />} onSelect={onRemove}>
                Delete for everyone
              </MenuItem>
            ) : (
              <MenuItem danger icon={<LogOut />} onSelect={onRemove}>
                Leave page
              </MenuItem>
            )}
          </MenuContent>
        </Menu>
      </div>
    </GlowCard>
  );
}

function EmptyState({ onCreate, creating, onConnect }: { onCreate: () => void; creating: boolean; onConnect: () => void }) {
  return (
    <div className="relative mt-12 overflow-hidden rounded-3xl border border-line bg-s1 px-6 py-20 text-center">
      <div className="absolute inset-x-0 -top-40 mx-auto size-[520px] rounded-full bg-[image:var(--grad)] opacity-[0.12] blur-[90px]" />
      <div className="relative mx-auto max-w-md">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl border border-line2 bg-s2">
          <FileText className="size-6" />
        </span>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight">Create your first page</h2>
        <p className="mt-2 text-muted">
          Write something, then hit Share and send the link. Anyone who opens it can edit alongside you.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="primary" size="lg" onClick={onCreate} loading={creating}>
            {creating ? null : <Plus className="size-4" />} New page
          </Button>
          <Button variant="secondary" size="lg" onClick={onConnect}>
            <Link2 className="size-4" /> Join with a link
          </Button>
        </div>
        <p className="mt-6 text-xs text-dim">
          Tip: press <kbd className="rounded border border-line2 px-1 font-mono">N</kbd> anywhere to start a page.
        </p>
      </div>
    </div>
  );
}
