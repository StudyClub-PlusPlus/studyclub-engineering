'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, Modal, Textarea } from '@studyclub/ui';
import { ChevronLeft } from 'lucide-react';

import { FeedbackTypeBadge } from '@/features/feedbacks/components/FeedbackBadges';
import { StatusPicker } from '@/features/feedbacks/components/StatusPicker';
import { COPY, EMPTY_VALUE, formatStamp, personLabel, viewportLabel } from '@/features/feedbacks/labels';
import { useChangeFeedbackStatus, useReplyFeedback, useSaveFeedbackMemo } from '@/features/feedbacks/queries';
import { MEMO_MAX, REPLY_MAX, REPLY_MIN, type ApiAdminFeedbackDetail } from '@/features/feedbacks/types';

/** 목록으로 돌아가는 길 — 상세 머리 위와 「없는 건」 안내에서 같이 쓴다. */
export function BackToList() {
  return (
    <Link
      href='/feedbacks'
      className='inline-flex w-fit items-center gap-1 text-sm font-medium text-fg-secondary hover:text-fg'
    >
      <ChevronLeft size={15} /> 목록으로
    </Link>
  );
}

/**
 * 문의·오류 신고 상세 — 한 장에 위에서 아래로: 머리(유형·제목·상태) → 본문 → 첨부 → 제출 환경 → 회신 → 캡틴 전용 메모.
 *
 * 본문은 평문이다 — HTML 로 해석하지 않고(React 기본 출력) 줄바꿈만 살린다.
 * 세 처리(상태 · 회신 · 메모)는 각각 PATCH 를 따로 부르고, 응답(바뀐 뒤의 상세)이 캐시를 바꾸면 이 화면이 다시 그려진다.
 * 이전·다음 건 이동은 두지 않는다(PRD 범위 밖).
 */
export function FeedbackDetail({ detail }: { detail: ApiAdminFeedbackDetail }) {
  const status = useChangeFeedbackStatus(detail.id);
  /** 크게 보고 있는 첨부 이미지 */
  const [zoom, setZoom] = useState<number | null>(null);

  // 응답 전에는 고른 값을 보이고, 실패하면 캐시의 이전 값으로 돌아간다
  const shownStatus = status.isPending && status.variables ? status.variables : detail.status;

  return (
    <div className='flex flex-col gap-4'>
      <BackToList />

      <article className='card divide-y divide-border overflow-hidden p-0'>
        <header className='flex flex-wrap items-start justify-between gap-3 px-6 py-5'>
          <div className='min-w-0'>
            <div className='flex min-w-0 items-center gap-2'>
              <FeedbackTypeBadge type={detail.type} />
              <h1 className='min-w-0 break-words text-xl font-extrabold tracking-tight'>{detail.title}</h1>
            </div>
            <p className='tnum mt-1.5 text-sm text-fg-muted'>
              {personLabel(detail.submitter)} · {formatStamp(detail.createdAt)}
            </p>
          </div>
          <div className='flex shrink-0 items-center gap-2 text-sm text-fg-secondary'>
            상태
            <StatusPicker
              value={shownStatus}
              selectable={detail.selectableStatuses}
              pending={status.isPending}
              onChange={(next) => status.mutate(next)}
            />
          </div>
        </header>

        {/* 평문 — 태그도 글자 그대로. 긴 줄이 카드 밖으로 넘치지 않게 */}
        <section className='px-6 py-5'>
          <p
            data-testid='feedback-content'
            className='whitespace-pre-wrap break-words text-base leading-relaxed text-fg [overflow-wrap:anywhere]'
          >
            {detail.content}
          </p>
        </section>

        {/* 첨부가 없으면 칸을 두지 않는다. 묶음 제목도 두지 않는다 */}
        {detail.images.length > 0 && (
          <section className='px-6 py-5'>
            <div className='flex flex-wrap gap-2'>
              {detail.images.map((image, i) => (
                <button
                  key={image.url}
                  type='button'
                  onClick={() => setZoom(i)}
                  aria-label={`첨부 이미지 ${i + 1} 크게 보기`}
                  className='h-28 w-40 overflow-hidden rounded-control border border-border hover:border-brand'
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 사용자가 올린 이미지 원본 */}
                  <img src={image.url} alt={`첨부 이미지 ${i + 1}`} className='h-full w-full object-cover' />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 제출 환경 — 제출자가 입력한 값이 아니다. 묶음 제목은 두지 않는다 */}
        <section className='px-6 py-5'>
          <dl className='grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 text-sm'>
            <dt className='text-fg-muted'>브라우저</dt>
            <dd className='text-fg'>{detail.browser ?? EMPTY_VALUE}</dd>
            <dt className='text-fg-muted'>화면 크기</dt>
            <dd className='tnum text-fg'>{viewportLabel(detail.viewport)}</dd>
          </dl>
        </section>

        <ReplySection detail={detail} />

        <MemoSection detail={detail} />
      </article>

      <Modal
        open={zoom !== null}
        onClose={() => setZoom(null)}
        title={zoom !== null ? `첨부 이미지 ${zoom + 1} / ${detail.images.length}` : ''}
        size='lg'
      >
        {zoom !== null && detail.images[zoom] && (
          // eslint-disable-next-line @next/next/no-img-element -- 사용자가 올린 이미지 원본
          <img
            src={detail.images[zoom].url}
            alt={`첨부 이미지 ${zoom + 1}`}
            className='mx-auto max-h-[70vh] w-auto rounded-control'
          />
        )}
      </Modal>
    </div>
  );
}

/**
 * 회신 — 유형과 상관없이 모든 건에 있다. 제출자가 「내 문의」에서 본다.
 *
 * 회신 전: 입력칸과 「전송」(확인 창 없이 바로). 서버가 저장하고 상태를 완료로 바꾼다.
 * 회신 뒤: 읽기 전용과 「수정」. 고치는 것은 새 회신이 아니다(보낸 시각 그대로).
 * 실패하면 입력을 남긴다 — 입력칸은 이 화면의 state 라 요청이 실패해도 그대로다.
 */
function ReplySection({ detail }: { detail: ApiAdminFeedbackDetail }) {
  const mutation = useReplyFeedback(detail.id);
  const [draft, setDraft] = useState(detail.reply?.content ?? '');
  /** 이미 회신한 건을 고치는 중 */
  const [editing, setEditing] = useState(false);

  const length = draft.trim().length;
  const invalid = length < REPLY_MIN || length > REPLY_MAX;
  const first = detail.reply === null;

  function submit() {
    if (invalid || mutation.isPending) return;
    mutation.mutate({ reply: draft.trim(), first }, { onSuccess: () => setEditing(false) });
  }

  if (detail.reply && !editing) {
    return (
      <section className='px-6 py-5' aria-label='회신'>
        <div className='flex items-baseline justify-between gap-3'>
          <span className='text-sm font-medium text-neutral-800'>회신</span>
          <span className='tnum text-xs text-fg-muted'>{formatStamp(detail.reply.repliedAt)} 보냄</span>
        </div>
        <p
          data-testid='feedback-reply'
          className='mt-2 whitespace-pre-wrap break-words rounded-control bg-surface-2 px-4 py-3 text-sm leading-relaxed text-fg [overflow-wrap:anywhere]'
        >
          {detail.reply.content}
        </p>
        <div className='mt-2 flex justify-end'>
          <Button
            size='sm'
            variant='secondary'
            onClick={() => {
              setDraft(detail.reply?.content ?? '');
              setEditing(true);
            }}
          >
            수정
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className='px-6 py-5'>
      <Textarea
        label='회신'
        rows={5}
        value={draft}
        maxLength={REPLY_MAX}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={first ? "제출자에게 보이는 답변으로, 전송 시 이 문의는 '완료' 처리됩니다" : '제출자에게 보이는 답변입니다'}
        labelHint={
          <span className={`tnum ${length > 0 && invalid ? 'text-warning-700' : 'text-fg-placeholder'}`}>
            {length}/{REPLY_MAX}
          </span>
        }
      />
      <div className='mt-2 flex items-center justify-end gap-2'>
        {!first && (
          <Button
            size='sm'
            variant='tertiary'
            disabled={mutation.isPending}
            onClick={() => {
              setDraft(detail.reply?.content ?? '');
              setEditing(false);
            }}
          >
            취소
          </Button>
        )}
        <Button size='sm' onClick={submit} loading={mutation.isPending} disabled={invalid || mutation.isPending}>
          {first ? '전송' : '저장'}
        </Button>
      </div>
    </section>
  );
}

/** 캡틴 전용 메모 — 내부용, 제출자에게 보이지 않는다. 저장을 눌러야 저장된다. 비우고 저장하면 지운다. */
function MemoSection({ detail }: { detail: ApiAdminFeedbackDetail }) {
  const mutation = useSaveFeedbackMemo(detail.id);
  const [memo, setMemo] = useState(detail.adminMemo ?? '');
  const unchanged = memo === (detail.adminMemo ?? '');

  return (
    <section className='px-6 py-5'>
      <Textarea
        label='캡틴 전용 메모'
        rows={4}
        value={memo}
        maxLength={MEMO_MAX}
        onChange={(e) => setMemo(e.target.value)}
        placeholder={COPY.memoPlaceholder}
      />
      <div className='mt-2 flex justify-end'>
        <Button
          size='sm'
          onClick={() => mutation.mutate(memo)}
          loading={mutation.isPending}
          disabled={unchanged || mutation.isPending}
        >
          저장
        </Button>
      </div>
    </section>
  );
}
