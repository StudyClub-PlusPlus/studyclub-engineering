'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';

import { mockHandlerGroups } from '@studyclub/mock/msw';
import { QueryClientProvider } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/query-client';

// dynamic() 은 모듈 스코프에서 1회만 호출한다. 컴포넌트 렌더 함수 안에서 호출하면
// 매 렌더마다 새로운 lazy 컴포넌트 타입이 생성되어 하위 트리 전체가 remount 될 수 있다.
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
