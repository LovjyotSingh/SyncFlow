'use client';

import { Suspense } from 'react';
import Workspace, { BootScreen } from '@/components/Workspace';

export default function HomePage() {
  return (
    <Suspense fallback={<BootScreen />}>
      <Workspace />
    </Suspense>
  );
}
