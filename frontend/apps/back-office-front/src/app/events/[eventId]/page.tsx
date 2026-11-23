'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { Suspense } from 'react';

import { EventConsole } from '@/features/events/EventConsole';
import { useEventDetail } from '@/features/events/queries';
import { ApiError } from '@/lib/http';

/** 행사 운영 페이지. 주소 키는 `CLUB_EVENT.ID` 다. */
export default function EventAdminDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const id = /^\d+$/.test(eventId) ? Number(eventId) : NaN;
  if (Number.isNaN(id)) notFound();
  return (
    <Suspense>
      <EventDetailContent eventId={id} />
    </Suspense>
  );
}

function EventDetailContent({ eventId }: { eventId: number }) {
  const { data, error, isPending, refetch } = useEventDetail(eventId);
  if (isPending) return <p className='py-10 text-center type-body-sm text-fg-muted'>불러오는 중…</p>;

  const unavailable = error instanceof ApiError && [401, 403, 404].includes(error.status);
  if (error && (!data || unavailable)) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className='py-10 text-center'>
        <p className='type-body-sm text-fg-secondary'>{missing ? '행사를 찾을 수 없습니다.' : error.message}</p>
        <Link href='/events' className='mt-3 inline-block type-label-lg text-brand hover:underline'>
          행사 목록으로
        </Link>
      </div>
    );
  }
  return <EventConsole detail={data!} refetch={refetch} />;
}
