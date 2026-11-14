'use client';

import Link from 'next/link';

import type { Locale } from '@studyclub/types';
import { Badge } from '@studyclub/ui';
import { ArrowUpRight, CalendarDays, MapPin } from 'lucide-react';

import { EventPreviewBar } from './EventPreviewBar';
import { useEventWorkspace } from './EventWorkspace';
import { CONFIRM_LABEL, FORMAT_LABEL, REGISTRATION_LABEL, SELF, eventStatus, formatDate } from './model';
import { SPECS } from '@/app/(proto)/proto/core/[locale]/events/_application/spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export function EventGuestList({ locale }: { locale: Locale }) {
  const { state, now } = useEventWorkspace();
  return (
    <section className='pb-10'>
      {SPECS.map((spec) => (
        <ScreenSpecRegistrar key={spec.scope} spec={spec} />
      ))}
      <EventPreviewBar />
      <header data-anno='event-apply:1' className='mb-8'>
        <h1 className='type-headline-lg'>함께 만나는 시간</h1>
        <p className='mt-3 type-body-md text-fg-muted'>새로운 이야기를 듣고, 경험을 나누는 스터디클럽 행사</p>
      </header>
      {!state ? (
        <p role='status'>행사를 불러오는 중입니다.</p>
      ) : (
        <div data-anno='event-apply:1-1' className='divide-y divide-border border-y border-border'>
          {state.events
            .filter((event) => event.status !== 'DRAFT' && Boolean(event.publishedAt))
            .map((event) => {
              const status = eventStatus(state, event, now);
              const registration = state.registrations.find(
                (r) => r.eventId === event.id && r.memberId === SELF.memberId,
              );
              return (
                <Link
                  key={event.id}
                  href={`/proto/core/${locale}/events/${event.id}`}
                  className='group flex items-start gap-4 py-6 sm:gap-6'
                >
                  <div
                    aria-hidden
                    className='hidden h-20 w-20 shrink-0 flex-col items-center justify-center rounded-card bg-brand-subtle text-brand sm:flex'
                  >
                    <span className='type-label-sm'>
                      {new Intl.DateTimeFormat('ko-KR', { timeZone: event.timeZone, month: 'long' }).format(
                        new Date(event.startsAt),
                      )}
                    </span>
                    <span className='type-headline-md'>
                      {new Intl.DateTimeFormat('ko-KR', { timeZone: event.timeZone, day: 'numeric' }).format(
                        new Date(event.startsAt),
                      )}
                    </span>
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='mb-2 flex flex-wrap items-center gap-2'>
                      <Badge tone={status === '모집 중' ? 'recruiting' : 'neutral'} dot>
                        {status}
                      </Badge>
                      <span className='type-label-sm text-fg-muted'>
                        {FORMAT_LABEL[event.format]} · {CONFIRM_LABEL[event.confirmation]}
                      </span>
                      {registration && <Badge tone='captain'>내 신청: {REGISTRATION_LABEL[registration.status]}</Badge>}
                    </div>
                    <h2 className='type-title-lg group-hover:text-brand'>{event.title}</h2>
                    <p className='mt-2 type-body-sm text-fg-muted'>{event.summary}</p>
                    <div className='mt-3 flex flex-wrap gap-x-4 gap-y-2 type-label-sm text-fg-muted'>
                      <span className='inline-flex items-center gap-1.5'>
                        <CalendarDays size={14} />
                        {formatDate(event.startsAt, event.timeZone)}
                      </span>
                      <span className='inline-flex items-center gap-1.5'>
                        <MapPin size={14} />
                        {event.format === 'ONLINE' ? '온라인' : event.location}
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight aria-hidden className='mt-2 shrink-0 text-fg-muted group-hover:text-brand' size={19} />
                </Link>
              );
            })}
          {!state.events.some((event) => event.status !== 'DRAFT' && Boolean(event.publishedAt)) && (
            <p className='py-12 text-center type-body-md text-fg-muted'>
              새로운 행사를 준비하고 있어요. 곧 다시 만나요.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
