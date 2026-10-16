'use client';

// 알림 발송 이력 — 무엇이 어디로 나갔고 지금 어떤 상태인가. 조회가 기본이고 **실패한 건만 다시 보낼 수 있다.**
// 필터·페이지는 서버가 한다(GET /api/admin/notifications). 화면에서 다시 거르지 않는다.
// 필터·페이지는 URL 쿼리가 정본이다 — 새로고침·뒤로 가기에도 남는다.
import { Suspense, useEffect, useMemo, useState } from 'react';

import { Button, Pagination } from '@studyclub/ui';
import { RotateCw } from 'lucide-react';

import { PageHeader } from '@/components/ui';
import { useNotificationTemplates } from '@/features/notification-templates/queries';
import { HistoryNotice, HistorySkeleton, HistoryTable } from '@/features/notifications/components/HistoryTable';
import { NotificationTabs } from '@/features/notifications/components/NotificationTabs';
import { ResendAllDialog } from '@/features/notifications/components/ResendAllDialog';
import { eventLabel, STATUS_OPTIONS } from '@/features/notifications/labels';
import { useNotificationResend, useNotifications } from '@/features/notifications/queries';
import { NOTIFICATION_PAGE_SIZE, type NotificationFilter } from '@/features/notifications/types';
import { pageOf, useUrlState } from '@/lib/use-url-state';

/** URL 쿼리 — `?event=USER_REGISTERED&status=FAILED&page=2`. 기본값(전체·1쪽)은 싣지 않는다. */
const URL_DEFAULTS = { event: 'ALL', status: 'ALL', page: '1' };
const URL_ALLOWED = { status: ['ALL', ...STATUS_OPTIONS.map((o) => o.value)] };

// 필터·페이지를 URL 로 든다(useSearchParams) — 정적 프리렌더에는 Suspense 경계가 필요하다
export default function NotificationHistoryPage() {
  return (
    <Suspense>
      <NotificationHistory />
    </Suspense>
  );
}

function NotificationHistory() {
  const [filters, setFilters] = useUrlState(URL_DEFAULTS, URL_ALLOWED);
  const page = pageOf(filters.page);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 거르는 선택지는 등록된 템플릿의 조건에서 온다 — 따로 관리하지 않는다
  const templates = useNotificationTemplates();
  const eventOptions = useMemo(
    () =>
      [...new Set((templates.data ?? []).map((t) => t.eventType))].map((value) => ({
        value,
        label: eventLabel(value),
      })),
    [templates.data],
  );
  // URL 은 누구나 고칠 수 있다 — 등록된 조건이 아니면 「전체」로 본다. 선택지를 읽기 전에는 서버에 묻지 않는다
  const eventKnown = filters.event === 'ALL' || !templates.isPending;
  const eventType =
    filters.event !== 'ALL' && eventOptions.some((o) => o.value === filters.event) ? filters.event : undefined;

  const filter: NotificationFilter = {
    eventType,
    status: filters.status === 'ALL' ? undefined : filters.status,
    offset: (page - 1) * NOTIFICATION_PAGE_SIZE,
    limit: NOTIFICATION_PAGE_SIZE,
  };
  const { data, error, isPending, isFetching, refetch } = useNotifications(filter, { enabled: eventKnown });
  const { resending, bulkBusy, resendOne, resendAllFailed } = useNotificationResend();

  const loading = (isPending || !eventKnown) && !error;
  const filtered = filters.event !== 'ALL' || filters.status !== 'ALL';
  const pageCount = data ? Math.max(1, Math.ceil(data.total / NOTIFICATION_PAGE_SIZE)) : 1;

  // 보던 페이지가 사라졌으면(건수가 줄었다 등) 첫 페이지로 돌아간다
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && page > 1) setFilters({ page: '1' });
  }, [data, page, setFilters]);

  // 전체 재발송은 **실패만 걸렀을 때만** 세운다 — 다른 조건에서 묶으면 이미 나간 건까지 섞여 같은 메일이 두 번 간다
  const showResendAll = filters.status === 'FAILED' && !!data && data.total > 0;

  return (
    <div>
      <PageHeader title='알림' subtitle='회원에게 나간 알림의 수신 주소와 상태. 실패한 건은 다시 보낼 수 있습니다.' />
      <NotificationTabs />

      <div className='mb-3 flex flex-wrap items-center gap-3'>
        {/* 고르기 전에는 축 이름만 보인다 — 「알림 조건 전체」처럼 적으면 이미 거른 것처럼 읽힌다. 하나 고르면 첫 줄이 「전체」다 */}
        <FilterSelect
          label='알림 조건'
          value={filters.event}
          options={eventOptions}
          disabled={loading || !!templates.error}
          onChange={(next) => setFilters({ event: next, page: '1' })}
        />
        <FilterSelect
          label='상태'
          value={filters.status}
          options={STATUS_OPTIONS}
          disabled={loading}
          onChange={(next) => setFilters({ status: next, page: '1' })}
        />
        {/* 지금 조건에 걸린 전체 건수다 — 보이는 20건이 아니다. 못 읽었을 때는 숨긴다(0건으로 보이지 않게) */}
        <span className='tnum text-sm text-fg-secondary' data-testid='history-total'>
          {data && !error && `총 ${data.total.toLocaleString()}건`}
        </span>
        {showResendAll && (
          <Button
            size='sm'
            variant='secondary'
            className='ml-auto'
            loading={bulkBusy}
            disabled={loading || isFetching}
            leadingIcon={<RotateCw size={14} />}
            onClick={() => setConfirmOpen(true)}
          >
            전체 재발송
          </Button>
        )}
      </div>

      {loading ? (
        <HistorySkeleton />
      ) : error ? (
        // 못 읽은 것과 한 건도 없는 것은 다른 일이다 — 읽기 실패를 「0건」으로 보여주지 않는다
        <HistoryNotice
          action={
            <Button size='sm' variant='secondary' onClick={() => refetch()}>
              다시 시도
            </Button>
          }
        >
          발송 이력을 불러오지 못했습니다. 다시 시도해 주세요.
        </HistoryNotice>
      ) : data && data.items.length > 0 ? (
        <HistoryTable rows={data.items} resending={resending} onResend={resendOne} />
      ) : (
        <HistoryNotice
          action={
            filtered && (
              <Button size='sm' variant='secondary' onClick={() => setFilters({ event: 'ALL', status: 'ALL', page: '1' })}>
                전체 보기
              </Button>
            )
          }
        >
          {filtered ? '선택한 조건의 발송 이력이 없습니다.' : '아직 알림 발송 이력이 없습니다.'}
        </HistoryNotice>
      )}

      {/* 이력이 한 건이라도 있을 때만 — 0건이면 줄 자체를 그리지 않는다 */}
      {data && !error && data.total > 0 && (
        <Pagination page={page} total={pageCount} onChange={(next) => setFilters({ page: String(next) })} className='mt-4' />
      )}

      <ResendAllDialog
        open={confirmOpen}
        count={data?.total ?? 0}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void resendAllFailed(eventType);
        }}
      />
    </div>
  );
}

/** 거르는 칸 하나. 고르기 전에는 축 이름이 보이고, 고른 뒤에는 첫 줄이 「전체」로 바뀌어 되돌아갈 길이 생긴다. */
function FilterSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  disabled?: boolean;
  onChange: (next: string) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className='h-9 rounded-control border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand disabled:bg-surface-2'
    >
      <option value='ALL'>{value === 'ALL' ? label : '전체'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
