"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-fade" />
        <D.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "max-h-[calc(100dvh-48px)] overflow-y-auto scrollbar-thin",
            "rounded-2xl border border-line2 bg-s1 p-6 shadow-[0_40px_120px_-20px_rgb(0_0_0/0.9)]",
            "data-[state=open]:animate-rise focus:outline-none",
            className,
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-lg font-semibold tracking-tight">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : null}
            </div>
            <D.Close
              className="-mt-1 -mr-2 grid size-8 place-items-center rounded-lg text-dim transition-colors hover:bg-white/5 hover:text-ink pointer-coarse:size-10"
              aria-label="Close"
            >
              <X className="size-4" />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
