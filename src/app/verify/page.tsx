import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyForm } from "@/components/auth/verify-form";
import { getSession, needsVerification } from "@/lib/auth";
import { safeNext } from "@/lib/next-path";

export const metadata: Metadata = { title: "Confirm your email" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function VerifyPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const user = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!needsVerification(user)) redirect(next);
  return (
    <AuthShell
      title={
        <>
          Check your <span className="serif-accent text-grad">inbox.</span>
        </>
      }
      subtitle="Confirm your email so nobody else can use it to join pages."
    >
      <VerifyForm email={user.email} next={next} emailSent={params.sent !== "0"} />
    </AuthShell>
  );
}
