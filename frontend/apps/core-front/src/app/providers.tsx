'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, type ReactNode } from 'react';

import { mockHandlerGroups } from '@studyclub/mock/msw';
import { QueryClientProvider } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/query-client';

const MSWProvider = dynamic(() => import('@studyclub/mock/msw').then((m) => m.MSWProvider), { ssr: false });

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
      </QueryClientProvider>
    </MSWProvider>
  );
}
