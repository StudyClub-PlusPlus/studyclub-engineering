'use client';

import { Badge, IconButton } from '@studyclub/ui';
import { RotateCw } from 'lucide-react';

import { TableCard } from '@/components/ui';
import { channelLabel, eventLabel, formatStamp, statusLabel, statusTone } from '@/features/notifications/labels';
import { NOTIFICATION_PAGE_SIZE, type ApiNotification } from '@/features/notifications/types';
import { useDisplayTimeZone } from '@/lib/use-display-timezone';

const COLUMNS = 6;

/**
 * 발송 이력 표. 정렬·필터·페이지는 서버가 한다 — 받은 순서 그대로 그린다(요청 시각 내림차순 고정, 열 머리로 정렬하지 않는다).
 * 행을 눌러도 아무 일도 없다 — 상세 화면이 없다.
 *
 * 수신 주소는 **서버가 가린 값을 그대로** 적는다. 펼치는 길을 두지 않는다.
 * `id`·`templateId` 는 화면에 내보내지 않는다 — 운영자가 쓸 일이 없다.
 */
export function HistoryTable({
  rows,
  resending,
  onResend,
}: {
  rows: ApiNotification[];
  /** 지금 재발송을 접수했거나 끝을 쫓는 줄 — 아이콘이 돌고 눌리지 않는다. */
  resending: ReadonlySet<number>;
  onResend: (id: number) => void;
}) {
  const tz = useDisplayTimeZone();
  return (
    <TableCard>
      <HistoryHead />
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className='tnum whitespace-nowrap text-fg-secondary'>{formatStamp(row.createdAt, tz)}</td>
            <td className='whitespace-nowrap'>{eventLabel(row.eventType)}</td>
            <td className='whitespace-nowrap text-fg-secondary'>{channelLabel(row.recipientType)}</td>
            <td className='max-w-0 truncate text-fg-secondary'>{row.recipientValue}</td>
            <td>
              <StatusCell row={row} spinning={resending.has(row.id)} onResend={onResend} />
            </td>
            <td className='tnum whitespace-nowrap text-fg-secondary'>
              {row.sentAt ? formatStamp(row.sentAt, tz) : <span className='text-fg-muted'>—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </TableCard>
  );
}

function HistoryHead() {
  return (
    <thead>
      <tr>
        <th className='w-[170px] whitespace-nowrap'>요청 시각</th>
        <th className='w-[110px] whitespace-nowrap'>알림 조건</th>
        <th className='w-[70px] whitespace-nowrap'>채널</th>
        <th>수신 주소</th>
        <th className='w-[130px] whitespace-nowrap'>상태</th>
        <th className='w-[170px] whitespace-nowrap'>발송 시각</th>
      </tr>
    </thead>
  );
}

/**
 * 상태 칸 — 문구와 색을 함께 쓰고, 다시 보낼 수 있는 줄에는 **뱃지 옆 아이콘 하나**를 둔다.
 * 재발송을 칼럼으로 따로 두지 않는다 — 대부분의 줄이 빈 칼럼을 하나 세우고, 무엇을 다시 보내는지가 상태와 떨어져 읽힌다.
 * 다시 보낼 수 있는지는 서버가 준 `canResend` 를 그린다 — `status` 로 다시 판정하지 않는다.
 */
function StatusCell({
  row,
  spinning,
  onResend,
}: {
  row: ApiNotification;
  spinning: boolean;
  onResend: (id: number) => void;
}) {
  return (
    <span className='inline-flex items-center gap-1.5'>
      <Badge tone={statusTone(row.status)} dot className='whitespace-nowrap font-semibold'>
        {statusLabel(row.status)}
      </Badge>
      {(row.canResend || spinning) && (
        // 보내는 중에는 loading 으로 막는다 — design-system §9-1 은 버튼 안 스피너를 쓰지 않는다
        <IconButton
          variant='tertiary'
          size='sm'
          title='재발송'
          aria-label='재발송'
          loading={spinning}
          onClick={() => onResend(row.id)}
          icon={<RotateCw />}
        />
      )}
    </span>
  );
}

/** 읽는 중 — 표 자리에 20줄의 빈 칸. 비었을 때와 같은 높이를 지켜 화면이 들썩이지 않게 한다. */
export function HistorySkeleton() {
  return (
    <TableCard>
      <HistoryHead />
      <tbody>
        {Array.from({ length: NOTIFICATION_PAGE_SIZE }, (_, i) => (
          <tr key={i} data-testid='history-skeleton-row'>
            {Array.from({ length: COLUMNS }, (__, c) => (
              <td key={c}>
                <span className='block h-3.5 w-full max-w-[140px] animate-pulse rounded bg-surface-2' />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableCard>
  );
}

/** 표 자리에 서는 안내 한 줄(+ 버튼). 비어도 표 자리의 높이를 지킨다. */
export function HistoryNotice({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className='flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center'>
      <p className='type-body-sm text-fg-secondary'>{children}</p>
      {action}
    </div>
  );
}
