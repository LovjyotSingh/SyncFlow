import { Check, FileText, Share2 } from "lucide-react";

/** A static picture of the editor with two collaborators, animated with CSS only. */
export function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <div className="absolute inset-x-[8%] -top-6 bottom-10 rounded-[40px] bg-[image:var(--grad)] opacity-25 blur-[80px]" aria-hidden />
      <div
        className="relative overflow-hidden rounded-2xl border border-line2 bg-s1 text-left shadow-[0_60px_120px_-40px_rgb(0_0_0/1)]"
        role="img"
        aria-label="The SyncFlow editor with two people editing a page called Launch plan"
      >
        {/* window bar */}
        <div className="flex items-center gap-3 border-b border-line bg-[#070708] px-4 py-3">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-s4" />
            <span className="size-2.5 rounded-full bg-s4" />
            <span className="size-2.5 rounded-full bg-s4" />
          </div>
          <div className="ml-2 truncate font-mono text-xs text-dim">syncflow / Launch plan</div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-muted sm:inline-flex">
              <span className="size-1.5 rounded-full bg-ok" /> Synced · 312 ms
            </span>
            <div className="flex -space-x-1.5">
              <span className="grid size-6 place-items-center rounded-full bg-c2 text-[10px] font-semibold text-black ring-2 ring-[#070708]">A</span>
              <span className="grid size-6 place-items-center rounded-full bg-ok text-[10px] font-semibold text-black ring-2 ring-[#070708]">K</span>
              <span className="grid size-6 place-items-center rounded-full bg-c3 text-[10px] font-semibold text-black ring-2 ring-[#070708]">Y</span>
            </div>
            <span className="hidden items-center gap-1.5 rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold text-black sm:inline-flex">
              <Share2 className="size-3" /> Share
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[200px_1fr]">
          {/* sidebar */}
          <aside className="hidden flex-col gap-1 border-r border-line p-3 md:flex">
            <p className="px-2 pt-1 pb-2 font-mono text-[10px] tracking-[0.14em] text-dim uppercase">Pages</p>
            {["Launch plan", "Design review", "Interview notes", "Sprint 14"].map((t, i) => (
              <span
                key={t}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] ${i === 0 ? "bg-white/[0.06] text-ink" : "text-muted"}`}
              >
                <FileText className="size-3.5 text-dim" /> {t}
              </span>
            ))}
          </aside>

          {/* page */}
          <div className="relative px-6 py-8 sm:px-12 sm:py-10">
            <p className="text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Launch plan</p>
            <p className="mt-2 text-sm text-dim">Edited just now by Asha and Kabir</p>

            <p className="mt-8 text-lg font-semibold tracking-tight">This week</p>
            <ul className="mt-3 space-y-2.5 text-[15px] text-muted">
              {[
                ["Finalize the pricing page copy", true],
                ["Record the 60-second demo", true],
                ["Invite the beta list", false],
              ].map(([t, done]) => (
                <li key={String(t)} className="flex items-center gap-3">
                  <span
                    className={`grid size-4.5 place-items-center rounded-[5px] border ${done ? "border-transparent bg-ink text-black" : "border-line2"}`}
                  >
                    {done ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className={done ? "text-dim line-through decoration-dim/60" : "text-ink"}>{String(t)}</span>
                </li>
              ))}
            </ul>

            <p className="mt-7 text-[15px] leading-relaxed text-muted">
              Ship on Friday once the{" "}
              <span className="relative rounded bg-ok/20 px-0.5 text-ink">
                demo video
                <span className="absolute -top-5 left-0 rounded-md rounded-bl-none bg-ok px-1.5 py-0.5 text-[10px] font-semibold text-black">
                  Kabir
                </span>
              </span>{" "}
              is approved.{" "}
              <span className="relative inline-flex items-baseline">
                <span className="inline-block max-w-0 animate-[sf-type_5s_steps(34)_infinite] overflow-hidden align-bottom whitespace-nowrap text-ink">
                  Asha is drafting the announcement now.
                </span>
                <span className="relative ml-px inline-block h-[1.15em] w-0.5 translate-y-[3px] bg-c2">
                  <span className="absolute -top-5 left-0 rounded-md rounded-bl-none bg-c2 px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap text-black">
                    Asha
                  </span>
                </span>
              </span>
            </p>

            <div className="mt-7 inline-flex items-center gap-3 rounded-xl border border-line bg-s2 px-3 py-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-c1/15 font-mono text-[10px] font-semibold text-c1">PDF</span>
              <span>
                <span className="block text-[13px] font-medium">roadmap-q4.pdf</span>
                <span className="block text-[11px] text-dim">2.4 MB · shared by Kabir</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes sf-type { 0%,8% { max-width: 0 } 55%,88% { max-width: 34ch } 100% { max-width: 0 } }`}</style>
    </div>
  );
}
