'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageHeader, TableCard } from '@console/components/ui';
import { useDisplayTimeZone } from '@core/lib/use-display-timezone';
import { createEventPreviewState } from '@studyclub/mock';
import type { PreviewEvent } from '@studyclub/types';
import { Badge, Button, Modal, Pagination } from '@studyclub/ui';
import { Plus } from 'lucide-react';

import { EventEditor } from './EventEditor';
import { useEventWorkspace } from './EventWorkspace';
import { eventAdminPage, eventStatus, formatDate } from './model';
import { SPECS } from '@/app/(proto)/proto/console/events/spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export function EventAdminList() {
  const { state, now, dispatch } = useEventWorkspace();
  const displayTimeZone = useDisplayTimeZone();
  const router = useRouter();
  const [draft, setDraft] = useState<PreviewEvent | null>(null);
  const [page, setPage] = useState(1);
  const { rows, current, pageCount } = eventAdminPage(state?.events ?? [], page);

  function create() {
    const sample = createEventPreviewState().events[0]!;
    setDraft({
      ...sample,
      id: `preview-event-${crypto.randomUUID()}`,
      title: '',
      summary: '',
      description: '',
      confirmation: 'AUTO',
      format: 'ONLINE',
      onlineCapacity: 30,
      offlineCapacity: 20,
      onlineUrl: '',
      location: '',
      questions: [],
      status: 'PUBLISHED',
      publishedAt: undefined,
      endsAt: '',
    });
  }
  return (
    <>
      {SPECS.map((spec) => (
        <ScreenSpecRegistrar key={spec.scope} spec={spec} />
      ))}
      <div data-anno='event-manage:1'>
        <PageHeader
          title='행사'
          action={
            <Button size='sm' leadingIcon={<Plus size={16} />} onClick={create}>
              행사 등록
            </Button>
          }
        />
      </div>
      {!state ? (
        <p role='status'>행사를 불러오는 중입니다.</p>
      ) : (
        <>
          <TableCard anno='event-manage:1-1'>
            <thead>
              <tr>
                <th>행사</th>
                <th>일정</th>
                <th>상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((event) => {
                const label = eventStatus(state, event, now);
                return (
                  <tr key={event.id}>
                    <td className='min-w-56'>
                      <Link
                        className='font-semibold hover:text-brand hover:underline'
                        href={`/proto/console/events/${event.id}`}
                      >
                        {event.title}
                      </Link>
                    </td>
                    <td className='min-w-40 type-body-sm text-fg-secondary'>
                      {formatDate(event.startsAt, displayTimeZone)}
                    </td>
                    <td>
                      <Badge tone={label === '모집 중' ? 'recruiting' : label === '행사 취소' ? 'error' : 'neutral'} dot>
                        {label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {state.events.length === 0 && (
                <tr>
                  <td colSpan={3} className='py-10 text-center text-fg-muted'>
                    아직 등록한 행사가 없습니다. 첫 행사를 만들어 보세요.
                  </td>
                </tr>
              )}
            </tbody>
          </TableCard>
          <Pagination className='mt-4' page={current} total={pageCount} onChange={setPage} />
        </>
      )}
      <Modal open={Boolean(draft)} onClose={() => setDraft(null)} title='행사 등록' size='lg'>
        <p className='mb-4 type-body-sm text-fg-muted'>저장하면 크루 행사 목록에 바로 공개됩니다.</p>
        {draft && (
          <EventEditor
            key={draft.id}
            event={draft}
            confirmationLocked={false}
            onCancel={() => setDraft(null)}
            onSave={(event) => {
              const error = dispatch({ type: 'CREATE', event });
              if (!error) {
                setDraft(null);
                router.push(`/proto/console/events/${event.id}`);
              }
              return error;
            }}
          />
        )}
      </Modal>
    </>
  );
}
