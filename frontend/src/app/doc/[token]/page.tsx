'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { joinShare } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { BootScreen } from '@/components/Workspace';

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.token;
    if (!getToken()) {
      router.replace(`/login?redirect=/doc/${token}`);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const document = await joinShare(token);
        if (!cancelled) router.replace(`/?doc=${document._id}`);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not open this page');
      }
    })();
    return () => { cancelled = true; };
  }, [params.token, router]);

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink px-6 text-center text-paper">
        <div>
          <h1 className="font-serif text-4xl">Link unavailable</h1>
          <p className="mt-3 text-mist">{error}</p>
          <button type="button" onClick={() => router.replace('/')} className="mt-6 rounded-full bg-saffron px-5 py-3 text-sm font-medium text-ink">
            Back to your pages
          </button>
        </div>
      </main>
    );
  }

  return <BootScreen />;
}
