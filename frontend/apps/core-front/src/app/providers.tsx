'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, type ReactNode } from 'react';

import { mockHandlerGroups } from '@studyclub/mock/msw';
import { QueryClientProvider } from '@tanstack/react-query';

import { PageViewTracker } from '@/components/PageViewTracker';
import { initAmplitude } from '@/lib/amplitude';
import { syncAnalyticsUser } from '@/lib/analytics';
import { getUser, USER_CHANGED_EVENT } from '@/lib/auth';
import { getQueryClient } from '@/lib/query-client';

const MSWProvider = dynamic(() => import('@studyclub/mock/msw').then((m) => m.MSWProvider), { ssr: false });

const loadWorker = () => import('msw/browser').then(({ setupWorker }) => setupWorker());

function AmplitudeInit() {
  useEffect(() => {
    initAmplitude();
    // 로그인·로그아웃·프로필 저장이 모두 세션 user 를 바꾸며 이 이벤트를 쏜다 — 여기 한 곳에서 맞춘다
    const sync = () => syncAnalyticsUser(getUser());
    sync();
    window.addEventListener(USER_CHANGED_EVENT, sync);
    return () => window.removeEventListener(USER_CHANGED_EVENT, sync);
  }, []);
  return null;
}

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
        <AmplitudeInit />
        <PageViewTracker />
        <MswQueryInvalidator />
        {children}
      </QueryClientProvider>
    </MSWProvider>
  );
}
