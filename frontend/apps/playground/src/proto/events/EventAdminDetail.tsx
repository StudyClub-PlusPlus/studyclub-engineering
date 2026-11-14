'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { TableCard } from '@console/components/ui';
import type { EventChannel, EventMailPreview, EventRegistration, PreviewEvent } from '@studyclub/types';
import { Badge, Button, Input, Modal, Select, Tabs, Textarea } from '@studyclub/ui';
import { ArrowLeft, ArrowUpRight, Mail } from 'lucide-react';

import { EventEditor } from './EventEditor';
import { EventPreviewBar } from './EventPreviewBar';
import { useEventWorkspace } from './EventWorkspace';
import {
  CHANNEL_LABEL,
  CONFIRM_LABEL,
  FORMAT_LABEL,
  REGISTRATION_LABEL,
  channels,
  eventStatus,
  formatDate,
  occupiesSeat,
  seatInfo,
  type EventAction,
} from './model';
import { SPECS } from '@/app/(proto)/proto/console/events/spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export function EventAdminDetail({ id }: { id: string }) {
  const { state, now, dispatch } = useEventWorkspace();
  const [tab, setTab] = useState('attendees');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<{ title: string; body: string; action: EventAction } | null>(null);
  const [answer, setAnswer] = useState<EventRegistration | null>(null);
  const [mailPreview, setMailPreview] = useState<EventMailPreview | null>(null);
  const [compose, setCompose] = useState(false);
  const [channel, setChannel] = useState<EventChannel | 'ALL'>('ALL');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [mailError, setMailError] = useState('');
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
  const mails = state.mails.filter((mail) => mail.eventId === id);
  const recipients = registrations.filter(
    (r) => r.status === 'CONFIRMED' && (channel === 'ALL' || r.channel === channel),
  );
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
      <EventPreviewBar eventId={id} />
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
          {formatDate(event.startsAt, event.timeZone)} · 신청 마감 {formatDate(event.deadlineAt, event.timeZone)}
        </p>
        <div className='flex flex-wrap items-center gap-2'>
          {(event.status === 'DRAFT' || event.status === 'CLOSED') && (
            <Button size='sm' onClick={() => changeStatus('PUBLISHED')}>
              {event.status === 'DRAFT' ? '행사 공개' : '모집 다시 열기'}
            </Button>
          )}
          {event.status === 'PUBLISHED' && (
            <Button variant='secondary' size='sm' onClick={() => changeStatus('CLOSED')}>
              모집 마감
            </Button>
          )}
          {event.status === 'PUBLISHED' && !registrations.length && (
            <Button variant='tertiary' size='sm' onClick={() => changeStatus('DRAFT')}>
              공개 취소
            </Button>
          )}
          <Link
            href={`/proto/core/ko/events/${id}`}
            className='inline-flex items-center gap-1 px-2 type-label-sm text-brand hover:underline'
          >
            참가자 화면 보기
            <ArrowUpRight size={15} />
          </Link>
          {event.status !== 'CANCELLED' && (
            <Button
              className='sm:ml-auto'
              variant='tertiary'
              size='sm'
              onClick={() =>
                setConfirm({
                  title: '행사를 취소할까요?',
                  body: '확인 대기와 참가 확정 신청이 함께 취소됩니다. 참가자에게 안내할 메일 예시도 생성됩니다.',
                  action: { type: 'STATUS', eventId: id, status: 'CANCELLED' },
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
          { key: 'mails', label: '메일 미리보기', badge: mails.length || undefined },
        ]}
      />
      <div className='mt-6'>
        {tab === 'info' &&
          (event.status === 'CANCELLED' ? (
            <p className='type-body-sm text-fg-muted'>취소된 행사의 정보는 수정할 수 없습니다.</p>
          ) : (
            <EventEditor
              key={`${event.id}-${event.status}`}
              event={event}
              hasRegistrations={registrations.length > 0}
              onCancel={() => setTab('attendees')}
              onSave={(next) =>
                run(
                  { type: 'SAVE', event: next },
                  '행사 정보를 저장했습니다. 변경된 일정이나 장소는 안내 메일로 알려 주세요.',
                )
              }
            />
          ))}
        {tab === 'attendees' && (
          <section data-anno='event-manage:6'>
            <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
              <p className='type-body-sm text-fg-muted'>전체 신청 이력 {registrations.length}건</p>
              <Button
                size='sm'
                variant='secondary'
                disabled={!registrations.some((r) => r.status === 'CONFIRMED')}
                leadingIcon={<Mail size={15} />}
                onClick={() => {
                  setCompose(true);
                  setMailError('');
                  setSubject(`${event.title} 참여 안내`);
                  setBody('');
                  setChannel('ALL');
                }}
              >
                안내 메일 보내기
              </Button>
            </div>
            <TableCard>
              <thead>
                <tr>
                  <th>신청자</th>
                  <th>참여 방식</th>
                  <th>상태</th>
                  <th>신청 내용</th>
                  <th>처리</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => (
                  <tr key={r.id}>
                    <td className='min-w-40'>
                      <span className='font-semibold'>{r.name}</span>
                      <p className='mt-1 type-label-sm text-fg-muted'>{r.email}</p>
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
                      {r.status === 'PENDING' && event.status !== 'CANCELLED' && Date.parse(event.startsAt) > now ? (
                        <div className='flex gap-1'>
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
                        </div>
                      ) : (
                        <span className='type-label-sm text-fg-muted'>
                          {r.status === 'PENDING' ? '행사 시작으로 처리 불가' : '처리 완료'}
                        </span>
                      )}
                      {occupiesSeat(r) && event.status !== 'CANCELLED' && Date.parse(event.startsAt) > now && (
                        <Button
                          size='sm'
                          variant='tertiary'
                          className='mt-1'
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
                    </td>
                  </tr>
                ))}
                {!registrations.length && (
                  <tr>
                    <td colSpan={5} className='py-12 text-center text-fg-muted'>
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
            <p className='type-body-sm text-fg-muted'>
              접수·확정·취소 및 안내 메일의 내용을 확인해 보세요. 실제 메일은 발송되지 않습니다.
            </p>
            {mails.length === 0 ? (
              <div className='card p-8 text-center type-body-sm text-fg-muted'>
                아직 생성된 메일이 없습니다. 신청하거나 참가자를 확정하면 확인할 수 있어요.
              </div>
            ) : (
              mails.map((mail) => (
                <button
                  key={mail.id}
                  onClick={() => setMailPreview(mail)}
                  className='card flex w-full items-center justify-between gap-4 p-4 text-left hover:border-brand'
                >
                  <span className='min-w-0'>
                    <span className='block type-label-lg'>{mail.subject}</span>
                    <span className='mt-1 block type-label-sm text-fg-muted'>
                      {formatDate(mail.createdAt, event.timeZone)}
                    </span>
                  </span>
                  <span className='shrink-0 type-body-sm text-fg-muted'>{mail.recipients.length}명</span>
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
                if (confirm) run(confirm.action, '처리했습니다. 메일 미리보기에서 안내 내용을 확인할 수 있습니다.');
                setConfirm(null);
              }}
            >
              처리하기
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
      <Modal
        open={compose}
        onClose={() => setCompose(false)}
        title='참가자 안내 메일'
        footer={
          <>
            <Button variant='secondary' onClick={() => setCompose(false)}>
              취소
            </Button>
            <Button
              disabled={recipients.length === 0}
              onClick={() => {
                const failure = dispatch({ type: 'MAIL', eventId: id, channel, subject, body });
                setMailError(failure ?? '');
                if (!failure) {
                  setCompose(false);
                  setTab('mails');
                  setNotice('안내 메일 예시를 생성했습니다. 실제 메일은 발송되지 않습니다.');
                  setFocusRequest((value) => value + 1);
                }
              }}
            >
              안내 메일 보내기
            </Button>
          </>
        }
      >
        <div className='space-y-4'>
          <Select
            label='받는 사람'
            value={channel}
            onChange={(e) => setChannel(e.target.value as EventChannel | 'ALL')}
          >
            <option value='ALL'>참가 확정자 전체</option>
            {channels(event).map((mode) => (
              <option key={mode} value={mode}>
                {CHANNEL_LABEL[mode]} 참가 확정자
              </option>
            ))}
          </Select>
          <p className='type-body-sm text-fg-muted'>
            대상 {recipients.length}명 · 확인 대기·참가 불가·취소 신청자는 제외됩니다.
          </p>
          <Input label='메일 제목' value={subject} maxLength={200} onChange={(e) => setSubject(e.target.value)} />
          <Textarea
            label='안내 내용'
            rows={6}
            maxLength={5000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder='행사 참여 방법이나 준비물을 알려 주세요.'
          />
          {mailError && (
            <p role='alert' className='type-body-sm text-danger-fg'>
              {mailError}
            </p>
          )}
        </div>
      </Modal>
      <Modal open={Boolean(mailPreview)} onClose={() => setMailPreview(null)} title='메일 미리보기'>
        <div className='space-y-4'>
          <p className='type-label-lg'>{mailPreview?.subject}</p>
          <p className='break-words type-label-sm text-fg-muted'>받는 사람: {mailPreview?.recipients.join(', ')}</p>
          <p className='whitespace-pre-wrap break-words border-t border-border pt-4 type-body-md'>
            {mailPreview?.body}
          </p>
        </div>
      </Modal>
    </>
  );
}
