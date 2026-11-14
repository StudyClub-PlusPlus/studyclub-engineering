'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PageHeader, TableCard } from '@console/components/ui';
import { createEventPreviewState } from '@studyclub/mock';
import type { PreviewEvent } from '@studyclub/types';
import { Badge, Button, Modal } from '@studyclub/ui';
import { Plus } from 'lucide-react';

import { EventEditor } from './EventEditor';
import { EventPreviewBar } from './EventPreviewBar';
import { useEventWorkspace } from './EventWorkspace';
import { CONFIRM_LABEL, FORMAT_LABEL, eventStatus, formatDate, occupiesSeat } from './model';
import { SPECS } from '@/app/(proto)/proto/console/events/spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export function EventAdminList() {
  const { state, now, dispatch } = useEventWorkspace();
  const router = useRouter();
  const [draft, setDraft] = useState<PreviewEvent | null>(null);
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
      status: 'DRAFT',
      publishedAt: undefined,
    });
  }
  return (
    <>
      {SPECS.map((spec) => (
        <ScreenSpecRegistrar key={spec.scope} spec={spec} />
      ))}
      <EventPreviewBar />
      <div data-anno='event-manage:1'>
        <PageHeader
          title='행사'
          subtitle='행사를 열고, 함께할 크루를 만나세요.'
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
        <TableCard anno='event-manage:1-1'>
          <thead>
            <tr>
              <th>행사</th>
              <th>일정</th>
              <th>확정 방식</th>
              <th>신청</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {state.events.map((event) => {
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
                    <p className='mt-1 type-label-sm text-fg-muted'>{FORMAT_LABEL[event.format]}</p>
                  </td>
                  <td className='min-w-40 type-body-sm text-fg-secondary'>
                    {formatDate(event.startsAt, event.timeZone)}
                  </td>
                  <td className='whitespace-nowrap type-body-sm'>{CONFIRM_LABEL[event.confirmation]}</td>
                  <td className='whitespace-nowrap'>
                    {state.registrations.filter((r) => r.eventId === event.id && occupiesSeat(r)).length}명
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
                <td colSpan={5} className='py-10 text-center text-fg-muted'>
                  아직 등록한 행사가 없습니다. 첫 행사를 만들어 보세요.
                </td>
              </tr>
            )}
          </tbody>
        </TableCard>
      )}
      <Modal open={Boolean(draft)} onClose={() => setDraft(null)} title='행사 등록' size='lg'>
        {draft && (
          <EventEditor
            key={draft.id}
            event={draft}
            hasRegistrations={false}
            onCancel={() => setDraft(null)}
            onSave={(event) => {
              const error = dispatch({ type: 'SAVE', event });
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
