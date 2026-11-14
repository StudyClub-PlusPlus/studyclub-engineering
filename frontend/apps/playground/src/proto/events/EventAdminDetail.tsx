'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { TableCard } from '@console/components/ui';
import { maskEmail } from '@console/lib/mask';
import { useDisplayTimeZone } from '@core/lib/use-display-timezone';
import type { EventMailPreview, EventRegistration, PreviewEvent } from '@studyclub/types';
import { Badge, Button, IconButton, Modal, Tabs } from '@studyclub/ui';
import { ArrowLeft, Eye, EyeOff, Mail } from 'lucide-react';

import { EventEditor } from './EventEditor';
import { EventMailComposer } from './EventMailComposer';
import { useEventWorkspace } from './EventWorkspace';
import {
  CHANNEL_LABEL,
  CONFIRM_LABEL,
  FORMAT_LABEL,
  REGISTRATION_LABEL,
  channels,
  eventStatus,
  formatDate,
  mailAudienceLabel,
  occupiesSeat,
  seatInfo,
  type EventAction,
} from './model';
import { SPECS } from '@/app/(proto)/proto/console/events/spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';
import { toPreviewDocument } from '@/proto/mail/render';

function EventEmail({ email, name }: { email: string; name: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className='inline-flex items-center gap-1 whitespace-nowrap type-body-sm text-fg-muted'>
      <span>{shown ? email : maskEmail(email)}</span>
      <IconButton
        size='sm'
        variant='tertiary'
        icon={shown ? <EyeOff size={15} aria-hidden='true' /> : <Eye size={15} aria-hidden='true' />}
        aria-label={`${name} 이메일 ${shown ? '가리기' : '보기'}`}
        aria-pressed={shown}
        onClick={() => setShown((value) => !value)}
      />
    </span>
  );
}

export function EventAdminDetail({ id }: { id: string }) {
  const { state, now, dispatch } = useEventWorkspace();
  const displayTimeZone = useDisplayTimeZone();
  const [tab, setTab] = useState('attendees');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    action: EventAction;
    kind?: 'CANCEL_EVENT';
  } | null>(null);
  const [answer, setAnswer] = useState<EventRegistration | null>(null);
  const [mailPreview, setMailPreview] = useState<EventMailPreview | null>(null);
  const [compose, setCompose] = useState<'NOTICE' | 'CANCELLATION' | null>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    if (!focusRequest) return;
    const timer = setTimeout(() => noticeRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [focusRequest]);
  if (!state) return <p role='status'>행사를 불러오는 중입니다.</p>;
  const event = state.events.find((item) => item.id === id);
  if (!event)
    return (
      <div className='space-y-4'>
        <p>행사를 찾을 수 없습니다.</p>
        <Link className='text-brand underline' href='/proto/console/events'>
          행사 목록으로
        </Link>
      </div>
    );
  const registrations = state.registrations.filter((r) => r.eventId === id);
  const pending = registrations.filter((r) => r.status === 'PENDING');
  const status = eventStatus(state, event, now);
  const finished = status === '종료';
  const cancelled = event.status === 'CANCELLED';
  const mails = state.mails.filter((mail) => mail.eventId === id && mail.kind === 'OPERATOR');
  const run = (action: EventAction, message: string) => {
    const failure = dispatch(action);
    setError(failure ?? '');
    if (!failure) {
      setNotice(message);
      setFocusRequest((value) => value + 1);
    }
    return failure;
  };
  const changeStatus = (status: PreviewEvent['status']) =>
    run(
      { type: 'STATUS', eventId: id, status },
      status === 'PUBLISHED' ? '행사가 공개되었습니다.' : '모집 상태를 변경했습니다.',
    );
  return (
    <>
      {SPECS.map((spec) => (
        <ScreenSpecRegistrar key={spec.scope} spec={spec} />
      ))}
      <Link
        href='/proto/console/events'
        className='mb-4 inline-flex items-center gap-1 type-label-sm text-fg-muted hover:text-brand'
      >
        <ArrowLeft size={15} />
        행사 목록
      </Link>
      <header data-anno='event-manage:1' className='mb-6 space-y-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <Badge tone={eventStatus(state, event, now) === '모집 중' ? 'recruiting' : 'neutral'} dot>
            {eventStatus(state, event, now)}
          </Badge>
          <span className='type-label-sm text-fg-muted'>
            {FORMAT_LABEL[event.format]} · {CONFIRM_LABEL[event.confirmation]}
          </span>
        </div>
        <h1 className='type-headline-md'>{event.title}</h1>
        <p className='type-body-sm text-fg-muted'>
          {formatDate(event.startsAt, displayTimeZone)} · 신청 마감 {formatDate(event.deadlineAt, displayTimeZone)}
        </p>
        <div className='flex flex-wrap items-center gap-2'>
          {!finished && (event.status === 'DRAFT' || event.status === 'CLOSED') && (
            <Button size='sm' onClick={() => changeStatus('PUBLISHED')}>
              {event.status === 'DRAFT' ? '행사 공개' : '모집 다시 열기'}
            </Button>
          )}
          {!finished && event.status === 'PUBLISHED' && (
            <Button variant='secondary' size='sm' onClick={() => changeStatus('CLOSED')}>
              모집 마감
            </Button>
          )}
          {!finished && event.status === 'PUBLISHED' && !registrations.length && (
            <Button variant='tertiary' size='sm' onClick={() => changeStatus('DRAFT')}>
              공개 취소
            </Button>
          )}
          {!finished && !cancelled && (
            <Button
              className='sm:ml-auto [--button-active-bg:var(--color-danger-bg)] [--button-fg:var(--color-danger-fg)] [--button-hover-bg:var(--color-danger-bg)]'
              variant='tertiary'
              size='sm'
              onClick={() =>
                setConfirm({
                  title: '행사를 취소할까요?',
                  body: '행사를 취소하면 확인 대기 및 참가 확정 신청도 모두 취소됩니다. 취소 후 신청자에게 보낼 안내 메일 작성창이 열립니다. 취소 사유를 작성해 주세요.',
                  action: { type: 'STATUS', eventId: id, status: 'CANCELLED' },
                  kind: 'CANCEL_EVENT',
                })
              }
            >
              행사 취소
            </Button>
          )}
        </div>
      </header>
      {error && (
        <p role='alert' className='mb-4 rounded-control bg-danger-bg p-3 type-body-sm text-danger-fg'>
          {error}
        </p>
      )}
      {notice && (
        <p ref={noticeRef} tabIndex={-1} role='status' className='mb-4 type-body-sm text-success-fg'>
          {notice}
        </p>
      )}
      <div data-anno='event-manage:5' className='mb-6 grid gap-3 sm:grid-cols-2'>
        {channels(event).map((mode) => {
          const info = seatInfo(state, event, mode);
          return (
            <section key={mode} className='card p-4'>
              <div className='flex items-center justify-between'>
                <h2 className='type-label-lg'>{CHANNEL_LABEL[mode]}</h2>
                <span className='type-label-lg text-brand'>잔여 {info.remaining}석</span>
              </div>
              <p className='mt-2 type-body-sm text-fg-muted'>
                확정 {info.confirmed}명 · 확인 대기 {info.pending}명 / 정원 {info.capacity}명
              </p>
            </section>
          );
        })}
      </div>
      <Tabs
        activeKey={tab}
        onChange={(value) => {
          setTab(value);
          setError('');
          setNotice('');
        }}
        items={[
          { key: 'attendees', label: '참가자', badge: pending.length ? `확인 대기 ${pending.length}` : undefined },
          { key: 'info', label: '행사 정보·신청폼' },
          { key: 'mails', label: '메일 이력', badge: mails.length || undefined },
        ]}
      />
      <div className='mt-6'>
        {tab === 'info' && (
          <EventEditor
            key={`${event.id}-${event.status}`}
            event={event}
            confirmationLocked={Date.parse(event.startsAt) <= now}
            readOnly={event.status === 'CANCELLED'}
            onCancel={() => setTab('attendees')}
            onSave={(next) => {
              const newlyConfirmed = event.confirmation !== 'AUTO' && next.confirmation === 'AUTO' ? pending.length : 0;
              return run(
                { type: 'SAVE', event: next },
                newlyConfirmed
                  ? `행사 정보를 저장하고 확인 대기 ${newlyConfirmed}명을 참가 확정했습니다.`
                  : '행사 정보를 저장했습니다. 변경된 일정이나 장소는 안내 메일로 알려 주세요.',
              );
            }}
          />
        )}
        {tab === 'attendees' && (
          <section data-anno='event-manage:6'>
            <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
              <p className='type-body-sm text-fg-muted'>전체 신청 이력 {registrations.length}건</p>
              <Button
                size='sm'
                variant='secondary'
                className={cancelled ? '[--button-fg:var(--color-danger-fg)] [--button-hover-bg:var(--color-danger-bg)] [--button-active-bg:var(--color-danger-bg)]' : undefined}
                leadingIcon={<Mail size={15} />}
                onClick={() => {
                  setCompose(cancelled ? 'CANCELLATION' : 'NOTICE');
                }}
              >
                {cancelled ? '취소 안내 메일 보내기' : '안내 메일 보내기'}
              </Button>
            </div>
            <TableCard>
              <thead>
                <tr>
                  <th>신청자</th>
                  <th>이메일</th>
                  <th>참여 방식</th>
                  <th>상태</th>
                  <th>
                    <span className='inline-block border-l border-transparent pl-3'>신청 내용</span>
                  </th>
                  <th>
                    <span className='inline-block border-l border-transparent pl-3'>처리</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => (
                  <tr key={r.id}>
                    <td className='whitespace-nowrap'>
                      <span className='font-semibold'>{r.name}</span>
                    </td>
                    <td>
                      <EventEmail key={r.email} email={r.email} name={r.name} />
                    </td>
                    <td className='whitespace-nowrap'>{CHANNEL_LABEL[r.channel]}</td>
                    <td>
                      <Badge
                        tone={
                          r.status === 'CONFIRMED' ? 'recruiting' : r.status === 'PENDING' ? 'closingsoon' : 'neutral'
                        }
                        dot
                      >
                        {REGISTRATION_LABEL[r.status]}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        size='sm'
                        variant='tertiary'
                        onClick={() => setAnswer(r)}
                        aria-label={`${r.name} 신청서 보기`}
                      >
                        답변 보기
                      </Button>
                    </td>
                    <td>
                      <div className='flex min-h-8 w-72 items-center gap-1 whitespace-nowrap'>
                        {r.status === 'PENDING' && event.status !== 'CANCELLED' && Date.parse(event.startsAt) > now ? (
                          <>
                            <Button
                              size='sm'
                              onClick={() =>
                                run(
                                  { type: 'DECIDE', registrationId: r.id, status: 'CONFIRMED' },
                                  `${r.name} 님의 참가가 확정되었습니다.`,
                                )
                              }
                            >
                              참가 확정
                            </Button>
                            <Button
                              size='sm'
                              variant='tertiary'
                              onClick={() =>
                                setConfirm({
                                  title: '참가 불가로 처리할까요?',
                                  body: `${r.name} 님의 자리가 반환되고 참가 불가 안내 메일 예시가 생성됩니다.`,
                                  action: { type: 'DECIDE', registrationId: r.id, status: 'DECLINED' },
                                })
                              }
                            >
                              참가 불가
                            </Button>
                          </>
                        ) : !(occupiesSeat(r) && event.status !== 'CANCELLED' && Date.parse(event.startsAt) > now) ? (
                          <span className='inline-flex min-h-8 items-center border border-transparent px-3 type-label-sm text-fg-muted'>
                            {r.status === 'PENDING' ? '행사 시작으로 처리 불가' : '처리 완료'}
                          </span>
                        ) : null}
                        {occupiesSeat(r) && event.status !== 'CANCELLED' && Date.parse(event.startsAt) > now && (
                          <Button
                            size='sm'
                            variant='tertiary'
                            onClick={() =>
                              setConfirm({
                                title: '신청을 취소할까요?',
                                body: `${r.name} 님의 신청을 취소하고 자리를 반환합니다. 취소 안내 메일 예시가 생성됩니다.`,
                                action: { type: 'ADMIN_CANCEL', registrationId: r.id },
                              })
                            }
                          >
                            신청 취소
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!registrations.length && (
                  <tr>
                    <td colSpan={6} className='py-12 text-center text-fg-muted'>
                      아직 신청자가 없습니다. 행사 링크를 공유해 보세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </TableCard>
          </section>
        )}
        {tab === 'mails' && (
          <section data-anno='event-manage:7' className='space-y-3'>
            <p className='type-body-sm text-fg-muted'>운영자가 안내 메일 보내기로 작성한 메일만 표시됩니다.</p>
            {mails.length === 0 ? (
              <div className='card p-8 text-center type-body-sm text-fg-muted'>아직 보낸 안내 메일이 없습니다.</div>
            ) : (
              mails.map((mail) => (
                <button
                  key={mail.id}
                  onClick={() => setMailPreview(mail)}
                  className='card flex w-full items-center justify-between gap-4 p-4 text-left hover:border-brand'
                >
                  <span className='min-w-0'>
                    <span className='block type-label-lg'>{mail.subject}</span>
                    <span className='mt-1 flex flex-wrap gap-x-3 gap-y-1 type-label-sm text-fg-muted'>
                      <span>
                        {mailAudienceLabel(mail)} · {mail.recipients.length}명
                      </span>
                      <span>{formatDate(mail.createdAt, displayTimeZone)}</span>
                    </span>
                  </span>
                  <span className='shrink-0 type-label-sm text-brand'>내용 보기</span>
                </button>
              ))
            )}
          </section>
        )}
      </div>
      <Modal
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={confirm?.title ?? ''}
        footer={
          <>
            <Button variant='secondary' data-autofocus onClick={() => setConfirm(null)}>
              돌아가기
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                if (confirm) {
                  const failure = run(
                    confirm.action,
                    confirm.kind === 'CANCEL_EVENT'
                      ? '행사가 취소되었습니다. 신청자에게 보낼 안내 메일을 작성해 주세요.'
                      : '처리했습니다.',
                  );
                  if (!failure && confirm.kind === 'CANCEL_EVENT') {
                    setCompose('CANCELLATION');
                  }
                }
                setConfirm(null);
              }}
            >
              {confirm?.kind === 'CANCEL_EVENT' ? '행사 취소' : '처리하기'}
            </Button>
          </>
        }
      >
        <p className='type-body-md'>{confirm?.body}</p>
      </Modal>
      <Modal open={Boolean(answer)} onClose={() => setAnswer(null)} title={`${answer?.name ?? ''} 신청서`}>
        <dl className='space-y-5'>
          {answer?.questions.map((q) => (
            <div key={q.id}>
              <dt className='type-label-lg'>{q.label}</dt>
              <dd className='mt-2 whitespace-pre-wrap break-words type-body-sm text-fg-secondary'>
                {Array.isArray(answer.answers[q.id])
                  ? (answer.answers[q.id] as string[]).join(', ') || '답변 없음'
                  : answer.answers[q.id] || '답변 없음'}
              </dd>
            </div>
          ))}
        </dl>
        {answer?.questions.length === 0 && <p className='type-body-sm text-fg-muted'>추가 질문이 없는 신청서입니다.</p>}
      </Modal>
      {compose && (
        <EventMailComposer
          event={event}
          mode={compose}
          onClose={() => setCompose(null)}
          onSent={() => {
            const sentCancellationMail = compose === 'CANCELLATION';
            setCompose(null);
            setTab('mails');
            setNotice(
              sentCancellationMail
                ? '행사 취소 안내 메일 이력을 생성했습니다. 실제 메일은 발송되지 않습니다.'
                : '안내 메일 이력을 생성했습니다. 실제 메일은 발송되지 않습니다.',
            );
            setFocusRequest((value) => value + 1);
          }}
        />
      )}
      <Modal open={Boolean(mailPreview)} onClose={() => setMailPreview(null)} title='메일 미리보기' size='lg'>
        <div className='space-y-4'>
          <p className='type-label-lg'>{mailPreview?.subject}</p>
          {mailPreview && (
            <div className='space-y-2 type-body-sm'>
              <p>{mailAudienceLabel(mailPreview)}</p>
              <details className='rounded-card border border-border p-3'>
                <summary tabIndex={0} className='cursor-pointer type-label-sm text-fg-muted'>
                  받는 사람 {mailPreview.recipients.length}명 보기
                </summary>
                <ul className='mt-3 space-y-1 break-all text-fg-muted'>
                  {mailPreview.recipients.map((email, index) => (
                    <li key={`${email}-${index}`}>{maskEmail(email)}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}
          {mailPreview && (
            <iframe
              title='발송 메일 본문'
              sandbox=''
              srcDoc={toPreviewDocument(mailPreview.body, mailPreview.format ?? 'TEXT')}
              className='h-96 w-full rounded-card border border-border bg-surface-1 sm:h-[32rem]'
            />
          )}
        </div>
      </Modal>
    </>
  );
}
