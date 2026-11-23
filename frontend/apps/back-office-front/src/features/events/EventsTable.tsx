'use client';

import Link from 'next/link';

import { Badge } from '@studyclub/ui';

import { TableCard } from '@/components/ui';
import { DISPLAY_STATUS_TONE, formatInstant } from '@/features/events/format';
import { DISPLAY_STATUS_LABEL, type EventListItem } from '@/features/events/types';
import { useDisplayTimeZone } from '@/lib/use-display-timezone';

export function EventsTable({ rows }: { rows: EventListItem[] }) {
  const zone = useDisplayTimeZone();
  return (
    <TableCard>
      <thead>
        <tr>
          <th>행사</th>
          <th>일정</th>
          <th>상태</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((event) => (
          <tr key={event.eventId}>
            <td className='min-w-56'>
              <Link className='font-semibold hover:text-brand hover:underline' href={`/events/${event.eventId}`}>
                {event.title}
              </Link>
            </td>
            <td className='min-w-40 type-body-sm text-fg-secondary'>{formatInstant(event.startsAt, zone)}</td>
            <td>
              <Badge tone={DISPLAY_STATUS_TONE[event.displayStatus]} dot>
                {DISPLAY_STATUS_LABEL[event.displayStatus]}
              </Badge>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={3} className='py-10 text-center text-fg-muted'>
              아직 등록한 행사가 없습니다. 첫 행사를 만들어 보세요.
            </td>
          </tr>
        )}
      </tbody>
    </TableCard>
  );
}
