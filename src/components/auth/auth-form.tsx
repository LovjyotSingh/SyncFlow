"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { api } from "@/lib/utils";
import { ErrorNote, PASSWORD_HINT, PasswordInput } from "./form-bits";

type AuthResult = { needsVerification: boolean; emailSent?: boolean };

export function AuthForm({ mode, next, emailCodes = false }: { mode: "login" | "signup"; next: string; emailCodes?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";
  const nextQuery = next !== "/app" ? `?next=${encodeURIComponent(next)}` : "";
  const otherHref = `${isSignup ? "/login" : "/signup"}${nextQuery}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const result = await api<AuthResult>(`/api/auth/${mode}`, {
        method: "POST",
        json: {
          ...(isSignup ? { name: form.get("name") } : {}),
          email: form.get("email"),
          password: form.get("password"),
        },
      });
      const failed = result.emailSent === false ? "&sent=0" : "";
      router.replace(result.needsVerification ? `/verify?next=${encodeURIComponent(next)}${failed}` : next);
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
        <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required maxLength={254} autoFocus={!isSignup} />
      </Field>
      <Field
        label="Password"
        htmlFor="password"
        hint={
          isSignup ? (
            <span className="text-xs text-dim">{PASSWORD_HINT}</span>
          ) : (
            <Link href="/forgot" className="text-xs font-medium text-muted underline-offset-4 hover:text-ink hover:underline pointer-coarse:py-1">
              Forgot password?
            </Link>
          )
        }
      >
        <PasswordInput
          id="password"
          name="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={isSignup ? 8 : 1}
          maxLength={72}
        />
      </Field>

      <ErrorNote>{error}</ErrorNote>

      <Button type="submit" variant="primary" size="lg" loading={loading} className="mt-1 w-full">
        {isSignup ? "Create account" : "Sign in"}
      </Button>

      {isSignup && emailCodes ? (
        <p className="-mt-1 text-center text-xs text-dim">We&apos;ll email you a 6-digit code to confirm it&apos;s you.</p>
      ) : null}

      <p className="text-center text-sm text-muted">
        {isSignup ? "Already have an account?" : "New to SyncFlow?"}{" "}
        <Link href={otherHref} className="font-medium text-ink underline-offset-4 hover:underline pointer-coarse:inline-block pointer-coarse:py-2">
          {isSignup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
