import { events } from '@studyclub/mock';

import { EventCreateButton } from '@/components/EventCreateButton';
import { EventsTable } from '@/components/EventsTable';
import { PageHeader } from '@/components/ui';

export const metadata = { title: '행사' };

export default function EventsAdmin() {
  return (
    <div>
      <PageHeader title='행사 관리' action={<EventCreateButton />} />
      <EventsTable events={events} />
    </div>
  );
}
