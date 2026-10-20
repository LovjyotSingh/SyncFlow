import Link from "next/link";
import {
  ArrowRight,
  FileUp,
  GitMerge,
  Keyboard,
  Link2,
  MailPlus,
  MousePointer2,
  WifiOff,
} from "lucide-react";
import { ProductPreview } from "@/components/landing/product-preview";
import { buttonClass } from "@/components/ui/button";
import { GlowCard, Halo } from "@/components/ui/glow";
import { Logo } from "@/components/ui/logo";
import { getSession } from "@/lib/auth";

const REPO = "https://github.com/LovjyotSingh/SyncFlow";
const PORTFOLIO = "https://lovjyotsingh.github.io";

export default async function Home() {
  const user = await getSession();

  return (
    <div className="relative">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-black/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-5">
          <Logo />
          <nav className="hidden items-center gap-1 text-sm text-muted md:flex" aria-label="Sections">
            <a href="#features" className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/5 hover:text-ink">Features</a>
            <a href="#how" className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/5 hover:text-ink">How sync works</a>
            <a href={REPO} target="_blank" rel="noopener" className="rounded-full px-3 py-1.5 transition-colors hover:bg-white/5 hover:text-ink">GitHub ↗</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Link href="/app" className={buttonClass("primary", "sm", "h-9 rounded-full px-4")}>
                Open workspace <ArrowRight className="size-3.5" />
              </Link>
            ) : (
              <>
                <Link href="/login" className={buttonClass("ghost", "sm", "h-9 rounded-full px-4")}>Sign in</Link>
                <Link href="/signup" className={buttonClass("primary", "sm", "h-9 rounded-full px-4")}>Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* ---------- hero ---------- */}
        <section className="relative overflow-hidden px-5 pt-36 pb-24 text-center sm:pt-44">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[70%] bg-[radial-gradient(60%_55%_at_50%_0%,rgb(139_92_255/0.14),transparent_70%)]" />
          <div className="relative mx-auto flex max-w-4xl flex-col items-center">
            <span className="inline-flex animate-rise items-center gap-2.5 rounded-full border border-line2 bg-white/[0.03] py-1.5 pr-4 pl-2.5 text-[13px] text-muted">
              <span className="relative size-2 rounded-full bg-ok">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-ok" />
              </span>
              <b className="font-medium text-ink">Live sync on Postgres</b>· runs entirely on Vercel
            </span>
            <h1 className="mt-8 animate-rise text-[clamp(52px,9.5vw,124px)] leading-[0.92] font-semibold tracking-[-0.06em] [animation-delay:80ms]">
              <span className="bg-[linear-gradient(180deg,#fff_40%,#8e8e96_115%)] bg-clip-text text-transparent">Write together,</span>
              <br />
              <span className="serif-accent text-grad pr-2 text-[1.08em]">in sync.</span>
            </h1>
            <p className="mt-7 max-w-[58ch] animate-rise text-[clamp(16px,1.6vw,19px)] leading-relaxed text-muted [animation-delay:160ms]">
              A shared workspace where everyone edits the same page at once. Live cursors, share links and files, powered by a sync engine built from
              scratch to run on serverless functions.
            </p>
            <div className="mt-10 flex animate-rise flex-wrap justify-center gap-3 [animation-delay:240ms]">
              <Link href={user ? "/app" : "/signup"} className={buttonClass("primary", "lg")}>
                {user ? "Open your workspace" : "Start writing, it's free"} <ArrowRight className="size-4" />
              </Link>
              <a href="#how" className={buttonClass("secondary", "lg")}>
                How sync works
              </a>
            </div>
          </div>

          <div className="relative mt-20 animate-rise [animation-delay:320ms]">
            <Halo className="top-[30%] left-1/2 aspect-square w-[min(1600px,170vw)] -translate-x-1/2" />
            <div className="relative">
              <ProductPreview />
            </div>
          </div>
        </section>

        {/* ---------- tech strip ---------- */}
        <section className="border-y border-line px-5 py-8">
          <p className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-3 font-mono text-[13px] text-dim">
            {["Next.js 16", "React 19", "Yjs CRDT", "BlockNote", "Postgres · Neon", "Vercel Blob", "TypeScript"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </p>
        </section>

        {/* ---------- features ---------- */}
        <section id="features" className="scroll-mt-20 px-5 py-28 sm:py-36">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">Features</p>
              <h2 className="mt-5 text-[clamp(36px,5.2vw,64px)] leading-[1.03] font-semibold tracking-[-0.05em]">
                Everything a shared page <span className="serif-accent text-grad">needs.</span>
              </h2>
              <p className="mt-5 text-muted">Nothing it doesn&apos;t. Open a page, send the link, and start writing together.</p>
            </div>

            <div className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-6">
              <Feature
                className="md:col-span-4"
                icon={<MousePointer2 />}
                title="Live cursors and presence"
                body="See who is on the page, where they are typing, and what they have selected, each in their own colour."
                visual={
                  <div className="mt-8 flex items-center gap-4">
                    <div className="flex -space-x-2">
                      {["#ff3d81", "#34d399", "#8b5cff", "#ff8a3d"].map((c, i) => (
                        <span key={c} className="grid size-9 place-items-center rounded-full text-xs font-semibold text-black ring-2 ring-s1" style={{ background: c }}>
                          {"AKYM"[i]}
                        </span>
                      ))}
                    </div>
                    <span className="font-mono text-xs text-dim">4 people on this page</span>
                  </div>
                }
              />
              <Feature className="md:col-span-2" icon={<GitMerge />} title="Edits never collide" body="Yjs merges everyone's changes conflict-free. No locks, no “someone else is editing”." />
              <Feature className="md:col-span-2" icon={<Link2 />} title="Share by link" body="Anyone with the link joins after signing in. Reset it any time and old links stop working." />
              <Feature className="md:col-span-2" icon={<MailPlus />} title="Invite by email" body="Invite someone before they have an account. They land on the page as soon as they sign up." />
              <Feature className="md:col-span-2" icon={<FileUp />} title="Files on the page" body="Drop images, PDFs and code up to 10 MB. Everyone on the page sees them instantly." />
              <Feature className="md:col-span-3" icon={<WifiOff />} title="Shrugs off bad Wi‑Fi" body="Edits queue up while you're offline and sync the moment you're back, in the right order." />
              <Feature className="md:col-span-3" icon={<Keyboard />} title="Keyboard-first" body="Press N for a new page, / for blocks, and use Markdown shortcuts like # and - as you type." />
            </div>
          </div>
        </section>

        {/* ---------- how sync works ---------- */}
        <section id="how" className="scroll-mt-20 border-t border-line px-5 py-28 sm:py-36">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
              <div>
                <p className="eyebrow">Under the hood</p>
                <h2 className="mt-5 text-[clamp(36px,5.2vw,64px)] leading-[1.03] font-semibold tracking-[-0.05em]">
                  A sync engine that fits in a <span className="serif-accent text-grad">serverless function.</span>
                </h2>
              </div>
              <p className="text-muted lg:pb-2">
                Serverless functions can&apos;t hold WebSockets open, so SyncFlow syncs over plain HTTP instead. Each round trip is one Postgres
                transaction that stores your changes and returns everyone else&apos;s.
              </p>
            </div>

            <ol className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                ["Edit", "Yjs turns every keystroke into a small, mergeable update."],
                ["Batch", "The browser merges updates and posts them every 350 ms while anyone types, 1.5 s when quiet, 8 s in a background tab."],
                ["Store", "One transaction appends the update, refreshes your cursor and returns every change you haven't seen yet."],
                ["Compact", "After 100 updates, the log is folded into a snapshot in the background, after the response is sent."],
              ].map(([title, body], i) => (
                <GlowCard as="li" key={title} className="rounded-2xl border border-line bg-s1 p-6">
                  <span className="font-mono text-xs text-c1">0{i + 1}</span>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
                </GlowCard>
              ))}
            </ol>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
              <GlowCard className="overflow-hidden rounded-2xl border border-line bg-s1">
                <div className="flex items-center gap-2 border-b border-line px-5 py-3 font-mono text-xs text-dim">
                  <span className="rounded bg-ok/15 px-1.5 py-0.5 text-ok">POST</span> /api/docs/:id/sync
                </div>
                <pre className="scrollbar-thin overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-muted">
{`→ { "after": 1841, "clientId": 2290417,
    "update": "AQK3k4wBAAQBAXQBYQA=", "awareness": "AQG…" }

← { "cursor": 1843,
    "updates": [{ "id": 1842, "data": "AQLu…" },
                { "id": 1843, "data": "AQGp…" }],
    "peers": [{ "clientId": 88123, "state": "AQH…" }],
    "inserted": 1844, "more": false }`}
                </pre>
              </GlowCard>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ["1", "database round trip per sync"],
                  ["0", "servers to keep awake"],
                  ["3 s", "settle window, so no edit is ever skipped"],
                  ["30 s", "until a closed tab's cursor disappears"],
                ].map(([n, label]) => (
                  <div key={label} className="rounded-2xl border border-line bg-s1 p-5">
                    <p className="text-4xl font-semibold tracking-[-0.05em]">{n}</p>
                    <p className="mt-2 text-sm text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- cta ---------- */}
        <section className="relative overflow-hidden border-t border-line px-5 py-36 text-center">
          <Halo className="top-1/2 left-1/2 aspect-square w-[min(760px,140vw)] -translate-x-1/2 -translate-y-1/2 opacity-60" />
          <div className="relative mx-auto max-w-3xl">
            <h2 className="text-[clamp(44px,7vw,96px)] leading-[0.95] font-semibold tracking-[-0.06em]">
              Your next doc, <span className="serif-accent text-grad">in sync.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-md text-muted">Free to use. Create an account, open a page and send the link to your team.</p>
            <Link href={user ? "/app" : "/signup"} className={buttonClass("primary", "lg", "mt-10")}>
              {user ? "Open your workspace" : "Create your first page"} <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-8 text-sm text-dim">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <span>
            Built by{" "}
            <a href={PORTFOLIO} target="_blank" rel="noopener" className="text-muted transition-colors hover:text-ink">
              Lovjyot Singh
            </a>
          </span>
          <span className="flex gap-5">
            <a href={REPO} target="_blank" rel="noopener" className="transition-colors hover:text-ink">Source on GitHub</a>
            <span>© 2026</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
  visual,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  visual?: React.ReactNode;
  className?: string;
}) {
  return (
    <GlowCard className={`rounded-2xl border border-line bg-[linear-gradient(180deg,#0a0a0b,#050506)] p-7 ${className ?? ""}`}>
      <span className="grid size-10 place-items-center rounded-xl border border-line2 bg-s2 text-ink [&>svg]:size-[18px]">{icon}</span>
      <h3 className="mt-6 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-muted">{body}</p>
      {visual}
    </GlowCard>
  );
}
