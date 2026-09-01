
import { EventCreateButton } from '@console/components/EventCreateButton';
import { EventsTable } from '@console/components/EventsTable';
import { PageHeader } from '@console/components/ui';
import { events } from '@studyclub/mock';

export const metadata = { title: '행사' };

export default function EventsAdmin() {
  return (
    <div>
      <PageHeader title='행사 관리' action={<EventCreateButton />} />
      <EventsTable events={events} />
    </div>
  );
}
