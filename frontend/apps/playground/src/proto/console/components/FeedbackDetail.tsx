'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { STATUS_CLASS, StatusBadge, TYPE_TONE, stamp } from '@console/components/FeedbacksTable';
import { getUser } from '@console/lib/auth';
import { Badge, Button, Modal, Textarea, toast } from '@studyclub/ui';
import { Check, ChevronDown, ChevronLeft } from 'lucide-react';

import {
  BODY_MAX as REPLY_MAX,
  BODY_MIN as REPLY_MIN,
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
 * 문의·오류 신고 상세 — 한 장에 위에서 아래로: 머리(유형·제목·상태) → 본문 → 첨부 → 제출 환경 → 회신 → 캡틴 전용 메모.
 *
 * 본문은 평문 — HTML 로 해석하지 않고 줄바꿈만 살린다.
 * 상태는 고르면 바로 저장(확인 창 없음). 캡틴 전용 메모는 [저장] 으로 — 내부용, 제출자에게 보이지 않는다.
 * 이전·다음 건 이동은 두지 않는다.
 * TODO(api): GET·PATCH /api/admin/feedbacks/{id} — 삭제된 건은 404
 */
/** 지금 콘솔에 로그인한 캡틴 — 완료 처리자로 남긴다 */
function me(): string {
  const u = getUser();
  return u?.nickname ?? u?.email ?? '캡틴';
}

export function FeedbackDetail({ id }: { id: string }) {
  const [f, setF] = useState<Feedback | null | undefined>(undefined);
  const [memo, setMemo] = useState('');
  const [reply, setReply] = useState('');
  /** 이미 회신한 건을 고치는 중 */
  const [editingReply, setEditingReply] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  /** 크게 보고 있는 첨부 이미지 */
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    const found = getFeedback(id) ?? null;
    setF(found);
    setMemo(found?.memo ?? '');
    setReply(found?.reply?.body ?? '');
  }, [id]);

  if (f === undefined) return <div className='h-60 animate-pulse rounded-card bg-surface-2' />;
  if (f === null)
    return (
      <div className='py-20 text-center type-body-sm text-fg-muted'>
        삭제되었거나 없는 문의·오류 신고입니다.{' '}
        <Link href='/proto/console/feedbacks' className='font-semibold text-brand hover:underline'>
          목록으로
        </Link>
      </div>
    );

  function changeStatus(next: FeedbackStatus) {
    // TODO(api): 실패하면 드롭다운을 이전 값으로 되돌리고 「상태를 변경하지 못했습니다」 + 다시 시도
    // 완료로 바꾸면 바꾼 캡틴을 남기고, 완료에서 벗어나면 지운다
    const doneBy = next === 'done' ? me() : '';
    patchFeedback(id, { status: next, doneBy });
    setF((cur) => (cur ? { ...cur, status: next, doneBy } : cur));
    toast.success('상태를 변경했습니다.');
  }

  const replyLen = reply.trim().length;
  const replyInvalid = replyLen < REPLY_MIN || replyLen > REPLY_MAX;

  /**
   * 회신 전송 — 확인 창 없이 바로. 회신 저장 + 상태 「완료」. 제출자에게 알리는 일은 알림 조건 「문의 회신」이 맡는다.
   * 고치는 것은 새 회신이 아니다 — 알림 조건이 다시 걸리지 않고, 처음 보낸 시각을 그대로 둔다.
   * TODO(api): PATCH /api/admin/feedbacks/{id} { reply } — 실패하면 입력을 남기고 「회신을 보내지 못했습니다」 + 다시 시도
   */
  async function sendReply() {
    if (!f || replyInvalid || sendingReply) return;
    setSendingReply(true);
    await new Promise((r) => setTimeout(r, 500));
    const first = !f.reply;
    const next = { body: reply.trim(), at: f.reply?.at ?? new Date().toISOString() };
    patchFeedback(id, first ? { reply: next, status: 'done', doneBy: me() } : { reply: next });
    setF((cur) =>
      cur ? { ...cur, reply: next, ...(first ? { status: 'done' as const, doneBy: me() } : {}) } : cur,
    );
    setSendingReply(false);
    setEditingReply(false);
    toast.success(first ? '회신을 보냈습니다.' : '회신을 고쳤습니다.');
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
        className='inline-flex w-fit items-center gap-1 type-label-lg text-fg-secondary hover:text-fg'
      >
        <ChevronLeft size={15} /> 목록으로
      </Link>

      <article className='card divide-y divide-border overflow-hidden p-0'>
        <header className='flex flex-wrap items-start justify-between gap-3 px-6 py-5'>
          <div className='min-w-0'>
            <div className='flex min-w-0 items-center gap-2'>
              <Badge tone={TYPE_TONE[f.type]}>{FEEDBACK_TYPE_LABEL[f.type]}</Badge>
              <h1 className='min-w-0 break-words type-headline-md'>{f.title}</h1>
            </div>
            <p className='tnum mt-1.5 type-body-sm text-fg-muted'>
              {submitterLabel(f)} · {stamp(f.createdAt)}
            </p>
          </div>
          <div data-anno='feedback-admin:3' className='flex shrink-0 items-center gap-2 type-body-sm text-fg-secondary'>
            상태
            <StatusPicker value={f.status} onChange={changeStatus} />
          </div>
        </header>

        {/* 평문 — 태그도 글자 그대로. 긴 줄이 카드 밖으로 넘치지 않게 */}
        <section className='px-6 py-5'>
          <p className='whitespace-pre-wrap break-words type-body-md text-fg [overflow-wrap:anywhere]'>{f.body}</p>
        </section>

        {f.images && f.images.length > 0 && (
          <section data-anno='feedback-admin:6' className='px-6 py-5'>
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
          <dl className='grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1.5 type-body-sm'>
            <dt className='text-fg-muted'>브라우저</dt>
            <dd className='text-fg'>{describeAgent(f.userAgent)}</dd>
            <dt className='text-fg-muted'>화면 크기</dt>
            <dd className='tnum text-fg'>{f.viewport}</dd>
          </dl>
        </section>

        {/* 회신 — 유형과 상관없이 모든 건. 제출자가 「내 문의」에서 본다 */}
        <section data-anno='feedback-admin:7' className='px-6 py-5'>
          {f.reply && !editingReply ? (
            <>
              <div className='flex items-baseline justify-between gap-3'>
                <span className='type-label-lg text-neutral-800'>회신</span>
                <span className='tnum type-label-sm text-fg-muted'>{stamp(f.reply.at)} 보냄</span>
              </div>
              <p className='mt-2 whitespace-pre-wrap break-words rounded-control bg-surface-2 px-4 py-3 type-body-sm text-fg [overflow-wrap:anywhere]'>
                {f.reply.body}
              </p>
              <div className='mt-2 flex justify-end'>
                <Button size='sm' variant='secondary' onClick={() => setEditingReply(true)}>
                  수정
                </Button>
              </div>
            </>
          ) : (
            <>
              <Textarea
                label='회신'
                rows={5}
                value={reply}
                maxLength={REPLY_MAX}
                onChange={(e) => setReply(e.target.value)}
                placeholder={f.reply ? '제출자에게 보이는 답변입니다' : "제출자에게 보이는 답변으로, 전송 시 이 문의는 '완료' 처리됩니다"}
                labelHint={
                  <span className={`tnum ${replyLen > 0 && replyInvalid ? 'text-warning-700' : 'text-fg-placeholder'}`}>
                    {replyLen}/{REPLY_MAX}
                  </span>
                }
              />
              <div className='mt-2 flex items-center justify-end gap-2'>
                {f.reply && (
                  <Button
                    size='sm'
                    variant='ghost'
                    onClick={() => {
                      setReply(f.reply?.body ?? '');
                      setEditingReply(false);
                    }}
                  >
                    취소
                  </Button>
                )}
                <Button size='sm' onClick={sendReply} loading={sendingReply} disabled={replyInvalid || sendingReply}>
                  {f.reply ? '저장' : '전송'}
                </Button>
              </div>
            </>
          )}
        </section>

        <section data-anno='feedback-admin:5' className='px-6 py-5'>
          <Textarea
            label='캡틴 전용 메모'
            rows={4}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder='내부용 — 제출자에게 보이지 않습니다'
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

/**
 * 상태 고르기 — **뱃지가 곧 드롭다운이다.** 지금 상태 뱃지를 누르면 같은 모양의 뱃지 셋이 펼쳐진다.
 * 드롭다운과 뱃지를 따로 두면 같은 값을 두 번 보게 된다.
 */
function StatusPicker({ value, onChange }: { value: FeedbackStatus; onChange: (next: FeedbackStatus) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className='relative'>
      <button
        type='button'
        aria-haspopup='listbox'
        aria-expanded={open}
        aria-label={`상태 ${FEEDBACK_STATUSES.find((s) => s.value === value)?.label} — 바꾸기`}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 rounded-pill py-1 pl-2.5 pr-1.5 type-label-sm ring-1 ring-transparent transition hover:ring-border-strong ${STATUS_CLASS[value]}`}
      >
        {FEEDBACK_STATUSES.find((s) => s.value === value)?.label}
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul
          role='listbox'
          aria-label='상태'
          className='absolute right-0 z-20 mt-1.5 flex w-32 flex-col gap-1 rounded-control border border-border bg-surface p-1.5 shadow-lg'
        >
          {FEEDBACK_STATUSES.map((s) => (
            <li key={s.value}>
              <button
                type='button'
                role='option'
                aria-selected={s.value === value}
                onClick={() => {
                  setOpen(false);
                  if (s.value !== value) onChange(s.value);
                }}
                className='flex w-full items-center justify-between rounded-control px-1.5 py-1 hover:bg-surface-2'
              >
                <StatusBadge status={s.value} />
                {s.value === value && <Check size={13} className='text-fg-muted' />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
