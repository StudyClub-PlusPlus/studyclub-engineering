'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, type ReactNode } from 'react';

import { mockHandlerGroups } from '@studyclub/mock/msw';
import { QueryClientProvider } from '@tanstack/react-query';

import { AnalyticsPrivacy } from '@/components/AnalyticsPrivacy';
import { PageViewTracker } from '@/components/PageViewTracker';
import { ThirdPartyAnalytics } from '@/components/ThirdPartyAnalytics';
import { dropLegacyDemoSeed } from '@/features/account/local-state';
import { getQueryClient } from '@/lib/query-client';

const MSWProvider = dynamic(() => import('@studyclub/mock/msw').then((m) => m.MSWProvider), { ssr: false });
// 목 서버는 개발 서버에서만. ssr:false 컴포넌트로 앱 전체를 감싸면 운영에서도 서버가 빈 껍데기만 보낸다
// (BAILOUT_TO_CLIENT_SIDE_RENDERING — 검색엔진·AI 크롤러가 본문 0자를 받는다. 2026-10-22 실측)
const USE_MSW = process.env.NODE_ENV === 'development';

const loadWorker = () => import('msw/browser').then(({ setupWorker }) => setupWorker());

function MswQueryInvalidator() {
  // 예전 개발 서버가 채운 더미 신청·관심을 지운다 — MSW 를 꺼도 더미가 보였다
  useEffect(() => dropLegacyDemoSeed(), []);
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

  const app = (
    <QueryClientProvider client={queryClient}>
      <ThirdPartyAnalytics />
      <AnalyticsPrivacy />
      <PageViewTracker />
      {USE_MSW && <MswQueryInvalidator />}
      {children}
    </QueryClientProvider>
  );
  if (!USE_MSW) return app;
  return (
    <MSWProvider mockHandlerGroups={mockHandlerGroups} loadWorker={loadWorker} fallback={null}>
      {app}
    </MSWProvider>
  );
}
