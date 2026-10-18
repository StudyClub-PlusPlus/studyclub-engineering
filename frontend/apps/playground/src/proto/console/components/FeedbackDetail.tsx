'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { STATUS_TONE, TYPE_TONE, stamp } from '@console/components/FeedbacksTable';
import { Badge, Button, Modal, Textarea, toast } from '@studyclub/ui';
import { ArrowLeft } from 'lucide-react';

import {
  FEEDBACK_STATUSES,
  FEEDBACK_TYPE_LABEL,
  FEEDBACK_STATUS_LABEL,
  describeAgent,
  getFeedback,
  patchFeedback,
  type Feedback,
  type FeedbackStatus,
} from '@/proto/lib/feedback';

/**
 * 의견 상세 — 제목 · 내용 전문 · 자동 수집 정보, 처리 상태와 운영 메모.
 *
 * 내용은 평문이다. HTML 로 해석하지 않고 줄바꿈만 살린다.
 * 처리 상태는 고르면 바로 저장된다. 운영 메모는 내부용 — 보낸 사람에게 보이지 않는다.
 * TODO(api): GET·PATCH /api/admin/feedbacks/{id}
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

  if (f === undefined) return <div className='h-40 animate-pulse rounded-card bg-surface-2' />;
  if (f === null)
    return (
      <div className='py-20 text-center text-sm text-fg-muted'>
        찾을 수 없는 의견입니다.{' '}
        <Link href='/proto/console/feedbacks' className='font-semibold text-brand hover:underline'>
          목록으로
        </Link>
      </div>
    );

  function changeStatus(next: FeedbackStatus) {
    patchFeedback(id, { status: next });
    setF((cur) => (cur ? { ...cur, status: next } : cur));
    toast.success(`처리 상태를 「${FEEDBACK_STATUS_LABEL[next]}」로 바꿨습니다.`);
  }

  function saveMemo() {
    patchFeedback(id, { memo });
    setF((cur) => (cur ? { ...cur, memo } : cur));
    toast.success('운영 메모를 저장했습니다.');
  }

  return (
    <div className='flex flex-col gap-4'>
      <Link
        href='/proto/console/feedbacks'
        className='inline-flex w-fit items-center gap-1.5 text-sm font-medium text-fg-secondary hover:text-fg'
      >
        <ArrowLeft size={15} /> 의견
      </Link>

      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2'>
            <Badge tone={TYPE_TONE[f.type]}>{FEEDBACK_TYPE_LABEL[f.type]}</Badge>
            <span className='tnum text-sm text-fg-muted'>{stamp(f.createdAt)}</span>
            <span className='text-sm text-fg-muted'>· {f.author ?? '비회원'}</span>
          </div>
          <h1 className='mt-2 break-words text-2xl font-extrabold tracking-tight'>{f.title}</h1>
        </div>
        <label data-anno='feedback-admin:3' className='flex shrink-0 items-center gap-2 text-sm text-fg-secondary'>
          처리 상태
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
          <Badge tone={STATUS_TONE[f.status]} dot>
            {FEEDBACK_STATUS_LABEL[f.status]}
          </Badge>
        </label>
      </div>

      <div className='grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]'>
        <section className='card px-6 py-5'>
          <h2 className='mb-3 text-xs font-semibold text-fg-muted'>내용</h2>
          {/* 평문 — 태그도 글자 그대로. 긴 줄이 카드 밖으로 넘치지 않게 */}
          <p className='whitespace-pre-wrap break-words text-sm leading-relaxed text-fg [overflow-wrap:anywhere]'>{f.body}</p>

          {f.images && f.images.length > 0 && (
            <div data-anno='feedback-admin:6' className='mt-5 border-t border-border pt-4'>
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
            </div>
          )}
        </section>

        <aside className='flex flex-col gap-4'>
          <section data-anno='feedback-admin:4' className='card px-5 py-4'>
            <h2 className='mb-2 text-xs font-semibold text-fg-muted'>자동 수집 정보</h2>
            <dl className='grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-sm'>
              <dt className='text-fg-muted'>페이지</dt>
              <dd className='break-all font-mono text-[13px] text-fg'>{f.pageUrl}</dd>
              <dt className='text-fg-muted'>브라우저</dt>
              <dd className='text-fg'>{f.userAgent.includes('Mozilla') ? describeAgent(f.userAgent) : f.userAgent}</dd>
              <dt className='text-fg-muted'>화면 크기</dt>
              <dd className='tnum text-fg'>{f.viewport}</dd>
            </dl>
          </section>

          <section data-anno='feedback-admin:5' className='card px-5 py-4'>
            <Textarea
              label='운영 메모'
              rows={4}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              helper='내부용 — 보낸 사람에게 보이지 않습니다'
            />
            <div className='mt-2 flex justify-end'>
              <Button size='sm' variant='secondary' onClick={saveMemo} disabled={memo === f.memo}>
                메모 저장
              </Button>
            </div>
          </section>
        </aside>
      </div>
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
