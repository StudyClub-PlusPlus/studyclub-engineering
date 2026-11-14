'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { PAGE, DETAIL_GRID, DETAIL_ASIDE } from '@core/lib/layout';
import type { EventChannel, EventRegistration, Locale } from '@studyclub/types';
import { Badge, Button, Checkbox, Input, Modal, Select, Textarea } from '@studyclub/ui';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, MapPin, Video } from 'lucide-react';

import { EventPreviewBar } from './EventPreviewBar';
import { useEventWorkspace } from './EventWorkspace';
import {
  CHANNEL_LABEL,
  FORMAT_LABEL,
  REGISTRATION_LABEL,
  SELF,
  ZONES,
  channels,
  eventStatus,
  formatDate,
  occupiesSeat,
  safeWebUrl,
  seatInfo,
} from './model';
import { SPECS } from '@/app/(proto)/proto/core/[locale]/events/_application/spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export function EventGuestDetail({ id, locale }: { id: string; locale: Locale }) {
  const { state, now, dispatch } = useEventWorkspace();
  const [open, setOpen] = useState(false);
  const [cancel, setCancel] = useState(false);
  const [viewAnswers, setViewAnswers] = useState(false);
  const [channel, setChannel] = useState<EventChannel>('ONLINE');
  const [answers, setAnswers] = useState<EventRegistration['answers']>({});
  const [error, setError] = useState('');
  const [zone, setZone] = useState('');
  const receiptRef = useRef<HTMLHeadingElement>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  useEffect(() => {
    if (!focusRequest) return;
    const timer = setTimeout(() => receiptRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [focusRequest]);
  if (!state)
    return (
      <div className={`${PAGE} py-12`} role='status'>
        행사를 불러오는 중입니다.
      </div>
    );
  const event = state.events.find((item) => item.id === id);
  if (!event)
    return (
      <div className={`${PAGE} space-y-4 py-12`}>
        <p>행사를 찾을 수 없습니다.</p>
        <Link className='text-brand underline' href={`/proto/core/${locale}/events`}>
          행사 목록으로
        </Link>
      </div>
    );
  const registration = state.registrations.find((r) => r.eventId === id && r.memberId === SELF.memberId);
  const currentZone = zone || event.timeZone;
  const status = eventStatus(state, event, now);
  const canApply = status === '모집 중' && (!registration || registration.status === 'CANCELLED');
  function startApplication() {
    setChannel(channels(event!).find((mode) => seatInfo(state!, event!, mode).remaining > 0) ?? channels(event!)[0]!);
    setAnswers({});
    setError('');
    setOpen(true);
  }
  const answerChange = (questionId: string, value: string | string[]) =>
    setAnswers((current) => ({ ...current, [questionId]: value }));
  const submit = () => {
    const failure = dispatch({ type: 'APPLY', eventId: id, channel, answers });
    setError(failure ?? '');
    if (!failure) {
      setOpen(false);
      setFocusRequest((value) => value + 1);
    }
  };
  return (
    <div className={`${PAGE} py-8 sm:py-10`}>
      {SPECS.map((spec) => (
        <ScreenSpecRegistrar key={spec.scope} spec={spec} />
      ))}
      <EventPreviewBar eventId={id} />
      <Link
        href={`/proto/core/${locale}/events`}
        className='inline-flex items-center gap-1 type-label-lg text-fg-muted hover:text-brand'
      >
        <ArrowLeft size={16} />
        행사 목록
      </Link>
      {event.status === 'DRAFT' && (
        <p className='mt-4 rounded-control bg-warning-bg p-3 type-body-sm text-warning-fg'>
          아직 공개 전인 행사입니다. 운영진 화면에서 공개한 뒤 신청할 수 있어요.
        </p>
      )}
      <div className={`mt-6 ${DETAIL_GRID}`}>
        <article className='min-w-0'>
          <header data-anno='event-apply:2' className='space-y-4 border-b border-border pb-7'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge tone={status === '모집 중' ? 'recruiting' : 'neutral'} dot>
                {status}
              </Badge>
              <Badge>{FORMAT_LABEL[event.format]}</Badge>
            </div>
            <h1 className='type-headline-lg'>{event.title}</h1>
            <p className='type-body-lg text-fg-muted'>{event.summary}</p>
          </header>
          <section data-anno='event-apply:2-1' className='py-7'>
            <h2 className='mb-4 type-title-md'>행사 소개</h2>
            <div className='whitespace-pre-wrap break-words type-body-md leading-relaxed text-fg-secondary'>
              {event.description}
            </div>
          </section>
          <section data-anno='event-apply:2-2' className='space-y-4 border-t border-border py-6'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <h2 className='type-title-md'>일정과 장소</h2>
              <Select
                aria-label='일정 표시 시간대'
                size='sm'
                value={currentZone}
                onChange={(e) => setZone(e.target.value)}
              >
                {ZONES.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </Select>
            </div>
            <dl className='space-y-4 type-body-sm'>
              <div className='flex gap-3'>
                <CalendarDays aria-hidden size={18} className='mt-1 shrink-0 text-brand' />
                <div>
                  <dt className='type-label-lg'>행사 일정</dt>
                  <dd className='mt-1 text-fg-secondary'>
                    {formatDate(event.startsAt, currentZone)}
                    <br />~ {formatDate(event.endsAt, currentZone)}
                  </dd>
                </div>
              </div>
              <div className='flex gap-3'>
                <Clock3 aria-hidden size={18} className='mt-1 shrink-0 text-brand' />
                <div>
                  <dt className='type-label-lg'>신청 마감</dt>
                  <dd className='mt-1 text-fg-secondary'>{formatDate(event.deadlineAt, currentZone)}</dd>
                </div>
              </div>
              {event.format !== 'ONLINE' && (
                <div className='flex gap-3'>
                  <MapPin aria-hidden size={18} className='mt-1 shrink-0 text-brand' />
                  <div>
                    <dt className='type-label-lg'>오프라인</dt>
                    <dd className='mt-1 break-words text-fg-secondary'>{event.location}</dd>
                  </div>
                </div>
              )}
              {event.format !== 'OFFLINE' && (
                <div className='flex gap-3'>
                  <Video aria-hidden size={18} className='mt-1 shrink-0 text-brand' />
                  <div>
                    <dt className='type-label-lg'>온라인</dt>
                    <dd className='mt-1 text-fg-secondary'>참가 확정 후 참여 링크를 확인할 수 있어요.</dd>
                  </div>
                </div>
              )}
            </dl>
          </section>
        </article>
        <aside className={`space-y-4 ${DETAIL_ASIDE}`}>
          <section data-anno='event-apply:3' className='card p-5 sm:p-6'>
            <h2 className='type-title-md'>함께 참여해요</h2>
            <div className='mt-4 space-y-3'>
              {channels(event).map((mode) => {
                const info = seatInfo(state, event, mode);
                return (
                  <div key={mode} className='flex justify-between gap-2 type-body-sm'>
                    <span>{CHANNEL_LABEL[mode]}</span>
                    <span className={info.remaining ? 'text-fg-secondary' : 'text-fg-muted'}>
                      {info.remaining ? `${info.remaining}자리 남음 / ${info.capacity}명` : '정원 마감'}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className='my-5 border-t border-border pt-4'>
              <p className='type-label-lg'>
                {event.confirmation === 'AUTO' ? '신청하면 바로 참가가 확정돼요' : '운영진 확인 후 참가가 확정돼요'}
              </p>
              <p className='mt-2 type-body-sm text-fg-muted'>
                {event.confirmation === 'AUTO'
                  ? '신청을 마치면 참여 안내를 확인할 수 있어요.'
                  : '신청 내용을 확인한 뒤 이메일로 알려드려요. 모집 상세의 추가 안내도 확인해 주세요.'}
              </p>
            </div>
            <Button className='w-full' size='lg' disabled={!canApply} onClick={startApplication}>
              {canApply
                ? registration
                  ? '다시 신청하기'
                  : '행사 신청하기'
                : registration && occupiesSeat(registration)
                  ? REGISTRATION_LABEL[registration.status]
                  : status === '모집 중' && registration?.status === 'DECLINED'
                    ? '참가 불가'
                    : status}
            </Button>
          </section>
          {registration && (
            <section data-anno='event-apply:4' aria-live='polite' className='card p-5 sm:p-6'>
              <div className='mb-3 flex items-center gap-2 text-brand'>
                {registration.status === 'CONFIRMED' ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}
                <h2 ref={receiptRef} tabIndex={-1} className='type-title-sm'>
                  내 신청 내역
                </h2>
              </div>
              <Badge
                tone={
                  registration.status === 'CONFIRMED'
                    ? 'recruiting'
                    : registration.status === 'PENDING'
                      ? 'closingsoon'
                      : 'neutral'
                }
                dot
              >
                {REGISTRATION_LABEL[registration.status]}
              </Badge>
              <p className='mt-3 type-body-sm'>
                {CHANNEL_LABEL[registration.channel]} 참여 · {SELF.name}
              </p>
              <p className='mt-2 type-body-sm text-fg-muted'>
                {registration.status === 'PENDING'
                  ? '신청이 접수되었어요. 운영진 확인 후 참가 확정 메일을 보내드려요.'
                  : registration.status === 'CONFIRMED'
                    ? '참가가 확정되었어요. 행사에서 만나요!'
                    : registration.status === 'DECLINED'
                      ? '이번 행사에 참가하기 어려워요. 자세한 내용은 운영진에게 문의해 주세요.'
                      : event.status === 'CANCELLED'
                        ? '행사가 취소되어 신청도 함께 취소되었어요.'
                        : '신청이 취소되었어요.'}
              </p>
              {registration.status === 'CONFIRMED' &&
                (registration.channel === 'ONLINE' ? (
                  event.onlineUrl && safeWebUrl(event.onlineUrl) ? (
                    <a
                      className='mt-4 inline-flex type-label-lg text-brand underline'
                      href={event.onlineUrl}
                      target='_blank'
                      rel='noreferrer'
                    >
                      온라인 참여 링크 열기
                    </a>
                  ) : (
                    <p className='mt-3 type-body-sm text-fg-muted'>참여 링크는 운영진이 추후 안내해 드려요.</p>
                  )
                ) : (
                  <p className='mt-3 break-words type-body-sm text-fg-secondary'>장소: {event.location}</p>
                ))}
              <div className='mt-4 flex flex-wrap gap-1'>
                <Button size='sm' variant='tertiary' onClick={() => setViewAnswers(true)}>
                  신청서 보기
                </Button>
                {occupiesSeat(registration) && Date.parse(event.deadlineAt) > now && (
                  <Button
                    size='sm'
                    variant='tertiary'
                    onClick={() => {
                      setError('');
                      setCancel(true);
                    }}
                  >
                    신청 취소
                  </Button>
                )}
              </div>
              {occupiesSeat(registration) && Date.parse(event.deadlineAt) <= now && (
                <p className='mt-2 type-label-sm text-fg-muted'>신청 마감 후 취소는 운영진에게 문의해 주세요.</p>
              )}
            </section>
          )}
        </aside>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title='행사 신청'
        size='md'
        footer={
          <>
            <Button variant='secondary' onClick={() => setOpen(false)}>
              돌아가기
            </Button>
            <Button type='submit' form='event-application-form'>
              신청하기
            </Button>
          </>
        }
      >
        <form
          id='event-application-form'
          data-anno='event-apply:5'
          className='space-y-5'
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <p className='type-label-lg'>{event.title}</p>
          <div className='grid gap-3 sm:grid-cols-2'>
            <Input label='이름' value={SELF.name} readOnly />
            <Input label='이메일' value={SELF.email} readOnly />
          </div>
          <fieldset className='space-y-2'>
            <legend className='mb-2 type-label-lg'>참여 방식</legend>
            {channels(event).map((mode) => {
              const info = seatInfo(state, event, mode);
              return (
                <label
                  key={mode}
                  className={`flex items-center gap-3 rounded-control border p-3 ${channel === mode ? 'border-brand bg-brand-subtle' : 'border-border'} ${!info.remaining ? 'text-fg-muted' : ''}`}
                >
                  <input
                    type='radio'
                    name='attendance-channel'
                    className='accent-(--color-brand)'
                    checked={channel === mode}
                    disabled={!info.remaining}
                    onChange={() => setChannel(mode)}
                  />
                  <span className='type-label-lg'>{CHANNEL_LABEL[mode]}</span>
                  <span className='ml-auto type-label-sm'>
                    {info.remaining ? `${info.remaining}자리 남음` : '정원 마감'}
                  </span>
                </label>
              );
            })}
          </fieldset>
          {event.questions.map((q) => {
            const label = `${q.label}${q.required ? ' (필수)' : ''}`;
            if (q.type === 'TEXT' || q.type === 'TEXTAREA') {
              const Component = q.type === 'TEXT' ? Input : Textarea;
              return (
                <Component
                  key={q.id}
                  label={q.label}
                  required={q.required}
                  maxLength={2000}
                  value={String(answers[q.id] ?? '')}
                  onChange={(e) => answerChange(q.id, e.target.value)}
                />
              );
            }
            if (q.type === 'SELECT')
              return (
                <Select
                  key={q.id}
                  label={q.label}
                  required={q.required}
                  value={String(answers[q.id] ?? '')}
                  onChange={(e) => answerChange(q.id, e.target.value)}
                >
                  <option value=''>선택해 주세요</option>
                  {q.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              );
            return (
              <fieldset key={q.id} className='space-y-2'>
                <legend className='mb-2 type-label-lg'>{label}</legend>
                {q.options.map((option) =>
                  q.type === 'CHECKBOX' ? (
                    <div key={option}>
                      <Checkbox
                        label={option}
                        checked={Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(option)}
                        onChange={(e) => {
                          const values = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
                          answerChange(
                            q.id,
                            e.target.checked ? [...values, option] : values.filter((value) => value !== option),
                          );
                        }}
                      />
                    </div>
                  ) : (
                    <label key={option} className='flex items-center gap-2 type-body-sm'>
                      <input
                        type='radio'
                        name={q.id}
                        required={q.required}
                        className='accent-(--color-brand)'
                        checked={answers[q.id] === option}
                        onChange={() => answerChange(q.id, option)}
                      />
                      {option}
                    </label>
                  ),
                )}
              </fieldset>
            );
          })}
          <p className='rounded-control bg-surface-2 p-3 type-body-sm text-fg-secondary'>
            {event.confirmation === 'AUTO'
              ? '신청하면 바로 참가가 확정됩니다.'
              : '신청 후 운영진 확인을 거쳐 참가가 확정됩니다.'}{' '}
            신청 마감 전까지 내 신청 내역에서 취소할 수 있어요.
          </p>
          {error && (
            <p role='alert' className='type-body-sm text-danger-fg'>
              {error}
            </p>
          )}
        </form>
      </Modal>
      <Modal
        open={cancel}
        onClose={() => setCancel(false)}
        title='신청을 취소할까요?'
        footer={
          <>
            <Button variant='secondary' data-autofocus onClick={() => setCancel(false)}>
              신청 유지
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                if (!registration) return;
                const failure = dispatch({ type: 'CANCEL', registrationId: registration.id });
                setError(failure ?? '');
                if (!failure) {
                  setCancel(false);
                  setFocusRequest((value) => value + 1);
                }
              }}
            >
              신청 취소
            </Button>
          </>
        }
      >
        <p className='type-body-md'>확보한 자리가 다른 참가자에게 열립니다.</p>
        {error && (
          <p role='alert' className='mt-3 type-body-sm text-danger-fg'>
            {error}
          </p>
        )}
      </Modal>
      <Modal open={viewAnswers} onClose={() => setViewAnswers(false)} title='내 신청서'>
        <dl className='space-y-5'>
          {registration?.questions.map((q) => (
            <div key={q.id}>
              <dt className='type-label-lg'>{q.label}</dt>
              <dd className='mt-2 whitespace-pre-wrap break-words type-body-sm text-fg-secondary'>
                {Array.isArray(registration.answers[q.id])
                  ? (registration.answers[q.id] as string[]).join(', ') || '답변 없음'
                  : registration.answers[q.id] || '답변 없음'}
              </dd>
            </div>
          ))}
        </dl>
        {registration?.questions.length === 0 && (
          <p className='type-body-sm text-fg-muted'>추가 질문이 없는 신청서입니다.</p>
        )}
      </Modal>
    </div>
  );
}
