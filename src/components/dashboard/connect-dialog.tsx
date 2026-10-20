"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/utils";

export function ConnectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [link, setLink] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { id } = await api<{ id: string }>("/api/join", { method: "POST", json: { link } });
      router.push(`/p/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That link didn't work.");
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setError(null);
          setLink("");
          setLoading(false);
        }
      }}
      title="Join a page"
      description="Paste the share link someone sent you."
    >
      <form onSubmit={join} className="flex flex-col gap-4">
        <Input
          autoFocus
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://…/join/abc123"
          aria-label="Share link"
          aria-invalid={Boolean(error)}
          className="font-mono text-sm pointer-coarse:text-base"
        />
        {error ? <p role="alert" className="text-sm text-bad">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading} disabled={!link.trim()}>
            Join page
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
