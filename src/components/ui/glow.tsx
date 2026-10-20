"use client";

import { useEffect, useRef } from "react";
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
        if (e.pointerType !== "mouse") return;
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

/**
 * The rotating eclipse ring used behind hero sections. It pauses while off screen,
 * and uses a lighter blur on phones, so it doesn't drain battery or GPU.
 */
export function Halo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([entry]) => el.toggleAttribute("data-paused", !entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} aria-hidden className={cn("sf-halo pointer-events-none absolute rounded-full", className)}>
      <div className="absolute -inset-[3%] animate-spin-slow rounded-full opacity-80 blur-[56px] [background:var(--spectrum)] max-sm:blur-[32px]" />
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
