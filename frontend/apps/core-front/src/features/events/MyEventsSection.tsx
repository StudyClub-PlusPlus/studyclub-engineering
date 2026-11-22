'use client';

import Link from 'next/link';
import { useState } from 'react';

import {
  CHANNEL_LABEL,
  REGISTRATION_STATUS_LABEL,
  registrationTone,
} from '@/features/events/labels';
import { formatEventInstant } from '@/features/events/format';
import { useMyEvents } from '@/features/events/queries';
import { getUser } from '@/features/auth/auth';
import { useDisplayTimeZone } from '@/features/profile/use-display-timezone';
import type { Locale } from '@studyclub/types';
import { Badge, Button } from '@studyclub/ui';
import { ArrowRight, CalendarDays } from 'lucide-react';

export function MyEventsSection({ locale }: { locale: Locale }) {
  const user = getUser();
  const enabled = Boolean(user?.onboardingCompletedAt);
  const { data } = useMyEvents(enabled);
  const displayTimeZone = useDisplayTimeZone();
  const [expanded, setExpanded] = useState(false);

  if (!enabled) return null;

  const rows = data ?? [];
  const recent = rows.slice(0, 3);
  const visible = expanded ? rows : recent;

  return (
    <section className='mt-10'>
      <div className='mb-3 flex items-center justify-between gap-4'>
        <div className='flex items-baseline gap-2'>
          <h2 className='type-title-md'>{locale === 'ko' ? '내 행사' : 'My events'}</h2>
          <span className='tnum type-label-sm text-fg-muted'>{rows.length}</span>
        </div>
        <Link
          href={`/${locale}/events`}
          className='inline-flex items-center gap-1 type-label-sm text-brand hover:underline'
        >
          {locale === 'ko' ? '행사 둘러보기' : 'Browse events'} <ArrowRight aria-hidden size={14} />
        </Link>
      </div>

      <div className='card divide-y divide-border'>
        {rows.length === 0 ? (
          <p className='px-5 py-6 type-body-sm text-fg-muted'>
            {locale === 'ko' ? '아직 신청한 행사가 없습니다.' : 'You have not applied to any events yet.'}
          </p>
        ) : (
          visible.map((row) => (
            <Link
              key={row.eventId}
              href={`/${locale}/events/${row.eventId}`}
              className='group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-1'
            >
              <CalendarDays aria-hidden size={20} className='shrink-0 text-brand' />
              <div className='min-w-0 flex-1'>
                <p className='truncate type-label-lg text-fg group-hover:text-brand'>{row.title}</p>
                <p className='mt-1 truncate type-body-sm text-fg-muted'>
                  {formatEventInstant(row.startsAt, displayTimeZone, locale)} ·{' '}
                  {CHANNEL_LABEL[row.registration.channel]?.[locale]}
                </p>
              </div>
              <Badge tone={registrationTone(row.registration.status)} dot>
                {REGISTRATION_STATUS_LABEL[row.registration.status]?.[locale]}
              </Badge>
            </Link>
          ))
        )}
        {rows.length > recent.length && (
          <Button type='button' variant='tertiary' className='w-full rounded-none' onClick={() => setExpanded((v) => !v)}>
            {expanded
              ? locale === 'ko'
                ? '접기'
                : 'Collapse'
              : locale === 'ko'
                ? `전체 ${rows.length}건 펼쳐보기`
                : `Show all ${rows.length}`}
          </Button>
        )}
      </div>
    </section>
  );
}