import { Suspense } from 'react';

import { events } from '@studyclub/mock';

import { EventCreateButton } from '@/components/EventCreateButton';
import { PageHeader } from '@/components/ui';
import { EventsTable } from '@/features/events/EventsTable';

export const metadata = { title: '행사' };

export default function EventsAdmin() {
  return (
    <div>
      <PageHeader title='행사 관리' action={<EventCreateButton />} />
      {/* 표가 조건을 URL 로 든다(useSearchParams) — 정적 프리렌더에는 Suspense 경계가 필요하다 */}
      <Suspense>
        <EventsTable events={events} />
      </Suspense>
    </div>
  );
}
