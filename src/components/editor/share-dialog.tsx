"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, RotateCcw, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Invite, Member, Role } from "@/lib/docs";
import { shareUrl } from "@/lib/share";
import { api, colorFor } from "@/lib/utils";

type People = { members: Member[]; invites: Invite[] };

export function ShareDialog({
  open,
  onOpenChange,
  docId,
  role,
  selfId,
  shareToken,
  onTokenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docId: string;
  role: Role;
  selfId: string;
  shareToken: string;
  onTokenChange: (token: string) => void;
}) {
  const [people, setPeople] = useState<People | null>(null);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const isOwner = role === "owner";
  // Dialog content only renders in the browser, after it opens.
  const link = typeof window === "undefined" ? "" : shareUrl(window.location.origin, shareToken);

  useEffect(() => {
    if (!open) return;
    api<People>(`/api/docs/${docId}/members`)
      .then(setPeople)
      .catch((err) => toast.error(err.message));
  }, [open, docId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Couldn't copy. Select the link and copy it yourself.");
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    try {
      const res = await api<People & { result: "added" | "invited" }>(`/api/docs/${docId}/members`, {
        method: "POST",
        json: { email },
      });
      setPeople(res);
      toast.success(
        res.result === "added" ? `${email} can now open this page.` : `Invite saved. ${email} joins as soon as they sign up.`,
      );
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send that invite.");
    } finally {
      setInviting(false);
    }
  }

  async function remove(target: { userId: string } | { email: string }) {
    try {
      setPeople(await api<People>(`/api/docs/${docId}/members`, { method: "DELETE", json: target }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove them.");
    }
  }

  async function resetLink() {
    setResetting(true);
    try {
      const { shareToken: next } = await api<{ shareToken: string }>(`/api/docs/${docId}/share`, { method: "POST" });
      onTokenChange(next);
      setConfirmReset(false);
      toast.success("New link ready. The old one no longer works.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reset the link.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setConfirmReset(false);
        onOpenChange(next);
      }}
      title="Share this page"
      description="Anyone with the link can edit after they sign in."
      className="max-w-lg"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={link} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} className="font-mono text-[13px] pointer-coarse:text-base" />
        <Button variant="primary" onClick={copy} className="h-11 w-full rounded-xl sm:w-28">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      {isOwner ? (
        <div className="mt-2.5 flex items-center gap-2 text-[13px]">
          {confirmReset ? (
            <>
              <span className="text-muted">Old links will stop working.</span>
              <button onClick={resetLink} disabled={resetting} className="font-medium text-bad hover:underline">
                {resetting ? "Resetting…" : "Reset link"}
              </button>
              <button onClick={() => setConfirmReset(false)} className="text-dim hover:text-ink">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setConfirmReset(true)} className="inline-flex items-center gap-1.5 text-dim transition-colors hover:text-ink pointer-coarse:py-2">
              <RotateCcw className="size-3.5" /> Reset link
            </button>
          )}
        </div>
      ) : null}

      <form onSubmit={invite} className="mt-6 border-t border-line pt-6">
        <label htmlFor="invite" className="text-[13px] font-medium text-muted">
          Invite by email
        </label>
        <div className="mt-2 flex gap-2">
          <Input id="invite" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" />
          <Button type="submit" variant="secondary" loading={inviting} disabled={!email.trim()} className="h-11 rounded-xl">
            Invite
          </Button>
        </div>
      </form>

      <div className="mt-6">
        <p className="text-[13px] font-medium text-muted">People on this page</p>
        <ul className="mt-3 flex max-h-64 flex-col gap-1 overflow-y-auto scrollbar-thin">
          {!people
            ? [0, 1].map((i) => <li key={i} className="h-12 animate-pulse rounded-xl bg-s2" />)
            : people.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03]">
                  <Avatar name={m.name} color={colorFor(m.id)} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {m.name} {m.id === selfId ? <span className="text-dim">(you)</span> : null}
                    </span>
                    <span className="block truncate text-xs text-dim">{m.email}</span>
                  </span>
                  <span className="text-xs text-dim capitalize">{m.role}</span>
                  {isOwner && m.role !== "owner" ? (
                    <button
                      onClick={() => remove({ userId: m.id })}
                      className="grid size-7 place-items-center rounded-lg text-dim hover:bg-white/5 hover:text-bad pointer-coarse:size-10"
                      aria-label={`Remove ${m.name}`}
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
          {people?.invites.map((i) => (
            <li key={i.email} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <span className="grid size-8 place-items-center rounded-full border border-dashed border-line2 text-xs text-dim">@</span>
              <span className="min-w-0 flex-1 truncate text-sm text-muted">{i.email}</span>
              <span className="text-xs text-dim">Invited</span>
              {isOwner ? (
                <button
                  onClick={() => remove({ email: i.email })}
                  className="grid size-7 place-items-center rounded-lg text-dim hover:bg-white/5 hover:text-bad pointer-coarse:size-10"
                  aria-label={`Cancel invite for ${i.email}`}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
