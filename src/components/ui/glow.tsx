"use client";

import { cn } from "@/lib/utils";

/** A container whose border lights up where the cursor is. */
export function GlowCard({
  className,
  children,
  as: Tag = "div",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "article" | "section" | "li" }) {
  return (
    <Tag
      {...props}
      onPointerMove={(e: React.PointerEvent<HTMLElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
        props.onPointerMove?.(e);
      }}
      className={cn("glow-card", className)}
    >
      {children}
    </Tag>
  );
}

/** The rotating eclipse ring used behind hero sections. */
export function Halo({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute rounded-full", className)}>
      <div className="absolute -inset-[3%] animate-spin-slow rounded-full opacity-80 blur-[56px] [background:var(--spectrum)]" />
      <div className="absolute inset-0 rounded-full bg-bg" />
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(50%_50%_at_50%_0%,rgb(255_255_255/0.07),transparent_40%)]" />
      <div
        className="absolute -inset-px animate-spin-slow rounded-full p-[1.5px] [background:var(--spectrum)]"
        style={{
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
    </div>
  );
}
