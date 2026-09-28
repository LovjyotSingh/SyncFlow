'use client';

import { Suspense, useEffect, useSyncExternalStore } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthScreen from '@/components/AuthScreen';
import { BootScreen } from '@/components/Workspace';
import { getAuthSnapshot, subscribeAuth } from '@/lib/auth';

function safeRedirect(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function LoginGate() {
  const router = useRouter();
  const search = useSearchParams();
  const redirectTo = safeRedirect(search.get('redirect'));
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const user = useSyncExternalStore(subscribeAuth, getAuthSnapshot, () => null);

  useEffect(() => {
    if (mounted && user) router.replace(redirectTo);
  }, [mounted, redirectTo, router, user]);

  if (!mounted || user) return <BootScreen />;
  return <AuthScreen redirectTo={redirectTo} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<BootScreen />}>
      <LoginGate />
    </Suspense>
  );
}
