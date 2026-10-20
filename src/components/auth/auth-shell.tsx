import { Halo } from "@/components/ui/glow";
import { Logo } from "@/components/ui/logo";

export function AuthShell({ title, subtitle, children }: { title: React.ReactNode; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh grid-cols-1 overflow-hidden lg:grid-cols-[1fr_1.05fr]">
      <div className="relative z-10 flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-14">
          <h1 className="animate-rise text-[40px] leading-[1.02] font-semibold tracking-[-0.05em]">{title}</h1>
          <p className="mt-3 animate-rise text-muted [animation-delay:60ms]">{subtitle}</p>
          <div className="mt-9 animate-rise [animation-delay:120ms]">{children}</div>
        </div>
        <p className="text-xs text-dim">Your password is hashed with bcrypt. Sessions are signed cookies.</p>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-line lg:block" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_60%_10%,rgb(139_92_255/0.16),transparent_70%)]" />
        <Halo className="top-[58%] left-1/2 aspect-square w-[150%] -translate-x-1/2" />
        <div className="absolute inset-x-12 top-[18%]">
          <p className="text-[clamp(40px,4.4vw,64px)] leading-[0.98] font-semibold tracking-[-0.055em]">
            The same page,
            <br />
            <span className="serif-accent text-grad">on every screen.</span>
          </p>
          <div className="mt-10 max-w-sm rounded-2xl border border-line2 bg-s1/80 p-5 backdrop-blur">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-full bg-c2 text-[11px] font-semibold text-black">A</span>
              <span className="text-sm font-medium">Asha</span>
              <span className="ml-auto font-mono text-[11px] text-dim">typing…</span>
            </div>
            <p className="mt-3 text-[15px] text-muted">
              Let&apos;s lock the launch copy today
              <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-c2" />
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
