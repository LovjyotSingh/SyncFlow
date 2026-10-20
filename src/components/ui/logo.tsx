import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <defs>
        <linearGradient id="sf-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8a3d" />
          <stop offset=".5" stopColor="#ff3d81" />
          <stop offset="1" stopColor="#8b5cff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#111113" stroke="rgb(255 255 255 / 0.14)" />
      <path d="M10 13.5a4 4 0 0 1 4-4h8M22 18.5a4 4 0 0 1-4 4h-8" fill="none" stroke="url(#sf-logo)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="22" cy="9.5" r="2" fill="#ff3d81" />
      <circle cx="10" cy="22.5" r="2" fill="#8b5cff" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight pointer-coarse:py-2", className)}>
      <LogoMark />
      <span className="text-[17px]">SyncFlow</span>
    </Link>
  );
}
