import { Suspense } from 'react';

import type { Metadata } from 'next';

import { MyFeedbackList } from '@/features/feedback/MyFeedbackList';

export const metadata: Metadata = { title: '내 문의' };

// 페이지·`?write=1` 을 URL 에서 읽는다(useSearchParams) — 정적 프리렌더에서는 Suspense 경계가 있어야 레이아웃이 함께 렌더된다
export default function MyFeedbacksPage() {
  return (
    <Suspense>
      <MyFeedbackList />
    </Suspense>
  );
}
