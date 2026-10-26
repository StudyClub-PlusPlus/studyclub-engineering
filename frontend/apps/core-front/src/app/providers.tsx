'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, type ReactNode } from 'react';

import { mockHandlerGroups } from '@studyclub/mock/msw';
import { QueryClientProvider } from '@tanstack/react-query';

import { PageViewTracker } from '@/components/PageViewTracker';
import { ThirdPartyAnalytics } from '@/components/ThirdPartyAnalytics';
import { initAmplitude } from '@/lib/amplitude';
import { captureFirstTouch, syncAnalyticsUser } from '@/lib/analytics';
import { getUser, USER_CHANGED_EVENT } from '@/lib/auth';
import { getQueryClient } from '@/lib/query-client';

const MSWProvider = dynamic(() => import('@studyclub/mock/msw').then((m) => m.MSWProvider), { ssr: false });
// 목 서버는 개발 서버에서만. ssr:false 컴포넌트로 앱 전체를 감싸면 운영에서도 서버가 빈 껍데기만 보낸다
// (BAILOUT_TO_CLIENT_SIDE_RENDERING — 검색엔진·AI 크롤러가 본문 0자를 받는다. 2026-10-22 실측)
const USE_MSW = process.env.NODE_ENV === 'development';

const loadWorker = () => import('msw/browser').then(({ setupWorker }) => setupWorker());

function AmplitudeInit() {
  useEffect(() => {
    initAmplitude();
    captureFirstTouch();
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

  const app = (
    <QueryClientProvider client={queryClient}>
      <ThirdPartyAnalytics />
      <AmplitudeInit />
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
