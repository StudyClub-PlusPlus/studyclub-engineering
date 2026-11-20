'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';

import { mockHandlerGroups } from '@studyclub/mock/msw';
import { Button, Toaster } from '@studyclub/ui';
import { QueryClientProvider } from '@tanstack/react-query';

import { USER_KEY } from '@/features/auth/auth';
import { trackHistoryNavigation } from '@/lib/history-guard';
import { isMockApiEnabled } from '@/lib/mock-api';
import { getQueryClient } from '@/lib/query-client';
import { ProfileTimeZoneSync } from '@/lib/use-display-timezone';

const MSWProvider = dynamic(() => import('@studyclub/mock/msw').then((m) => m.MSWProvider), { ssr: false });

const loadWorker = () => import('msw/browser').then(({ setupWorker }) => setupWorker());

// 다른 탭이 시간대만 고친 것은 같은 세션이다 — 사람이 바뀌었을 때만 다시 접속을 묻는다
function sessionIdOf(raw: string | null): number | null {
  try {
    return raw ? (JSON.parse(raw)?.id ?? null) : null;
  } catch {
    return null;
  }
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
  useEffect(trackHistoryNavigation, []);
  const [queryClient] = useState(() => getQueryClient());

  const [sessionChanged, setSessionChanged] = useState(false);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.storageArea !== window.localStorage || (event.key !== USER_KEY && event.key !== null)) return;
      if (event.key !== null && sessionIdOf(event.oldValue) === sessionIdOf(event.newValue)) return;
      setSessionChanged(true);
      queryClient.clear();
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [queryClient]);

  if (sessionChanged) {
    return (
      <div className='px-6 py-10 text-center'>
        <p role='alert' className='type-body-sm text-fg-secondary'>
          다른 탭에서 로그인 정보가 변경되었습니다. 다시 접속해 주세요.
        </p>
        <Button type='button' variant='secondary' className='mt-3' onClick={() => window.location.reload()}>
          다시 접속
        </Button>
      </div>
    );
  }

  const mockEnabled = isMockApiEnabled();
  const content = (
    <QueryClientProvider client={queryClient}>
      {mockEnabled && <MswQueryInvalidator />}
      <ProfileTimeZoneSync />
      {children}
      <Toaster position='bottom-center' />
    </QueryClientProvider>
  );

  if (!mockEnabled) return content;

  return (
    <MSWProvider enabled mockHandlerGroups={mockHandlerGroups} loadWorker={loadWorker} fallback={null}>
      {content}
    </MSWProvider>
  );
}
