'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useDisplayTimeZone } from '@core/lib/use-display-timezone';
import type { BadgeTone } from '@studyclub/ui';
import { Badge } from '@studyclub/ui';
import { ArrowRight, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';

import { useEventWorkspace } from './EventWorkspace';
import { CHANNEL_LABEL, REGISTRATION_LABEL, SELF, formatDate } from './model';

const STATUS_TONE: Record<keyof typeof REGISTRATION_LABEL, BadgeTone> = {
  PENDING: 'closingsoon',
  CONFIRMED: 'recruiting',
  DECLINED: 'error',
  CANCELLED: 'neutral',
};

/** 마이페이지에서는 최근 신청만 짧게 보여 주고, 각 행에서 행사 상세로 이동한다. */
export function MyEventsSummary({ locale }: { locale: string }) {
  const { state } = useEventWorkspace();
  const displayTimeZone = useDisplayTimeZone();
  const [expanded, setExpanded] = useState(false);
  const rows = (state?.registrations ?? [])
    .filter((registration) => registration.memberId === SELF.memberId)
    .map((registration) => ({
      registration,
      event: state?.events.find((event) => event.id === registration.eventId),
    }))
    .filter((row): row is typeof row & { event: NonNullable<typeof row.event> } => Boolean(row.event))
    .sort((a, b) => Date.parse(b.registration.createdAt) - Date.parse(a.registration.createdAt));
  const recent = rows.slice(0, 3);
  const visible = expanded ? rows : recent;

  return (
    <section data-anno='my-events:1' className='mt-10'>
      <div className='mb-3 flex items-center justify-between gap-4'>
        <div className='flex items-baseline gap-2'>
          <h2 className='type-title-md'>내 행사</h2>
          {state && <span className='tnum type-label-sm text-fg-muted'>{rows.length}건</span>}
        </div>
        <Link
          href={`/proto/core/${locale}/events`}
          className='inline-flex items-center gap-1 type-label-sm text-brand hover:underline'
        >
          행사 둘러보기 <ArrowRight aria-hidden size={14} />
        </Link>
      </div>

      <div className='card divide-y divide-border'>
        {!state ? (
          <p role='status' className='px-5 py-6 type-body-sm text-fg-muted'>행사 신청 내역을 불러오는 중입니다.</p>
        ) : recent.length ? (
          visible.map(({ event, registration }) => (
            <Link
              key={registration.id}
              href={`/proto/core/${locale}/events/${event.id}`}
              className='group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-1'
            >
              <CalendarDays aria-hidden size={20} className='shrink-0 text-brand' />
              <div className='min-w-0 flex-1'>
                <p className='truncate type-label-lg text-fg group-hover:text-brand'>{event.title}</p>
                <p className='mt-1 truncate type-body-sm text-fg-muted'>
                  {formatDate(event.startsAt, displayTimeZone)} · {CHANNEL_LABEL[registration.channel]}
                </p>
              </div>
              <Badge tone={STATUS_TONE[registration.status]} dot>
                {REGISTRATION_LABEL[registration.status]}
              </Badge>
            </Link>
          ))
        ) : (
          <div className='px-5 py-6'>
            <p className='type-body-sm text-fg-muted'>아직 신청한 행사가 없습니다.</p>
          </div>
        )}
        {rows.length > recent.length && (
          <button
            type='button'
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
            className='flex w-full items-center justify-center gap-1.5 px-5 py-3 type-label-sm text-fg-secondary transition-colors hover:bg-surface-1 hover:text-fg'
          >
            {expanded ? (
              <>접기 <ChevronUp aria-hidden size={15} /></>
            ) : (
              <>전체 {rows.length}건 펼쳐보기 <ChevronDown aria-hidden size={15} /></>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
