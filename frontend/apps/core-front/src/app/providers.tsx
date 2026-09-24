'use client';

// QueryClientProvider 는 클라이언트 컴포넌트여야 한다. layout.tsx(서버)는 이 파일만 끼운다.
import type { ReactNode } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';

import { getQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
