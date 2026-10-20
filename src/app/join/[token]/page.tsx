import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { getSession } from "@/lib/auth";
import { joinByToken } from "@/lib/docs";

export const metadata = { title: "Join a page" };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getSession();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);

  const id = await joinByToken(token, user.id);
  if (id) redirect(`/p/${id}`);

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <Logo className="justify-center" />
        <h1 className="mt-10 text-4xl font-semibold tracking-[-0.05em]">
          This link <span className="serif-accent text-grad">expired.</span>
        </h1>
        <p className="mt-4 text-muted">
          The owner reset the share link, or the page was deleted. Ask them to send you the new link.
        </p>
        <Link href="/app" className={buttonClass("primary", "lg", "mt-8")}>
          Go to your pages
        </Link>
      </div>
    </main>
  );
}
