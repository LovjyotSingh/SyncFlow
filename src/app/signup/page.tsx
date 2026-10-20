import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/next-path";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);
  return (
    <AuthShell
      title={
        <>
          Start writing <span className="serif-accent text-grad">together.</span>
        </>
      }
      subtitle="Create a free account. It takes ten seconds."
    >
      <AuthForm mode="signup" next={next} />
    </AuthShell>
  );
}
