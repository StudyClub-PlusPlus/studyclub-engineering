'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { TableCard } from '@console/components/ui';
import {
  EVENT_FILTERS,
  EVENT_LABEL,
  PAGE_SIZE,
  STATUS_FILTERS,
  STATUS_LABEL,
  STATUS_TONE,
  queryNotifications,
  type NotificationStatus,
} from '@console/lib/notifications';
import { Badge, Button } from '@studyclub/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Filter = 'all' | NotificationStatus;
type EventFilter = 'all' | (typeof EVENT_FILTERS)[number]['value'];
type Phase = 'loading' | 'ready' | 'error';

/**
 * 알림 발송 이력.
 *
 * **조회만 하는 화면이다.** 재발송·취소·실패 사유 상세는 없다 — API 가 주지 않는 것을 화면이
 * 지어내면 운영자는 있지도 않은 수단을 찾는다.
 *
 * 「발송 완료」는 **보냈다는 뜻이지 받았다는 뜻이 아니다.** 수신함 도착·읽음은 알 수 없다.
 */
export function NotificationsTable() {
  const [filter, setFilter] = useState<Filter>('all');
  const [eventType, setEventType] = useState<EventFilter>('all');
  const [page, setPage] = useState(1);
  const [phase, setPhase] = useState<Phase>('loading');
  // 연타해도 **마지막 요청의 답만** 쓴다 — 먼저 보낸 요청이 늦게 와서 화면을 덮지 않게
  const latest = useRef(0);

  const offset = (page - 1) * PAGE_SIZE;
  const { items, total } = useMemo(() => queryNotifications(filter, eventType, offset), [filter, eventType, offset]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 프로토는 서버가 없다. 불러오는 사이의 화면을 보여주려고 지연만 흉내 낸다.
  useEffect(() => {
    const ticket = ++latest.current;
    setPhase('loading');
    const timer = setTimeout(() => {
      if (ticket === latest.current) setPhase('ready');
    }, 320);
    return () => clearTimeout(timer);
  }, [filter, eventType, page]);

  // 보던 페이지가 사라졌으면 첫 페이지로 — 건수가 늘거나 줄면 생긴다
  useEffect(() => {
    if (page > pages) setPage(1);
  }, [page, pages]);

  function changeFilter(next: Filter) {
    setFilter(next);
    setPage(1);
  }

  function changeEvent(next: EventFilter) {
    setEventType(next);
    setPage(1);
  }

  return (
    <div className='flex flex-col gap-3'>
      <div data-anno='history:2' className='flex flex-wrap items-center gap-3'>
        {/*
          고르기 전에는 **축 이름만** 보여준다 — 「알림 종류 전체」처럼 적으면 이미 거른 것처럼 읽힌다.
          하나 고르고 나면 첫 줄이 「전체」로 바뀌어 되돌아갈 길이 생긴다.
        */}
        <FilterSelect
          label='알림 종류'
          value={eventType}
          disabled={phase === 'loading'}
          options={EVENT_FILTERS}
          onChange={changeEvent}
        />
        <FilterSelect
          label='상태'
          value={filter}
          disabled={phase === 'loading'}
          options={STATUS_FILTERS}
          onChange={changeFilter}
        />
        <span data-anno='history:2-1' className='tnum text-sm text-fg-secondary'>
          총 {total.toLocaleString()}건
        </span>
      </div>

      <TableCard anno='history:3'>
        <thead>
          <tr>
            <th className='w-[160px] whitespace-nowrap'>요청 시각</th>
            <th className='w-[100px] whitespace-nowrap'>알림 종류</th>
            <th className='w-[80px] whitespace-nowrap'>채널</th>
            <th>수신 주소</th>
            <th className='w-[110px] whitespace-nowrap'>상태</th>
            <th className='w-[160px] whitespace-nowrap'>발송 시각</th>
          </tr>
        </thead>
        <tbody>
          {phase === 'loading' &&
            Array.from({ length: PAGE_SIZE }, (_, i) => (
              <tr key={`skeleton-${i}`}>
                {Array.from({ length: 6 }, (__, c) => (
                  <td key={c}>
                    <span className='block h-3.5 w-full max-w-[160px] animate-pulse rounded bg-surface-2' />
                  </td>
                ))}
              </tr>
            ))}

          {phase === 'ready' &&
            items.map((row) => (
              <tr key={row.id}>
                <td className='tnum whitespace-nowrap text-fg-secondary'>{stamp(row.createdAt)}</td>
                <td className='whitespace-nowrap'>{EVENT_LABEL[row.eventType] ?? row.eventType}</td>
                <td className='whitespace-nowrap text-fg-secondary'>메일</td>
                {/* 서버가 가린 값을 그대로 쓴다 — 전체 주소를 보여주는 길은 두지 않는다 */}
                <td className='truncate text-fg-secondary'>{row.recipientValue}</td>
                <td>
                  <Badge tone={STATUS_TONE[row.status] ?? 'neutral'} dot className='whitespace-nowrap font-semibold'>
                    {STATUS_LABEL[row.status] ?? row.status}
                  </Badge>
                </td>
                <td className='tnum whitespace-nowrap text-fg-secondary'>
                  {row.sentAt ? stamp(row.sentAt) : <span className='text-fg-muted'>—</span>}
                </td>
              </tr>
            ))}

          {phase === 'ready' && items.length === 0 && (
            <tr>
              <td colSpan={6} className='py-16 text-center'>
                <p className='text-sm text-fg-muted'>
                  {filter === 'all' ? '아직 알림 발송 이력이 없습니다.' : '선택한 상태의 발송 이력이 없습니다.'}
                </p>
                {filter !== 'all' && (
                  <Button size='sm' variant='secondary' className='mt-3' onClick={() => changeFilter('all')}>
                    전체 보기
                  </Button>
                )}
              </td>
            </tr>
          )}

          {phase === 'error' && (
            <tr>
              <td colSpan={6} className='py-16 text-center'>
                <p className='text-sm text-fg-secondary'>발송 이력을 불러오지 못했습니다. 다시 시도해 주세요.</p>
                <Button size='sm' variant='secondary' className='mt-3' onClick={() => setPhase('loading')}>
                  다시 시도
                </Button>
              </td>
            </tr>
          )}
        </tbody>
      </TableCard>

      {total > 0 && (
        <div data-anno='history:4' className='flex items-center justify-center gap-4 pt-1'>
          {/* 아이콘만 둔다 — 앞뒤로 넘긴다는 뜻은 화살표가 이미 말한다 */}
          <Button
            size='sm'
            variant='ghost'
            aria-label='이전 페이지'
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <span className='tnum text-sm text-fg-secondary'>
            {page} / {pages}
          </span>
          <Button
            size='sm'
            variant='ghost'
            aria-label='다음 페이지'
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </div>
  );
}

/** 거르는 칸 하나. 고르기 전에는 축 이름이 보이고, 고른 뒤에는 「전체」로 되돌릴 수 있다. */
function FilterSelect<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: 'all' | T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  onChange: (next: 'all' | T) => void;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as 'all' | T)}
      className='h-9 rounded-control border border-border-strong bg-bg px-3 text-sm disabled:bg-surface-2'
    >
      <option value='all'>{value === 'all' ? label : '전체'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * 보는 사람의 시간대로 그린다 (POL-0006). 서버는 UTC 로 주고, 브라우저가 알아서 바꾼다.
 * **약칭은 적지 않는다** — 운영자는 자기 시간대로 읽으므로 KST·PT 를 매 줄에 달 이유가 없다.
 * 읽을 수 없는 값이 오면 원문을 그대로 둔다 — 비우면 값이 없는 것으로 읽힌다.
 */
function stamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const date = at.toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return date;
}
