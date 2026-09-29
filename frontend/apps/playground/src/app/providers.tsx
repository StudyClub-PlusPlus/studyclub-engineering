'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import { mockHandlerGroups } from '@studyclub/mock/msw';

const MSWProvider = dynamic(
  () => import('@studyclub/mock/msw').then((m) => m.MSWProvider),
  { ssr: false },
);

const loadWorker = () => import('msw/browser').then(({ setupWorker }) => setupWorker());

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MSWProvider mockHandlerGroups={mockHandlerGroups} loadWorker={loadWorker} fallback={null}>
      {children}
    </MSWProvider>
  );
}
