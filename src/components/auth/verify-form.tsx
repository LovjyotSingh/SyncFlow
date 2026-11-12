"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { api } from "@/lib/utils";
import { CodeInput, ErrorNote, SpamHint } from "./form-bits";

const RESEND_SECONDS = 60;

export function VerifyForm({ email, next, emailSent = true }: { email: string; next: string; emailSent?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(emailSent ? null : "We couldn't send the email. Tap “Send a new code”.");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [wait, setWait] = useState(emailSent ? RESEND_SECONDS : 0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api("/api/auth/verify", { method: "POST", json: { code: new FormData(e.currentTarget).get("code") } });
      toast.success("Email confirmed. Welcome to SyncFlow!");
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      setLoading(false);
    }
  }

  async function resend() {
    setError(null);
    setResending(true);
    try {
      await api("/api/auth/verify/resend", { method: "POST" });
      toast.success(`New code sent to ${email}. Check Spam if it isn't in your inbox.`);
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send a new code.");
    } finally {
      setResending(false);
    }
  }

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <p className="text-sm text-muted">
        We sent a 6-digit code to <strong className="font-medium break-all text-ink">{email}</strong>. It expires in 15 minutes.
      </p>
      <SpamHint />
      <Field label="Confirmation code" htmlFor="code">
        <CodeInput id="code" autoFocus />
      </Field>

      <ErrorNote>{error}</ErrorNote>

      <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
        Confirm email
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Button type="button" variant="ghost" size="sm" onClick={resend} loading={resending} disabled={wait > 0}>
          {wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={signOut}>
          Use another account
        </Button>
      </div>
    </form>
  );
}
