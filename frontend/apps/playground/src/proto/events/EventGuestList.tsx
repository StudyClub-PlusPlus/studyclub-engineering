'use client';

import Link from 'next/link';
import { useState } from 'react';

import { m, t } from '@core/lib/i18n';
import { useDisplayTimeZone } from '@core/lib/use-display-timezone';
import type { Locale, StudyclubEvent } from '@studyclub/types';
import { Badge } from '@studyclub/ui';
import { ArrowUpRight } from 'lucide-react';

import { useEventWorkspace } from './EventWorkspace';
import { FORMAT_LABEL, REGISTRATION_LABEL, SELF, eventStatus } from './model';
import { SPECS } from '@/app/(proto)/proto/core/[locale]/events/_application/spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

type EventListView = 'upcoming' | 'past';

export function EventGuestList({
  locale,
  archiveEvents = [],
  archiveDetailIds = [],
}: {
  locale: Locale;
  archiveEvents?: StudyclubEvent[];
  archiveDetailIds?: string[];
}) {
  const { state, now } = useEventWorkspace();
  const displayTimeZone = useDisplayTimeZone();
  const [view, setView] = useState<EventListView>('upcoming');
  const publishedEvents =
    state?.events.filter((event) => event.status !== 'DRAFT' && Boolean(event.publishedAt)) ?? [];
  const isPast = (event: (typeof publishedEvents)[number]) => {
    const status = eventStatus(state!, event, now);
    return status === '종료' || status === '행사 취소';
  };
  const upcomingEvents = publishedEvents.filter((event) => !isPast(event));
  const pastEvents = publishedEvents.filter(isPast);
  const counts = { upcoming: upcomingEvents.length, past: pastEvents.length + archiveEvents.length };
  const pastItems = [
    ...pastEvents.map((event) => ({ kind: 'preview' as const, event, date: event.startsAt })),
    ...archiveEvents.map((event) => ({ kind: 'archive' as const, event, date: event.date })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const visibleItems = view === 'upcoming'
    ? upcomingEvents.map((event) => ({ kind: 'preview' as const, event, date: event.startsAt }))
    : pastItems;
  return (
    <section className='pb-10'>
      {SPECS.map((spec) => (
        <ScreenSpecRegistrar key={spec.scope} spec={spec} />
      ))}
      <div data-anno='event-apply:1' role='tablist' aria-label='행사 시점' className='mb-6 inline-flex rounded-pill bg-surface-2 p-1'>
        {(['upcoming', 'past'] as const).map((item) => {
          const active = view === item;
          const label =
            locale === 'ko'
              ? item === 'upcoming'
                ? '예정된 행사'
                : '지난 행사'
              : item === 'upcoming'
                ? 'Upcoming events'
                : 'Past events';
          return (
            <button
              key={item}
              type='button'
              role='tab'
              aria-selected={active}
              onClick={() => setView(item)}
              className={`flex items-center gap-1.5 rounded-pill px-4 py-1.5 type-label-lg transition-colors ${
                active ? 'bg-bg text-fg shadow-sm' : 'text-fg-secondary hover:text-fg'
              }`}
            >
              {label}
              <span className={`tnum type-label-sm ${active ? 'text-fg-secondary' : 'text-fg-muted'}`}>
                {counts[item]}
              </span>
            </button>
          );
        })}
      </div>
      {!state ? (
        <p role='status'>행사를 불러오는 중입니다.</p>
      ) : (
        <>
          <div data-anno='event-apply:1-1' className='divide-y divide-border border-y border-border'>
            {visibleItems.map((item) => {
              if (item.kind === 'archive') {
                const { event } = item;
                const date = new Date(event.date);
                const yearOnly = event.datePrecision === 'year';
                const hasDetail = archiveDetailIds.includes(event.id);
                const content = (
                  <>
                    <div className='flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-card bg-brand-subtle text-brand sm:h-20 sm:w-20'>
                      {yearOnly ? (
                        <span className='type-title-md'>{event.date.slice(0, 4)}</span>
                      ) : (
                        <>
                          <span className='type-label-sm'>
                            {new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', { timeZone: 'UTC', month: 'long' }).format(date)}
                          </span>
                          <span className='type-headline-md'>
                            {new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', { timeZone: 'UTC', day: 'numeric' }).format(date)}
                          </span>
                        </>
                      )}
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='mb-2 type-label-sm text-fg-secondary'>{m(`event_type.${event.type}`, locale)}</div>
                      <h2 className={`type-title-lg ${hasDetail ? 'group-hover:text-brand' : ''}`}>{t(event.title, locale)}</h2>
                      <p className='mt-2 type-body-sm text-fg-muted'>{t(event.summary, locale)}</p>
                    </div>
                    {hasDetail && <ArrowUpRight aria-hidden className='mt-2 shrink-0 text-fg-muted group-hover:text-brand' size={19} />}
                  </>
                );
                return hasDetail ? (
                  <Link key={event.id} href={`/proto/core/${locale}/events/${event.id}`} className='group flex items-start gap-4 py-6 sm:gap-6'>
                    {content}
                  </Link>
                ) : (
                  <article key={event.id} className='flex items-start gap-4 py-6 sm:gap-6'>{content}</article>
                );
              }
              const { event } = item;
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
                    className='flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-card bg-brand-subtle text-brand sm:h-20 sm:w-20'
                  >
                    <span className='type-label-sm'>
                      {new Intl.DateTimeFormat('ko-KR', { timeZone: displayTimeZone, month: 'long' }).format(
                        new Date(event.startsAt),
                      )}
                    </span>
                    <span className='type-headline-md'>
                      {new Intl.DateTimeFormat('ko-KR', { timeZone: displayTimeZone, day: 'numeric' }).format(
                        new Date(event.startsAt),
                      )}
                    </span>
                  </div>
                  <div className='min-w-0 flex-1'>
                    <div className='mb-2 flex flex-wrap items-center gap-2'>
                      <span className='type-label-sm text-fg-secondary'>{FORMAT_LABEL[event.format]}</span>
                      <Badge tone={status === '모집 중' ? 'recruiting' : 'neutral'} dot>
                        {status}
                      </Badge>
                      {registration && <Badge tone='captain'>내 신청: {REGISTRATION_LABEL[registration.status]}</Badge>}
                    </div>
                    <h2 className='type-title-lg group-hover:text-brand'>{event.title}</h2>
                    <p className='mt-2 type-body-sm text-fg-muted'>{event.summary}</p>
                  </div>
                  <ArrowUpRight aria-hidden className='mt-2 shrink-0 text-fg-muted group-hover:text-brand' size={19} />
                </Link>
              );
            })}
            {view === 'past' && pastItems.length === 0 && (
              <p className='py-12 text-center type-body-md text-fg-muted'>아직 지난 행사가 없습니다.</p>
            )}
            {view === 'upcoming' && !visibleItems.length && (
              <p className='py-12 text-center type-body-md text-fg-muted'>
                새로운 행사를 준비하고 있어요. 곧 다시 만나요.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
