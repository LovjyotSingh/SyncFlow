import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotForm } from "@/components/auth/forgot-form";
import { emailEnabled } from "@/lib/email";

export const metadata: Metadata = { title: "Reset your password" };
// Whether email is set up is read at request time, so adding SMTP later needs no rebuild.
export const dynamic = "force-dynamic";

export default function ForgotPage() {
  return (
    <AuthShell
      title={
        <>
          Reset your <span className="serif-accent text-grad">password.</span>
        </>
      }
      subtitle="We'll email you a 6-digit code to set a new one."
    >
      <ForgotForm enabled={emailEnabled()} />
    </AuthShell>
  );
}
