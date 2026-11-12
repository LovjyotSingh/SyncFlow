"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, LogOut, ShieldCheck, Trash2 } from "lucide-react";
import { ErrorNote, PASSWORD_HINT, PasswordInput } from "@/components/auth/form-bits";
import { UserMenu } from "@/components/dashboard/user-menu";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/input";
import { Logo } from "@/components/ui/logo";
import type { SessionUser } from "@/lib/auth";
import { api } from "@/lib/utils";

function Section({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-s1/60 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-line2 bg-white/[0.03] text-muted [&_svg]:size-4">{icon}</span>
        <div className="min-w-0">
          <h2 className="font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Settings({ user, emailCodes }: { user: SessionUser; emailCodes: boolean }) {
  const router = useRouter();
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setPwError(null);
    if (form.get("newPassword") !== form.get("confirmPassword")) {
      setPwError("The new passwords don't match.");
      return;
    }
    setPwLoading(true);
    try {
      await api("/api/account/password", {
        method: "POST",
        json: { currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") },
      });
      formEl.reset();
      toast.success("Password changed. Other devices were signed out.");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setPwLoading(false);
    }
  }

  async function signOutEverywhere() {
    setSigningOut(true);
    try {
      await api("/api/account/logout-all", { method: "POST" });
      toast.success("Signed out on every device.");
      router.replace("/login");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That didn't work.");
      setSigningOut(false);
    }
  }

  async function deleteAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDeleteError(null);
    setDeleting(true);
    try {
      await api("/api/account", { method: "DELETE", json: { password: new FormData(e.currentTarget).get("password") } });
      toast.success("Your account was deleted.");
      router.replace("/");
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "That didn't work.");
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-5">
          <Logo href="/app" />
          <div className="ml-auto">
            <UserMenu user={user} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pt-10 pb-24">
        <Link href="/app" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink pointer-coarse:py-2">
          <ArrowLeft className="size-4" /> Your pages
        </Link>
        <h1 className="mt-4 text-[clamp(32px,5vw,44px)] leading-none font-semibold tracking-[-0.05em]">Settings</h1>
        <p className="mt-3 break-all text-muted">
          {user.name} · {user.email}
        </p>

        <div className="mt-10 flex flex-col gap-5">
          <Section
            icon={<ShieldCheck />}
            title="Email"
            description={emailCodes ? "Your email is confirmed with a one-time code." : "Email confirmation isn't set up on this site."}
          >
            <p className="text-sm">
              <span className="text-muted">Status: </span>
              <span className={user.emailVerified ? "text-ok" : "text-muted"}>{user.emailVerified ? "Confirmed" : "Not confirmed"}</span>
            </p>
          </Section>

          <Section icon={<KeyRound />} title="Change password" description="Other devices are signed out when you change it.">
            <form onSubmit={changePassword} className="flex max-w-sm flex-col gap-4" noValidate>
              <Field label="Current password" htmlFor="currentPassword">
                <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required maxLength={72} />
              </Field>
              <Field label="New password" htmlFor="newPassword" hint={<span className="text-xs text-dim">{PASSWORD_HINT}</span>}>
                <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" required minLength={8} maxLength={72} />
              </Field>
              <Field label="Confirm new password" htmlFor="confirmPassword">
                <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required minLength={8} maxLength={72} />
              </Field>
              <ErrorNote>{pwError}</ErrorNote>
              <Button type="submit" variant="primary" loading={pwLoading} className="self-start">
                Change password
              </Button>
            </form>
          </Section>

          <Section icon={<LogOut />} title="Sign out everywhere" description="Ends every session on every device, including this one. Use it if you lost a device.">
            <Button onClick={signOutEverywhere} loading={signingOut}>
              Sign out everywhere
            </Button>
          </Section>

          <Section
            icon={<Trash2 />}
            title="Delete account"
            description="Deletes your account, every page you own and their files, for everyone. Pages others own stay with them. This can't be undone."
          >
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              Delete my account
            </Button>
          </Section>
        </div>
      </main>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          setDeleteError(null);
        }}
        title="Delete your account?"
        description="Every page you own and its files are deleted for everyone. This can't be undone."
      >
        <form onSubmit={deleteAccount} className="flex flex-col gap-4" noValidate>
          <Field label="Enter your password to confirm" htmlFor="deletePassword">
            <PasswordInput id="deletePassword" name="password" autoComplete="current-password" required maxLength={72} />
          </Field>
          <ErrorNote>{deleteError}</ErrorNote>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={deleting}>
              Delete forever
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
