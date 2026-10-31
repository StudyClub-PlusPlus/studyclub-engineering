import { Suspense } from 'react';

import { PageHeader } from '@/components/ui';
import { EventCreateButton } from '@/features/events/EventCreateButton';
import { EventsTable } from '@/features/events/EventsTable';

export const metadata = { title: '행사' };

export default function EventsAdmin() {
  return (
    <div>
      <PageHeader title='행사 관리' action={<EventCreateButton />} />
      {/* 표가 조건을 URL 로 든다(useSearchParams) — 정적 프리렌더에는 Suspense 경계가 필요하다 */}
      <Suspense>
        {/* TODO(api): GET /api/events — 행사 API 가 없어 빈 목록이다. 예시 행사는 걷어냈다 */}
        <EventsTable events={[]} />
      </Suspense>
    </div>
  );
}
