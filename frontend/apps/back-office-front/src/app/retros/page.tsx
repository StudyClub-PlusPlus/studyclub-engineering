'use client';

import { Suspense } from 'react';

import { RetrosBrowser } from '@/features/meeting-retro/RetrosBrowser';

// 조건 · 페이지를 URL 로 든다(useSearchParams) — 정적 프리렌더에는 Suspense 경계가 필요하다
export default function RetrosPage() {
  return (
    <Suspense>
      <RetrosBrowser />
    </Suspense>
  );
}
