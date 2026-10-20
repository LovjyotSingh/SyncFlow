import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <Logo className="justify-center" />
        <p className="mt-12 font-mono text-sm text-dim">404</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">
          Nothing <span className="serif-accent text-grad">here.</span>
        </h1>
        <p className="mt-4 text-muted">This page doesn&apos;t exist, or you don&apos;t have access to it. Ask the owner for a share link.</p>
        <Link href="/app" className={buttonClass("primary", "lg", "mt-8")}>
          Go to your pages
        </Link>
      </div>
    </main>
  );
}
