"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/utils";
import { CodeInput, ErrorNote, PASSWORD_HINT, PasswordInput, SpamHint } from "./form-bits";

export function ForgotForm({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const address = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    try {
      await api("/api/auth/forgot", { method: "POST", json: { email: address } });
      setEmail(address);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function reset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await api("/api/auth/reset", {
        method: "POST",
        json: { email, code: form.get("code"), password: form.get("password") },
      });
      toast.success("Password changed. Sign in with your new password.");
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      setLoading(false);
    }
  }

  if (!enabled) {
    return (
      <p className="rounded-xl border border-line2 bg-white/[0.03] px-3.5 py-3 text-sm text-muted">
        Password reset by email isn&apos;t set up on this site yet.{" "}
        <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    );
  }

  if (step === "email") {
    return (
      <form onSubmit={requestCode} className="flex flex-col gap-5" noValidate>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required maxLength={254} autoFocus />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
          Email me a code
        </Button>
        <p className="text-center text-sm text-muted">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-ink underline-offset-4 hover:underline pointer-coarse:inline-block pointer-coarse:py-2">
            Sign in
          </Link>
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={reset} className="flex flex-col gap-5" noValidate>
      <p className="text-sm text-muted">
        If <strong className="font-medium break-all text-ink">{email}</strong> has a SyncFlow account, we sent it a 6-digit
        code. It expires in 15 minutes.
      </p>
      <SpamHint />
      <Field label="Code from the email" htmlFor="code">
        <CodeInput id="code" autoFocus />
      </Field>
      <Field label="New password" htmlFor="password" hint={<span className="text-xs text-dim">{PASSWORD_HINT}</span>}>
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={8} maxLength={72} />
      </Field>
      <ErrorNote>{error}</ErrorNote>
      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
        Set new password
      </Button>
      <p className="-mt-1 text-center text-xs text-dim">This signs you out on every device.</p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-center"
        onClick={() => {
          setStep("email");
          setError(null);
        }}
      >
        Use a different email
      </Button>
    </form>
  );
}
