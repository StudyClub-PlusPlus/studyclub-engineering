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
    // playground 는 백엔드 없이 배포된다 — 배포 빌드에서도 MSW 가 /api/* 를 받아야 화면이 채워진다.
    <MSWProvider mockHandlerGroups={mockHandlerGroups} loadWorker={loadWorker} fallback={null} enabled>
      {children}
    </MSWProvider>
  );
}
