"use client";

import { useState } from "react";
import { Eye, EyeOff, MailWarning } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Shown next to every "we emailed you" message: first emails from a new sender often land in Spam. */
export function SpamHint({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-3 rounded-xl border border-line2 bg-white/[0.03] px-3.5 py-3 text-[13px] leading-relaxed text-muted", className)}>
      <MailWarning className="mt-0.5 size-4 shrink-0 text-c1" aria-hidden />
      <p>
        Can&apos;t find it? Check your <strong className="font-medium text-ink">Spam</strong> folder. In the Gmail app, tap{" "}
        <strong className="font-medium text-ink">☰ Menu → Spam</strong>. Marking the email{" "}
        <strong className="font-medium text-ink">Not spam</strong> helps the next one arrive in your inbox.
      </p>
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-xl border border-bad/25 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">
      {children}
    </p>
  );
}

/** A 6-digit code field that phones can autofill from the email or SMS bar. */
export function CodeInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      name="code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 -]*"
      maxLength={7}
      placeholder="123456"
      required
      className="h-14 text-center font-mono text-2xl tracking-[0.4em] placeholder:tracking-[0.4em] pointer-coarse:text-2xl"
      {...props}
    />
  );
}

export function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-dim transition-colors hover:text-ink"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export const PASSWORD_HINT = "8+ characters, a letter and a number";
