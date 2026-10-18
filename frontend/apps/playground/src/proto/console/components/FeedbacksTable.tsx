'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@console/components/ui';
import { Badge, Pagination } from '@studyclub/ui';

import {
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABEL,
  listFeedbacks,
  type Feedback,
  type FeedbackStatus,
  type FeedbackType,
} from '@/proto/lib/feedback';

/**
 * 의견 — 사이트에서 들어온 문의·오류 신고 목록.
 *
 * 접수 시각 내림차순 고정. 거르는 칸은 유형 · 처리 상태. 20건씩. 줄을 누르면 상세.
 * 사이트에서 이 브라우저로 보낸 것도 같이 보인다(프로토 — localStorage).
 * TODO(api): GET /api/admin/feedbacks — 캡틴 전용
 */
const PAGE_SIZE = 20;

export const TYPE_TONE: Record<FeedbackType, 'error' | 'recruiting' | 'neutral'> = {
  bug: 'error',
  idea: 'recruiting',
  question: 'neutral',
};
export const STATUS_TONE: Record<FeedbackStatus, 'closingsoon' | 'inprogress' | 'ended'> = {
  new: 'closingsoon',
  seen: 'inprogress',
  done: 'ended',
};

/** 거르는 칸 — 고르기 전에는 축 이름만, 고르면 첫 줄이 「전체」 (POL-0008, 스터디 목록과 같다) */
function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T | 'all';
  onChange: (v: T | 'all') => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T | 'all')}
      className={`h-9 shrink-0 rounded-control border bg-surface px-3 text-sm outline-none focus:border-brand ${
        value === 'all' ? 'border-border-strong text-fg-secondary' : 'border-brand font-semibold text-fg'
      }`}
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

/** 보는 사람의 시간대로, 24시간제 — 발송 이력과 같은 규칙 */
export function stamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function FeedbacksTable() {
  const [rows, setRows] = useState<Feedback[] | null>(null);
  const [type, setType] = useState<FeedbackType | 'all'>('all');
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  // localStorage 를 읽으므로 마운트 뒤에 채운다
  useEffect(() => setRows(listFeedbacks()), []);

  const filtered = useMemo(
    () =>
      (rows ?? []).filter((f) => (type === 'all' || f.type === type) && (status === 'all' || f.status === status)),
    [rows, type, status],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const unseen = (rows ?? []).filter((f) => f.status === 'new').length;

  return (
    <div>
      <PageHeader title='의견' subtitle={rows ? `미확인 ${unseen}건` : undefined} />

      <div data-anno='feedback-admin:1' className='mb-3 flex flex-wrap items-center gap-2'>
        <FilterSelect
          label='유형'
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          options={FEEDBACK_TYPES}
        />
        <FilterSelect
          label='처리 상태'
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={FEEDBACK_STATUSES}
        />
        <span className='ml-auto shrink-0 pl-2 text-xs text-fg-muted'>{filtered.length}건</span>
      </div>

      <div data-anno='feedback-admin:2' className='card overflow-x-auto'>
        <table className='bo-table'>
          <thead>
            <tr>
              <th className='w-[150px] whitespace-nowrap'>접수 시각</th>
              <th className='w-[110px] whitespace-nowrap'>유형</th>
              <th className='min-w-[180px]'>제목</th>
              <th className='w-[140px] whitespace-nowrap'>제출자</th>
              <th className='w-[110px] whitespace-nowrap'>처리 상태</th>
            </tr>
          </thead>
          <tbody>
            {rows === null &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={5}>
                    <span className='block h-4 animate-pulse rounded bg-surface-2' />
                  </td>
                </tr>
              ))}
            {pageRows.map((f) => (
              <tr key={f.id} className={f.status === 'new' ? 'font-semibold' : undefined}>
                <td className='tnum whitespace-nowrap text-fg-secondary'>{stamp(f.createdAt)}</td>
                <td className='whitespace-nowrap'>
                  <Badge tone={TYPE_TONE[f.type]}>{FEEDBACK_TYPE_LABEL[f.type]}</Badge>
                </td>
                <td className='max-w-0'>
                  <Link
                    href={`/proto/console/feedbacks/${f.id}`}
                    className='block truncate underline-offset-4 hover:text-brand hover:underline'
                  >
                    {f.title}
                  </Link>
                </td>
                <td className='whitespace-nowrap text-fg-secondary'>{f.author ?? '비회원'}</td>
                <td className='whitespace-nowrap'>
                  <Badge tone={STATUS_TONE[f.status]} dot>
                    {FEEDBACK_STATUS_LABEL[f.status]}
                  </Badge>
                </td>
              </tr>
            ))}
            {rows !== null && pageRows.length === 0 && (
              <tr>
                <td colSpan={5} className='py-10 text-center text-fg-muted'>
                  {rows.length === 0 ? '접수된 의견이 없습니다.' : '조건에 맞는 의견이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination className='mt-4' page={current} total={pageCount} onChange={setPage} />
    </div>
  );
}
