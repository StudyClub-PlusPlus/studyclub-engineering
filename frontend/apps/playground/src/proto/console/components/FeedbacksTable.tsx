'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { PageHeader } from '@console/components/ui';
import { Badge, Button, Pagination, Select, cx } from '@studyclub/ui';

import {
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABEL,
  FEEDBACK_TYPES,
  FEEDBACK_TYPE_LABEL,
  listFeedbacks,
  submitterLabel,
  type Feedback,
  type FeedbackStatus,
  type FeedbackType,
} from '@/proto/lib/feedback';

/**
 * 문의·오류 신고 — 사이트에서 들어온 문의 · 개선 의견 · 오류 신고 목록.
 *
 * 접수 시각 내림차순 고정 — 열 머리를 눌러 정렬하지 않는다.
 * 제목·내용 검색(400ms 기다렸다가) · 유형 · 상태. 무엇이든 바꾸면 1페이지로. 20건씩 — 다른 콘솔 목록과 같은 페이지 넘김.
 * 줄 어디를 눌러도 상세로 간다. 사이트에서 이 브라우저로 보낸 것도 같이 보인다(프로토 — localStorage).
 * TODO(api): GET /api/admin/feedbacks?type&status&q&offset&limit — 캡틴 전용
 */
const PAGE_SIZE = 20;

export const TYPE_TONE: Record<FeedbackType, 'neutral' | 'recruiting' | 'error'> = {
  question: 'neutral',
  idea: 'recruiting',
  bug: 'error',
};
/** 미확인 회색 · 확인 파랑 · 완료 초록. 색만으로 가르지 않는다 — 문구를 늘 붙인다 */
export const STATUS_CLASS: Record<FeedbackStatus, string> = {
  new: 'bg-surface-2 text-fg-secondary',
  seen: 'bg-primary-500/15 text-primary-600',
  done: 'bg-success-50 text-success-700',
};

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <span className={`inline-flex rounded-pill px-2 py-0.5 type-label-sm ${STATUS_CLASS[status]}`}>
      {FEEDBACK_STATUS_LABEL[status]}
    </span>
  );
}

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
    <Select
      size='sm'
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T | 'all')}
      className={cx(
        'h-9 w-auto shrink-0',
        value === 'all' ? 'border-border-strong text-fg-secondary' : 'border-brand font-semibold text-fg',
      )}
    >
      <option value='all'>{value === 'all' ? label : '전체'}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

/** 보는 사람의 시간대로, 24시간제 — 「26.10.18 14:02」 */
export function stamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${String(at.getFullYear()).slice(2)}.${p(at.getMonth() + 1)}.${p(at.getDate())} ${p(at.getHours())}:${p(at.getMinutes())}`;
}

export function FeedbacksTable() {
  const router = useRouter();
  const [rows, setRows] = useState<Feedback[] | null>(null);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState<FeedbackType | 'all'>('all');
  const [status, setStatus] = useState<FeedbackStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  // localStorage 를 읽으므로 마운트 뒤에 채운다
  useEffect(() => setRows(listFeedbacks()), []);

  // 검색은 400ms 기다렸다가 건다 — 한 글자마다 서버를 부르지 않게
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(input.trim().toLowerCase());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [input]);

  const filtered = useMemo(
    () =>
      (rows ?? []).filter(
        (f) =>
          (type === 'all' || f.type === type) &&
          (status === 'all' || f.status === status) &&
          (!query || `${f.title}\n${f.body}`.toLowerCase().includes(query)),
      ),
    [rows, type, status, query],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function resetAll() {
    setInput('');
    setQuery('');
    setType('all');
    setStatus('all');
    setPage(1);
  }

  return (
    <div>
      <PageHeader title='문의·오류 신고' />

      <div data-anno='feedback-admin:1' className='mb-3 flex flex-wrap items-center gap-2'>
        <input
          type='search'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='제목·내용 검색'
          className='h-9 w-52 shrink-0 rounded-control border border-border-strong bg-surface px-3 type-body-sm outline-none focus:border-brand'
        />
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
          label='상태'
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={FEEDBACK_STATUSES}
        />
        <span className='tnum ml-auto shrink-0 pl-2 type-label-sm text-fg-muted'>총 {filtered.length}건</span>
      </div>

      <div data-anno='feedback-admin:2' className='card overflow-x-auto'>
        <table className='bo-table table-fixed'>
          <colgroup>
            <col className='w-[160px]' />
            <col className='w-[100px]' />
            <col className='min-w-[180px]' />
            <col className='w-[120px]' />
            <col className='w-[100px]' />
            <col className='w-[120px]' />
          </colgroup>
          <thead>
            <tr>
              <th className='whitespace-nowrap'>접수 시각</th>
              <th className='whitespace-nowrap'>유형</th>
              <th>제목</th>
              <th className='whitespace-nowrap'>제출자</th>
              <th className='whitespace-nowrap'>상태</th>
              <th className='whitespace-nowrap'>완료 처리자</th>
            </tr>
          </thead>
          <tbody>
            {rows === null &&
              Array.from({ length: PAGE_SIZE }, (_, i) => (
                <tr key={i}>
                  <td colSpan={6}>
                    <span className='block h-4 animate-pulse rounded bg-surface-2' />
                  </td>
                </tr>
              ))}
            {pageRows.map((f) => (
              <tr
                key={f.id}
                onClick={() => router.push(`/proto/console/feedbacks/${f.id}`)}
                className='cursor-pointer hover:bg-surface-2'
              >
                <td className='tnum whitespace-nowrap text-fg-secondary'>{stamp(f.createdAt)}</td>
                <td className='whitespace-nowrap'>
                  <Badge tone={TYPE_TONE[f.type]}>{FEEDBACK_TYPE_LABEL[f.type]}</Badge>
                </td>
                <td className='truncate font-semibold' title={f.title}>
                  {f.title}
                </td>
                <td className='truncate whitespace-nowrap text-fg-secondary'>{submitterLabel(f)}</td>
                <td className='whitespace-nowrap'>
                  <StatusBadge status={f.status} />
                </td>
                <td className='truncate whitespace-nowrap text-fg-secondary'>
                  {f.doneBy || <span className='text-fg-muted'>—</span>}
                </td>
              </tr>
            ))}
            {rows !== null && pageRows.length === 0 && (
              <tr>
                <td colSpan={6} className='py-12 text-center text-fg-muted'>
                  {rows.length === 0 ? (
                    '접수된 문의·오류 신고가 없습니다.'
                  ) : (
                    <span className='inline-flex flex-col items-center gap-3'>
                      조건에 맞는 문의·오류 신고가 없습니다.
                      <Button size='sm' variant='secondary' onClick={resetAll}>
                        전체 보기
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination data-anno='feedback-admin:2-1' className='mt-4' page={current} total={pageCount} onChange={setPage} />
    </div>
  );
}
