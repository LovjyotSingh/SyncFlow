"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/utils";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isSignup = mode === "signup";
  const otherHref = `${isSignup ? "/login" : "/signup"}${next !== "/app" ? `?next=${encodeURIComponent(next)}` : ""}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      await api(`/api/auth/${mode}`, {
        method: "POST",
        json: {
          ...(isSignup ? { name: form.get("name") } : {}),
          email: form.get("email"),
          password: form.get("password"),
        },
      });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {isSignup ? (
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" placeholder="Asha Verma" required maxLength={60} autoFocus />
        </Field>
      ) : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required autoFocus={!isSignup} />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint={isSignup ? <span className="text-xs text-dim">At least 8 characters</span> : null}
      >
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : 1}
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-dim transition-colors hover:text-ink"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      {error ? (
        <p role="alert" className="rounded-xl border border-bad/25 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-1 w-full">
        {isSignup ? "Create account" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted">
        {isSignup ? "Already have an account?" : "New to SyncFlow?"}{" "}
        <Link href={otherHref} className="font-medium text-ink underline-offset-4 hover:underline">
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
