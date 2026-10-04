'use client';

import type { HTMLAttributes } from 'react';

import { Card } from './Card';
import { cx } from './cx';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export interface AttendanceMember {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

export interface AttendanceSession {
  id: string;
  no: number;
  date?: string;
  title?: string;
}

export interface AttendanceTableProps extends HTMLAttributes<HTMLDivElement> {
  members: AttendanceMember[];
  sessions: AttendanceSession[];
  /** memberId -> sessionId -> status */
  records: Record<string, Record<string, AttendanceStatus | undefined>>;
  /** 셀 클릭 시 다음 상태로 순환 */
  onStatusChange?: (memberId: string, sessionId: string, next: AttendanceStatus | undefined) => void;
  /** 편집 가능 여부 (false면 클릭 불가) */
  readOnly?: boolean;
  /** 행 높이 밀도: 'normal'(사이트 52px) | 'compact'(콘솔 44px) */
  density?: 'normal' | 'compact';
}

const CYCLE: (AttendanceStatus | undefined)[] = ['present', 'late', 'absent', 'excused', undefined];

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: 'border-transparent bg-success-100 text-success-700 hover:bg-success-200',
  late: 'border-transparent bg-warning-100 text-warning-700 hover:bg-warning-200',
  absent: 'border-transparent bg-error-50 text-error-700 hover:bg-error-100',
  excused: 'border-transparent bg-surface-2 text-fg-secondary hover:bg-surface-3',
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  excused: '휴가',
};

/** 출석률 계산: 출석 1점, 지각 0.5점. 분모는 체크된 세션 수. */
export function calculateAttendanceRate(row?: Record<string, AttendanceStatus | undefined>): number | undefined {
  if (!row) return undefined;
  let scored = 0;
  let total = 0;
  for (const st of Object.values(row)) {
    if (!st) continue;
    total += 1;
    if (st === 'present') scored += 1;
    else if (st === 'late') scored += 0.5;
  }
  if (total === 0) return undefined;
  return Math.round((scored / total) * 100);
}

/** 출석률 임계 색: ≥80 success / 60–79 warning / <60 error */
export function attendanceRateColorClass(rate: number | undefined): string {
  if (rate === undefined) return 'text-fg-placeholder';
  if (rate >= 80) return 'text-success-700';
  if (rate >= 60) return 'text-warning-700';
  return 'text-error-700';
}

/**
 * design-system.md §9-6 Attendance Table (출석부).
 *
 * 구조:
 * - 좌측 멤버 열 고정 (sticky left-0)
 * - 상단 세션(회차) 행 고정 (sticky top-0)
 * - 셀 = 출석 chip. 탭 시 순환: 출석 → 지각 → 결석 → 휴가 → 미체크
 * - 행 높이 48~56(콘솔은 44). 헤더 bg surface-2, 구분선 border
 * - 우측 출석률 열: tabular-nums + 임계 색(≥80 success / 60–79 warning / <60 error)
 */
export function AttendanceTable({
  members,
  sessions,
  records,
  onStatusChange,
  readOnly = false,
  density = 'normal',
  className,
  ...rest
}: AttendanceTableProps) {
  function handleCellClick(memberId: string, sessionId: string, current: AttendanceStatus | undefined) {
    if (readOnly || !onStatusChange) return;
    const currentIndex = CYCLE.indexOf(current);
    const next = CYCLE[(currentIndex + 1) % CYCLE.length];
    onStatusChange(memberId, sessionId, next);
  }

  const rowHeight = density === 'compact' ? 'h-11' : 'h-13';

  return (
    <Card padding='none' className={cx('overflow-x-auto', className)} {...rest}>
      <table className='w-full border-separate border-spacing-0 text-sm'>
        <thead>
          <tr className='bg-surface-2'>
            <th className='sticky left-0 z-10 border-b border-border bg-surface-2 px-4 py-3 text-left text-xs font-semibold text-fg-muted'>
              크루
            </th>
            {sessions.map((s) => (
              <th
                key={s.id}
                className='tnum min-w-[3.75rem] border-b border-border px-1.5 py-2.5 text-center text-xs font-semibold text-fg-secondary'
              >
                <div>{s.no}회</div>
                {s.date && <div className='text-[10px] font-normal text-fg-muted'>{s.date}</div>}
              </th>
            ))}
            <th className='border-b border-border px-4 py-3 text-right text-xs font-semibold text-fg-muted'>출석률</th>
          </tr>
        </thead>
        <tbody className='divide-y divide-border'>
          {members.map((m) => {
            const memberRecord = records[m.id];
            const rate = calculateAttendanceRate(memberRecord);

            return (
              <tr key={m.id} className={cx('transition-colors hover:bg-surface-1', rowHeight)}>
                <td className='sticky left-0 z-10 whitespace-nowrap border-r border-border bg-bg px-4 py-2 font-semibold text-neutral-900'>
                  {m.name}
                  {m.role && <span className='ml-1.5 text-xs font-normal text-fg-muted'>({m.role})</span>}
                </td>

                {sessions.map((s) => {
                  const status = memberRecord?.[s.id];
                  const label = status ? STATUS_LABEL[status] : undefined;

                  return (
                    <td key={s.id} className='px-1 py-1.5 text-center'>
                      {readOnly ? (
                        <span
                          className={cx(
                            'inline-grid h-7 w-full place-items-center rounded-control text-xs font-semibold transition-colors',
                            status ? STATUS_STYLE[status] : 'text-fg-placeholder',
                          )}
                        >
                          {label ?? '—'}
                        </span>
                      ) : (
                        <button
                          type='button'
                          onClick={() => handleCellClick(m.id, s.id, status)}
                          title='클릭하여 출석 → 지각 → 결석 → 휴가 → 미체크 순환'
                          className={cx(
                            'inline-grid h-7 w-full place-items-center rounded-control text-xs font-semibold transition-colors focus-visible:shadow-(--ring) focus-visible:outline-none',
                            status
                              ? STATUS_STYLE[status]
                              : 'border border-dashed border-border-strong bg-transparent text-fg-placeholder hover:bg-surface-2',
                          )}
                        >
                          {label ?? ''}
                        </button>
                      )}
                    </td>
                  );
                })}

                <td className={cx('tnum whitespace-nowrap px-4 py-2 text-right font-bold', attendanceRateColorClass(rate))}>
                  {rate !== undefined ? `${rate}%` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
