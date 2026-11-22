'use client';

import { Suspense, useEffect, useState } from 'react';

import { Button, Pagination } from '@studyclub/ui';
import { Plus } from 'lucide-react';

import { PageHeader } from '@/components/ui';
import { EventCreateDialog } from '@/features/events/EventCreateDialog';
import { EventsTable } from '@/features/events/EventsTable';
import { useEvents } from '@/features/events/queries';
import { TimezoneNote } from '@/features/notifications/components/TimezoneNote';
import { pageOf, useUrlState } from '@/lib/use-url-state';

const URL_DEFAULTS = { page: '1' };

export default function EventsAdmin() {
  return (
    <Suspense>
      <EventsAdminContent />
    </Suspense>
  );
}

function EventsAdminContent() {
  const [filters, setFilters] = useUrlState(URL_DEFAULTS);
  const page = pageOf(filters.page);
  const [creating, setCreating] = useState(false);
  const { data, error, isPending, isPlaceholderData } = useEvents(page);

  // 범위 밖 페이지(서버는 빈 items + 실제 total)면 마지막 페이지로
  useEffect(() => {
    if (!data || isPlaceholderData) return;
    if (data.items.length === 0 && data.offset >= data.total && page > 1) {
      setFilters({ page: String(Math.max(1, Math.ceil(data.total / data.limit))) });
    }
  }, [data, isPlaceholderData, page, setFilters]);

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader
        title='행사 관리'
        action={
          <Button size='sm' leadingIcon={<Plus size={15} />} onClick={() => setCreating(true)}>
            행사 등록
          </Button>
        }
      />
      {error && (
        <div role='alert' className='mb-4 rounded-xl border border-border bg-bg p-6 text-sm text-danger-fg'>
          {error.message}
        </div>
      )}
      <TimezoneNote />
      {isPending && !error && <p className='py-10 text-center text-sm text-fg-muted'>불러오는 중…</p>}
      {data && <EventsTable rows={data.items} />}
      <Pagination page={page} total={pageCount} onChange={(next) => setFilters({ page: String(next) })} className='mt-4' />
      <EventCreateDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
