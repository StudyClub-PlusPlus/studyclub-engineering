'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { StudyclubEvent, Locale } from '@studyclub/types';
import { Badge, Segmented } from '@studyclub/ui';
import { ArrowUpRight } from 'lucide-react';

import {
  DISPLAY_STATUS_LABEL,
  FORMAT_LABEL,
  REGISTRATION_STATUS_LABEL,
  displayStatusTone,
  registrationTone,
} from '@/features/events/labels';
import { useEventList } from '@/features/events/queries';
import type { ApiEventListItem } from '@/features/events/repository';
import { useDisplayTimeZone } from '@/features/profile/use-display-timezone';
import { track } from '@/lib/analytics';
import { t } from '@/lib/i18n';

type ListView = 'upcoming' | 'past';

type PastItem =
  | { kind: 'api'; item: ApiEventListItem }
  | { kind: 'archive'; event: StudyclubEvent; date: string };

export function EventListView({
  locale,
  initial,
  archiveEvents,
  archiveDetailIds,
}: {
  locale: Locale;
  initial: ApiEventListItem[];
  archiveEvents: StudyclubEvent[];
  archiveDetailIds: string[];
}) {
  const displayTimeZone = useDisplayTimeZone();
  const { data = initial } = useEventList(initial);
  const [view, setView] = useState<ListView>('upcoming');

  const upcoming = useMemo(() => data.filter((item) => item.listGroup === 'UPCOMING'), [data]);
  const pastApi = useMemo(() => data.filter((item) => item.listGroup === 'PAST'), [data]);

  const pastArchive = useMemo(
    () => archiveEvents.map((event) => ({ kind: 'archive' as const, event, date: event.date })),
    [archiveEvents],
  );

  const pastItems = useMemo<PastItem[]>(() => {
    const apiRows = pastApi.map((item) => ({ kind: 'api' as const, item, date: item.startsAt }));
    return [...apiRows, ...pastArchive].sort((a, b) => b.date.localeCompare(a.date));
  }, [pastApi, pastArchive]);

  const counts = useMemo(
    () => ({ upcoming: upcoming.length, past: pastItems.length }),
    [upcoming.length, pastItems.length],
  );

  return (
    <section className='pb-10'>
      <h1 className='type-headline-lg'>{locale === 'ko' ? '행사' : 'Events'}</h1>
      <p className='mt-2 type-body-md text-fg-muted'>
        {locale === 'ko'
          ? '크루가 함께하는 네트워킹, 워크숍, 직업탐방이에요.'
          : 'Networking, workshops, and career talks with the crew.'}
      </p>

      <div className='mb-6 mt-8'>
        <Segmented
          shape='pill'
          aria-label={locale === 'ko' ? '행사 시점' : 'Event timing'}
          value={view}
          onChange={setView}
          options={(['upcoming', 'past'] as const).map((item) => ({
            value: item,
            label: (
              <>
                {locale === 'ko'
                  ? item === 'upcoming'
                    ? '예정된 행사'
                    : '지난 행사'
                  : item === 'upcoming'
                    ? 'Upcoming'
                    : 'Past'}{' '}
                <span className='tnum type-label-sm text-fg-muted'>{counts[item]}</span>
              </>
            ),
          }))}
        />
      </div>

      <div className='divide-y divide-border border-y border-border'>
        {view === 'upcoming' &&
          upcoming.map((item) => (
            <ApiRow key={item.eventId} item={item} locale={locale} displayTimeZone={displayTimeZone} />
          ))}
        {view === 'past' &&
          pastItems.map((row) =>
            row.kind === 'api' ? (
              <ApiRow key={`api-${row.item.eventId}`} item={row.item} locale={locale} displayTimeZone={displayTimeZone} />
            ) : (
              <ArchiveRow
                key={row.event.id}
                event={row.event}
                locale={locale}
                hasDetail={archiveDetailIds.includes(row.event.id)}
              />
            ),
          )}
        {view === 'upcoming' && upcoming.length === 0 && (
          <p className='py-12 text-center type-body-md text-fg-muted'>
            {locale === 'ko' ? '새로운 행사를 준비하고 있어요. 곧 다시 만나요.' : 'New events are on the way.'}
          </p>
        )}
        {view === 'past' && pastItems.length === 0 && (
          <p className='py-12 text-center type-body-md text-fg-muted'>
            {locale === 'ko' ? '아직 지난 행사가 없습니다.' : 'No past events yet.'}
          </p>
        )}
      </div>
    </section>
  );
}

function ApiRow({ item, locale, displayTimeZone }: { item: ApiEventListItem; locale: Locale; displayTimeZone: string }) {
  const statusLabel = DISPLAY_STATUS_LABEL[item.displayStatus]?.[locale] ?? item.displayStatus;
  return (
    <Link
      href={`/${locale}/events/${item.eventId}`}
      className='group flex items-start gap-4 py-6 sm:gap-6'
      onClick={() =>
        track({
          name: 'Event Card Clicked',
          props: { event_id: String(item.eventId), event_title_ko: item.title, source: 'events_list' },
        })
      }
    >
      <DateBadge iso={item.startsAt} locale={locale} timeZone={displayTimeZone} />
      <div className='min-w-0 flex-1'>
        <div className='mb-2 flex flex-wrap items-center gap-2'>
          <span className='type-label-sm text-fg-secondary'>{FORMAT_LABEL[item.format]?.[locale]}</span>
          <Badge tone={displayStatusTone(item.displayStatus)} dot>
            {statusLabel}
          </Badge>
          {item.myRegistration && (
            <Badge tone={registrationTone(item.myRegistration.status)} dot>
              {locale === 'ko' ? '내 신청: ' : 'Applied: '}
              {REGISTRATION_STATUS_LABEL[item.myRegistration.status]?.[locale]}
            </Badge>
          )}
        </div>
        <h2 className='type-title-lg group-hover:text-brand'>{item.title}</h2>
        <p className='mt-2 type-body-sm text-fg-muted'>{item.summary}</p>
      </div>
      <ArrowUpRight aria-hidden className='mt-2 shrink-0 text-fg-muted group-hover:text-brand' size={19} />
    </Link>
  );
}

function ArchiveRow({
  event,
  locale,
  hasDetail,
}: {
  event: StudyclubEvent;
  locale: Locale;
  hasDetail: boolean;
}) {
  const date = new Date(event.date);
  const yearOnly = event.datePrecision === 'year';
  const inner = (
    <>
      <MotionlessDateBox event={event} locale={locale} yearOnly={yearOnly} date={date} />
      <div className='min-w-0 flex-1'>
        <div className='mb-2 type-label-sm text-fg-secondary'>{t({ ko: '기록', en: 'Archive' }, locale)}</div>
        <h2 className={`type-title-lg ${hasDetail ? 'group-hover:text-brand' : ''}`}>{t(event.title, locale)}</h2>
        <p className='mt-2 type-body-sm text-fg-muted'>{t(event.summary, locale)}</p>
      </div>
      {hasDetail && <ArrowUpRight aria-hidden className='mt-2 shrink-0 text-fg-muted group-hover:text-brand' size={19} />}
    </>
  );
  return hasDetail ? (
    <Link href={`/${locale}/events/${event.id}`} className='group flex items-start gap-4 py-6 sm:gap-6'>
      {inner}
    </Link>
  ) : (
    <article className='flex items-start gap-4 py-6 sm:gap-6'>{inner}</article>
  );
}

function DateBadge({ iso, locale, timeZone }: { iso: string; locale: Locale; timeZone: string }) {
  return (
    <div className='flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-card bg-brand-subtle text-brand sm:h-20 sm:w-20'>
      <span className='type-label-sm'>
        {new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', { timeZone, month: 'long' }).format(new Date(iso))}
      </span>
      <span className='type-headline-md'>
        {new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', { timeZone, day: 'numeric' }).format(new Date(iso))}
      </span>
    </div>
  );
}

function MotionlessDateBox({
  event,
  locale,
  yearOnly,
  date,
}: {
  event: StudyclubEvent;
  locale: Locale;
  yearOnly: boolean;
  date: Date;
}) {
  return (
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
  );
}