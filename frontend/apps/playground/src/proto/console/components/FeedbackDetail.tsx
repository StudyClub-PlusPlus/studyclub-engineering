'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { StatusBadge, TYPE_TONE, stamp } from '@console/components/FeedbacksTable';
import { Badge, Button, Modal, Textarea, toast } from '@studyclub/ui';
import { ChevronLeft } from 'lucide-react';

import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPE_LABEL,
  describeAgent,
  getFeedback,
  patchFeedback,
  submitterLabel,
  type Feedback,
  type FeedbackStatus,
} from '@/proto/lib/feedback';

/**
 * 문의·오류 신고 상세 — 한 장에 위에서 아래로: 머리(유형·제목·상태) → 본문 → 첨부 → 제출 환경 → 운영 메모.
 *
 * 본문은 평문 — HTML 로 해석하지 않고 줄바꿈만 살린다.
 * 상태는 고르면 바로 저장(확인 창 없음). 운영 메모는 [저장] 으로 — 내부용, 제출자에게 보이지 않는다.
 * 이전·다음 건 이동은 두지 않는다.
 * TODO(api): GET·PATCH /api/admin/feedbacks/{id} — 삭제된 건은 404
 */
export function FeedbackDetail({ id }: { id: string }) {
  const [f, setF] = useState<Feedback | null | undefined>(undefined);
  const [memo, setMemo] = useState('');
  /** 크게 보고 있는 첨부 이미지 */
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    const found = getFeedback(id) ?? null;
    setF(found);
    setMemo(found?.memo ?? '');
  }, [id]);

  if (f === undefined) return <div className='h-60 animate-pulse rounded-card bg-surface-2' />;
  if (f === null)
    return (
      <div className='py-20 text-center text-sm text-fg-muted'>
        삭제되었거나 없는 문의·오류 신고입니다.{' '}
        <Link href='/proto/console/feedbacks' className='font-semibold text-brand hover:underline'>
          목록으로
        </Link>
      </div>
    );

  function changeStatus(next: FeedbackStatus) {
    // TODO(api): 실패하면 드롭다운을 이전 값으로 되돌리고 「상태를 변경하지 못했습니다」 + 다시 시도
    patchFeedback(id, { status: next });
    setF((cur) => (cur ? { ...cur, status: next } : cur));
    toast.success('상태를 변경했습니다.');
  }

  function saveMemo() {
    patchFeedback(id, { memo });
    setF((cur) => (cur ? { ...cur, memo } : cur));
    toast.success('저장했습니다.');
  }

  return (
    <div className='flex flex-col gap-4'>
      <Link
        href='/proto/console/feedbacks'
        className='inline-flex w-fit items-center gap-1 text-sm font-medium text-fg-secondary hover:text-fg'
      >
        <ChevronLeft size={15} /> 목록으로
      </Link>

      <article className='card divide-y divide-border overflow-hidden p-0'>
        <header className='flex flex-wrap items-start justify-between gap-3 px-6 py-5'>
          <div className='min-w-0'>
            <div className='flex min-w-0 items-center gap-2'>
              <Badge tone={TYPE_TONE[f.type]}>{FEEDBACK_TYPE_LABEL[f.type]}</Badge>
              <h1 className='min-w-0 break-words text-xl font-extrabold tracking-tight'>{f.title}</h1>
            </div>
            <p className='tnum mt-1.5 text-sm text-fg-muted'>
              {submitterLabel(f)} · {stamp(f.createdAt)}
            </p>
          </div>
          <label data-anno='feedback-admin:3' className='flex shrink-0 items-center gap-2 text-sm text-fg-secondary'>
            상태
            <select
              value={f.status}
              onChange={(e) => changeStatus(e.target.value as FeedbackStatus)}
              className='h-9 rounded-control border border-border-strong bg-surface px-3 text-sm font-semibold text-fg outline-none focus:border-brand'
            >
              {FEEDBACK_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <StatusBadge status={f.status} />
          </label>
        </header>

        {/* 평문 — 태그도 글자 그대로. 긴 줄이 카드 밖으로 넘치지 않게 */}
        <section className='px-6 py-5'>
          <p className='whitespace-pre-wrap break-words text-[15px] leading-relaxed text-fg [overflow-wrap:anywhere]'>{f.body}</p>
        </section>

        {f.images && f.images.length > 0 && (
          <section data-anno='feedback-admin:6' className='px-6 py-5'>
            <h2 className='mb-2 text-xs font-semibold text-fg-muted'>첨부 이미지 {f.images.length}장</h2>
            <div className='flex flex-wrap gap-2'>
              {f.images.map((src, i) => (
                <button
                  key={i}
                  type='button'
                  onClick={() => setZoom(i)}
                  aria-label={`첨부 이미지 ${i + 1} 크게 보기`}
                  className='h-28 w-40 overflow-hidden rounded-control border border-border hover:border-brand'
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 사용자가 올린 이미지 원본 */}
                  <img src={src} alt={`첨부 이미지 ${i + 1}`} className='h-full w-full object-cover' />
                </button>
              ))}
            </div>
          </section>
        )}

        <section data-anno='feedback-admin:4' className='px-6 py-5'>
          <h2 className='mb-2 text-xs font-semibold text-fg-muted'>제출 환경</h2>
          <dl className='grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-sm'>
            <dt className='text-fg-muted'>화면</dt>
            <dd className='min-w-0'>
              {/* 누르면 그 화면으로 — 지금은 없는 페이지여도 링크는 건다 */}
              <a
                href={`/proto/core${f.pageUrl}`}
                target='_blank'
                rel='noopener noreferrer'
                className='break-all font-mono text-[13px] text-brand underline-offset-2 hover:underline'
              >
                {f.pageUrl}
              </a>
            </dd>
            <dt className='text-fg-muted'>브라우저</dt>
            <dd className='text-fg'>{describeAgent(f.userAgent)}</dd>
            <dt className='text-fg-muted'>화면 크기</dt>
            <dd className='tnum text-fg'>{f.viewport}</dd>
          </dl>
        </section>

        <section data-anno='feedback-admin:5' className='px-6 py-5'>
          <Textarea
            label='운영 메모'
            rows={4}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            helper='내부용 — 제출자에게 보이지 않습니다'
          />
          <div className='mt-2 flex justify-end'>
            <Button size='sm' onClick={saveMemo} disabled={memo === f.memo}>
              저장
            </Button>
          </div>
        </section>
      </article>

      <Modal
        open={zoom !== null}
        onClose={() => setZoom(null)}
        title={zoom !== null ? `첨부 이미지 ${zoom + 1} / ${f.images?.length ?? 0}` : ''}
        size='lg'
      >
        {zoom !== null && f.images?.[zoom] && (
          // eslint-disable-next-line @next/next/no-img-element -- 사용자가 올린 이미지 원본
          <img src={f.images[zoom]} alt={`첨부 이미지 ${zoom + 1}`} className='mx-auto max-h-[70vh] w-auto rounded-control' />
        )}
      </Modal>
    </div>
  );
}
