'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';

import { mockHandlerGroups } from '@studyclub/mock/msw';
import { Button, Toaster } from '@studyclub/ui';
import { QueryClientProvider } from '@tanstack/react-query';

import { USER_KEY } from '@/lib/auth';
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

  const [sessionChanged, setSessionChanged] = useState(false);

  useEffect(() => {
    function handleStorage(event: StorageEvent) {
      if (event.storageArea !== window.localStorage || (event.key !== USER_KEY && event.key !== null)) return;
      if (event.key !== null && event.oldValue === event.newValue) return;
      setSessionChanged(true);
      queryClient.clear();
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [queryClient]);

  if (sessionChanged) {
    return (
      <div className='px-6 py-10 text-center'>
        <p role='alert' className='text-sm text-fg-secondary'>
          다른 탭에서 로그인 정보가 변경되었습니다. 다시 접속해 주세요.
        </p>
        <Button type='button' variant='secondary' className='mt-3' onClick={() => window.location.reload()}>
          다시 접속
        </Button>
      </div>
    );
  }

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
