'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';

import { mockHandlerGroups } from '@studyclub/mock/msw';
import { Toaster } from '@studyclub/ui';
import { QueryClientProvider } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/query-client';

const MSWProvider = dynamic(
  () => import('@studyclub/mock/msw').then((m) => m.MSWProvider),
  { ssr: false },
);

const loadWorker = () => import('msw/browser').then(({ setupWorker }) => setupWorker());

function MswQueryInvalidator() {
  useEffect(() => {
    const handler = () => {
      getQueryClient().invalidateQueries();
    };
    window.addEventListener('msw:config-change', handler);
    return () => window.removeEventListener('msw:config-change', handler);
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <MSWProvider mockHandlerGroups={mockHandlerGroups} loadWorker={loadWorker} fallback={null}>
      <QueryClientProvider client={queryClient}>
        <MswQueryInvalidator />
        {children}
        <Toaster position='bottom-center' />
      </QueryClientProvider>
    </MSWProvider>
  );
}
