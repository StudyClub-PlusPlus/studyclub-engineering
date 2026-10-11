'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { TableCard } from '@console/components/ui';
import { maskEmail } from '@console/lib/mask';
import {
  EVENT_FILTERS,
  EVENT_LABEL,
  failedIds,
  notifications as seeded,
  resend,
  PAGE_SIZE,
  STATUS_FILTERS,
  STATUS_LABEL,
  STATUS_TONE,
  queryNotifications,
  type NotificationStatus,
} from '@console/lib/notifications';
import { Badge, Button, Modal } from '@studyclub/ui';
import { ChevronLeft, ChevronRight, Eye, EyeOff, RotateCw } from 'lucide-react';

type Filter = 'all' | NotificationStatus;
type EventFilter = 'all' | (typeof EVENT_FILTERS)[number]['value'];
type Phase = 'loading' | 'ready' | 'error';

/**
 * 알림 발송 이력.
 *
 * **조회만 하는 화면이다.** 재발송·취소·실패 사유 상세는 없다 — API 가 주지 않는 것을 화면이
 * 지어내면 운영자는 있지도 않은 수단을 찾는다.
 *
 * 「완료」는 **보냈다는 뜻이지 받았다는 뜻이 아니다.** 수신함 도착·읽음은 알 수 없다.
 */
export function NotificationsTable() {
  const [rows, setRows] = useState(seeded);
  const [filter, setFilter] = useState<Filter>('all');
  const [eventType, setEventType] = useState<EventFilter>('all');
  const [page, setPage] = useState(1);
  // 다시 보내기 전에 묻는다. 한 건이면 그 수신처를, 묶음이면 건수를 적는다
  const [asking, setAsking] = useState<{ ids: number[]; email?: string } | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  // 연타해도 **마지막 요청의 답만** 쓴다 — 먼저 보낸 요청이 늦게 와서 화면을 덮지 않게
  const latest = useRef(0);

  const offset = (page - 1) * PAGE_SIZE;
  const { items, total } = useMemo(
    () => queryNotifications(filter, eventType, offset, rows),
    [filter, eventType, offset, rows],
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // 거른 조건에 걸린 **실패 건 전체**. 보고 있는 페이지에 한정하지 않는다
  const allFailed = useMemo(() => (filter === 'FAILED' ? failedIds(eventType, rows) : []), [filter, eventType, rows]);

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
      <div data-anno='history:1' className='flex flex-wrap items-center gap-3'>
        {/*
          고르기 전에는 **축 이름만** 보여준다 — 「알림 이름 전체」처럼 적으면 이미 거른 것처럼 읽힌다.
          하나 고르고 나면 첫 줄이 「전체」로 바뀌어 되돌아갈 길이 생긴다.
        */}
        <FilterSelect
          label='알림 조건'
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
        <span data-anno='history:1-1' className='tnum text-sm text-fg-secondary'>
          총 {total.toLocaleString()}건
        </span>
        {/*
          실패만 걸렀을 때만 선다 — 다른 조건에서는 성공한 건까지 묶여 같은 메일이 두 번 간다.
          누르는 즉시 보내지 않고 몇 건인지 알린 뒤 다시 묻는다 (POL-0008).
        */}
        {filter === 'FAILED' && allFailed.length > 0 && (
          <Button
            data-anno='history:1-2'
            size='sm'
            variant='secondary'
            className='ml-auto'
            leadingIcon={<RotateCw size={13} />}
            disabled={phase === 'loading'}
            onClick={() => setAsking({ ids: allFailed })}
          >
            전체 재발송
          </Button>
        )}
      </div>

      <TableCard anno='history:2'>
        <thead>
          <tr>
            <th className='w-[160px] whitespace-nowrap'>요청 시각</th>
            <th className='w-[150px] whitespace-nowrap'>알림 조건</th>
            <th className='w-[80px] whitespace-nowrap'>채널</th>
            <th>수신 주소</th>
            <th className='w-[130px] whitespace-nowrap'>상태</th>
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
                {/* 가린 채로 두고 필요한 줄만 펼친다 — 유저 목록과 같은 규칙 (POL-0007) */}
                <EmailCell email={row.recipientValue} />
                <td>
                  <span className='inline-flex items-center gap-1.5'>
                    <Badge tone={STATUS_TONE[row.status] ?? 'neutral'} dot className='whitespace-nowrap font-semibold'>
                      {STATUS_LABEL[row.status] ?? row.status}
                    </Badge>
                    {/*
                      실패한 건만 다시 보낸다. 상태 옆에 두면 **무엇을 다시 보내는지**가 한 줄에서 읽히고,
                      대부분 비어 있을 칼럼 하나를 표 끝에 두지 않아도 된다.
                    */}
                    {row.status === 'FAILED' && (
                      <button
                        type='button'
                        onClick={() => setAsking({ ids: [row.id], email: row.recipientValue })}
                        aria-label='재발송'
                        title='재발송'
                        className='grid h-6 w-6 shrink-0 place-items-center rounded-control text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg'
                      >
                        <RotateCw size={13} />
                      </button>
                    )}
                  </span>
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

      {/* 메일은 되돌릴 수 없다 — 지나가는 손끝에 눌려 나가지 않게 한 번 더 묻는다 (POL-0008) */}
      <Modal
        open={asking !== null}
        onClose={() => setAsking(null)}
        title='알림을 재발송합니다'
        footer={
          <>
            <Button variant='secondary' onClick={() => setAsking(null)}>
              취소
            </Button>
            <Button
              onClick={() => {
                if (asking) setRows((prev) => resend(prev, asking.ids));
                setAsking(null);
              }}
            >
              재발송
            </Button>
          </>
        }
      >
        <p className='text-sm text-fg-secondary'>
          {asking?.email ? (
            <>
              <strong className='font-semibold text-fg'>{maskEmail(asking.email)}</strong> 으로 알림을
              재발송합니다.
            </>
          ) : (
            <>
              발송 실패한 알림{' '}
              <strong className='tnum font-semibold text-fg'>{(asking?.ids.length ?? 0).toLocaleString()}건</strong>을
              재발송합니다.
            </>
          )}{' '}
          실패 기록은 그대로 남고, 새 건이 「대기」로 들어갑니다.
        </p>
      </Modal>

      {total > 0 && (
        <div data-anno='history:3' className='flex items-center justify-center gap-4 pt-1'>
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

/** 수신 주소 — 가린 채로 두고, 눈 아이콘을 누른 줄만 펼친다. 펼친 것은 그 줄에만 남는다. */
function EmailCell({ email }: { email: string }) {
  const [shown, setShown] = useState(false);
  return (
    <td className='truncate text-fg-secondary'>
      <span className='inline-flex items-center gap-1.5'>
        <span title={shown ? email : undefined}>{shown ? email : maskEmail(email)}</span>
        {/* 같은 자리의 같은 버튼이 다시 가린다 — 펼친 줄을 되돌릴 길이 없으면 옆사람이 볼 때까지 남는다 */}
        <button
          type='button'
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? '전체 주소 가리기' : '전체 주소 보기'}
          title={shown ? '가리기' : '전체 주소 보기'}
          className='grid h-6 w-6 shrink-0 place-items-center rounded-control text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg'
        >
          {shown ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </span>
    </td>
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
