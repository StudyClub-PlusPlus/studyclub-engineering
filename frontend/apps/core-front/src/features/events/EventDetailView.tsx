'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ApiEventDetail, ApiEventRegistration } from '@/features/events/repository';
import {
  answersForUnchangedQuestions,
  draftToSubmitPayload,
  occupiesSeat,
  questionFingerprint,
  validateDraftAnswers,
  type DraftAnswers,
} from '@/features/events/answers';
import { eventChannels, SCHEDULE_ZONES } from '@/features/events/channels';
import { formatEventInstant } from '@/features/events/format';
import {
  applyBlockedMessage,
  CHANNEL_LABEL,
  DISPLAY_STATUS_LABEL,
  FORMAT_LABEL,
  REGISTRATION_STATUS_LABEL,
  displayStatusTone,
  registrationTone,
} from '@/features/events/labels';
import {
  useCancelEventRegistration,
  useEventDetail,
  useMyEventRegistration,
  useSubmitEventRegistration,
} from '@/features/events/queries';
import { getUser } from '@/features/auth/auth';
import { useDisplayTimeZone } from '@/features/profile/use-display-timezone';
import type { Locale } from '@studyclub/types';
import { Badge, Button, Checkbox, Input, Modal, Radio, Select, Textarea } from '@studyclub/ui';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, MapPin, Video } from 'lucide-react';

import { TEXT_ANSWER_MAX, TEXTAREA_ANSWER_MAX } from '@/features/events/answers';
import { DETAIL_ASIDE, DETAIL_GRID, PAGE } from '@/lib/layout';
import { track } from '@/lib/analytics';
import { ApiError } from '@/lib/http';

function errorCode(e: unknown): string | undefined {
  return e instanceof ApiError ? (e.body as { errorCode?: string } | undefined)?.errorCode : undefined;
}

export function EventDetailView({
  eventId,
  locale,
  initial,
}: {
  eventId: number;
  locale: Locale;
  initial: ApiEventDetail;
}) {
  const router = useRouter();
  const displayTimeZone = useDisplayTimeZone();
  const [zoneOverride, setZoneOverride] = useState('');
  const { data, refetch, isFetching } = useEventDetail(eventId, initial);
  const event = data ?? initial;
  const submit = useSubmitEventRegistration(eventId);
  const cancelMutation = useCancelEventRegistration(eventId);

  const [applyOpen, setApplyOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [viewAnswers, setViewAnswers] = useState(false);
  const [channel, setChannel] = useState<'ONLINE' | 'OFFLINE'>('ONLINE');
  const [answers, setAnswers] = useState<DraftAnswers>({});
  const [formQuestions, setFormQuestions] = useState(event.questions);
  const [questionsUpdated, setQuestionsUpdated] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState('');
  const idempotencyRef = useRef<string | null>(null);
  const receiptRef = useRef<HTMLHeadingElement>(null);
  const [focusReceipt, setFocusReceipt] = useState(0);

  const myRegistration = event.myRegistration;
  const currentZone = zoneOverride || displayTimeZone;
  const channels = eventChannels(event.format);
  const statusLabel = DISPLAY_STATUS_LABEL[event.displayStatus]?.[locale] ?? event.displayStatus;

  const { data: registrationDetail, refetch: refetchRegistration } = useMyEventRegistration(
    eventId,
    viewAnswers,
  );

  useEffect(() => {
    if (!focusReceipt) return;
    const timer = setTimeout(() => receiptRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [focusReceipt]);

  const applyLabel = useMemo(() => {
    if (event.canApply) {
      return myRegistration?.status === 'CANCELLED' || !myRegistration
        ? locale === 'ko'
          ? '행사 신청하기'
          : 'Apply'
        : locale === 'ko'
          ? '다시 신청하기'
          : 'Apply again';
    }
    if (myRegistration && occupiesSeat(myRegistration.status)) {
      return REGISTRATION_STATUS_LABEL[myRegistration.status]?.[locale];
    }
    if (event.applyBlockedReason === 'DECLINED_BEFORE') return locale === 'ko' ? '참가 불가' : 'Declined';
    return applyBlockedMessage(event.applyBlockedReason, locale) ?? statusLabel;
  }, [event, locale, myRegistration, statusLabel]);

  function openApply() {
    const user = getUser();
    if (event.applyBlockedReason === 'LOGIN_REQUIRED' || !user) {
      router.push(`/${locale}/login?next=${encodeURIComponent(`/${locale}/events/${eventId}`)}`);
      return;
    }
    if (event.applyBlockedReason === 'ONBOARDING_REQUIRED' || !user.onboardingCompletedAt) {
      router.push(`/${locale}/onboarding?next=${encodeURIComponent(`/${locale}/events/${eventId}`)}`);
      return;
    }
    const firstOpen =
      channels.find((mode) => (event.seats.find((s) => s.channel === mode)?.remaining ?? 0) > 0) ?? channels[0]!;
    setChannel(firstOpen);
    setAnswers({});
    setFormQuestions(event.questions);
    setQuestionsUpdated(false);
    setFieldErrors({});
    setBanner('');
    idempotencyRef.current = crypto.randomUUID();
    setApplyOpen(true);
    track({ name: 'Event Apply Form Opened', props: { event_id: String(eventId) } });
  }

  useEffect(() => {
    if (!applyOpen) return;
    if (questionFingerprint(formQuestions) === questionFingerprint(event.questions)) return;
    setAnswers((current) => answersForUnchangedQuestions(formQuestions, event.questions, current));
    setFormQuestions(event.questions);
    setQuestionsUpdated(true);
  }, [applyOpen, event.questions, formQuestions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateDraftAnswers(answers, formQuestions, locale);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const key = idempotencyRef.current ?? crypto.randomUUID();
    idempotencyRef.current = key;
    try {
      await submit.mutateAsync({
        idempotencyKey: key,
        payload: {
          channel,
          questionVersion: event.questionVersion,
          answers: draftToSubmitPayload(answers, formQuestions),
        },
      });
      setApplyOpen(false);
      setFocusReceipt((n) => n + 1);
      setBanner(locale === 'ko' ? '신청이 접수되었어요.' : 'Your application was submitted.');
      await refetch();
    } catch (err) {
      const code = errorCode(err);
      if (code === 'EVENT_QUESTIONS_CHANGED') {
        setQuestionsUpdated(true);
        setBanner(locale === 'ko' ? '신청 질문이 변경되었어요. 확인한 뒤 다시 신청해 주세요.' : 'Questions changed. Review and apply again.');
        await refetch();
        return;
      }
      if (
        code === 'EVENT_CHANNEL_FULL' ||
        code === 'EVENT_ALREADY_REGISTERED' ||
        code === 'EVENT_REGISTRATION_CLOSED' ||
        code === 'EVENT_CANCELLED' ||
        code === 'EVENT_ENDED'
      ) {
        setApplyOpen(false);
        await refetch();
      }
      setBanner(err instanceof ApiError ? err.message : locale === 'ko' ? '신청에 실패했어요.' : 'Application failed.');
    }
  }

  async function handleCancel() {
    if (!myRegistration) return;
    try {
      await cancelMutation.mutateAsync(myRegistration.registrationId);
      setCancelOpen(false);
      setBanner(locale === 'ko' ? '신청을 취소했어요.' : 'Your application was cancelled.');
      await refetch();
    } catch (err) {
      const code = errorCode(err);
      if (code === 'EVENT_REGISTRATION_STATUS_NOT_ALLOWED' || code === 'NOT_FOUND') {
        setCancelOpen(false);
        await refetch();
      }
      setBanner(err instanceof ApiError ? err.message : locale === 'ko' ? '취소에 실패했어요.' : 'Cancel failed.');
    }
  }

  return (
    <div className={`${PAGE} py-8 sm:py-10`}>
      <Link
        href={`/${locale}/events`}
        className='inline-flex items-center gap-1 type-label-lg text-fg-muted hover:text-brand'
      >
        <ArrowLeft size={16} />
        {locale === 'ko' ? '행사 목록' : 'All events'}
      </Link>

      {banner && (
        <p role='status' className='mt-4 rounded-control bg-brand-subtle px-4 py-3 type-body-sm text-brand'>
          {banner}
        </p>
      )}

      <div className={`mt-6 ${DETAIL_GRID}`}>
        <article className='min-w-0'>
          <header className='space-y-4 border-b border-border pb-7'>
            <div className='flex flex-wrap items-center gap-2'>
              <Badge tone={displayStatusTone(event.displayStatus)} dot>
                {statusLabel}
              </Badge>
              <span className='type-label-sm text-fg-muted'>{FORMAT_LABEL[event.format]?.[locale]}</span>
            </div>
            <h1 className='type-headline-lg'>{event.title}</h1>
            <p className='type-body-lg text-fg-muted'>{event.summary}</p>
          </header>

          <section className='py-7'>
            <h2 className='mb-4 type-title-md'>{locale === 'ko' ? '행사 소개' : 'About'}</h2>
            <div className='whitespace-pre-wrap break-words type-body-md leading-relaxed text-fg-secondary'>
              {event.description}
            </div>
          </section>

          <section className='space-y-4 border-t border-border py-6'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <h2 className='type-title-md'>{locale === 'ko' ? '일정과 장소' : 'Schedule & location'}</h2>
              <Select
                aria-label={locale === 'ko' ? '일정 표시 시간대' : 'Display time zone'}
                size='sm'
                value={currentZone}
                onChange={(e) => setZoneOverride(e.target.value)}
              >
                {SCHEDULE_ZONES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label[locale]}
                  </option>
                ))}
              </Select>
            </div>
            <dl className='space-y-4 type-body-sm'>
              <CardRow
                icon={CalendarDays}
                title={locale === 'ko' ? '행사 일정' : 'Event schedule'}
                body={
                  <>
                    {formatEventInstant(event.startsAt, currentZone, locale)}
                    {event.endsAt && (
                      <>
                        <br />~ {formatEventInstant(event.endsAt, currentZone, locale)}
                      </>
                    )}
                  </>
                }
              />
              <CardRow
                icon={Clock3}
                title={locale === 'ko' ? '신청 마감' : 'Application deadline'}
                body={formatEventInstant(event.deadlineAt, currentZone, locale)}
              />
              {event.offline && (
                <CardRow
                  icon={MapPin}
                  title={locale === 'ko' ? '오프라인' : 'In person'}
                  body={<span className='break-words'>{event.offline.location}</span>}
                />
              )}
              {event.format !== 'OFFLINE' && (
                <CardRow
                  icon={Video}
                  title={locale === 'ko' ? '온라인' : 'Online'}
                  body={
                    locale === 'ko'
                      ? '참가 확정 후 참여 링크를 확인할 수 있어요.'
                      : 'Join link appears after you are confirmed.'
                  }
                />
              )}
            </dl>
          </section>
        </article>

        <aside className={`space-y-4 ${DETAIL_ASIDE}`}>
          <section className='card p-5 sm:p-6'>
            <h2 className='type-title-md'>{locale === 'ko' ? '함께 참여해요' : 'Join us'}</h2>
            <div className='mt-4 space-y-3'>
              {event.seats.map((seat) => (
                <div key={seat.channel} className='flex justify-between gap-2 type-body-sm'>
                  <span>{CHANNEL_LABEL[seat.channel]?.[locale]}</span>
                  <span className={seat.remaining ? 'text-fg-secondary' : 'text-fg-muted'}>
                    {seat.remaining
                      ? locale === 'ko'
                        ? `${seat.remaining}자리 남음 / ${seat.capacity}명`
                        : `${seat.remaining} spots left / ${seat.capacity}`
                      : locale === 'ko'
                        ? '정원 마감'
                        : 'Full'}
                  </span>
                </div>
              ))}
            </div>
            <div className='my-5 border-t border-border pt-4'>
              <p className='type-label-lg'>
                {event.confirmation === 'AUTO'
                  ? locale === 'ko'
                    ? '신청하면 바로 참가가 확정돼요'
                    : 'You are confirmed as soon as you apply'
                  : locale === 'ko'
                    ? '운영진 확인 후 참가가 확정돼요'
                    : 'Organizers confirm after review'}
              </p>
              {event.confirmation === 'REVIEW' && (
                <p className='mt-2 type-body-sm text-fg-muted'>
                  {locale === 'ko'
                    ? '신청 내용을 확인한 뒤 이메일로 알려드려요.'
                    : 'We will email you after reviewing your application.'}
                </p>
              )}
            </div>
            <Button
              className='w-full'
              size='lg'
              disabled={
                !event.canApply &&
                event.applyBlockedReason !== 'LOGIN_REQUIRED' &&
                event.applyBlockedReason !== 'ONBOARDING_REQUIRED'
              }
              loading={isFetching}
              onClick={() => {
                if (event.canApply || event.applyBlockedReason === 'LOGIN_REQUIRED' || event.applyBlockedReason === 'ONBOARDING_REQUIRED') {
                  openApply();
                }
              }}
            >
              {applyLabel}
            </Button>
            {!event.canApply && event.applyBlockedReason && event.applyBlockedReason !== 'LOGIN_REQUIRED' && (
              <p className='mt-2 type-body-sm text-fg-muted'>{applyBlockedMessage(event.applyBlockedReason, locale)}</p>
            )}
          </section>

          {myRegistration && (
            <section aria-live='polite' className='card p-5 sm:p-6'>
              <div className='mb-3 flex items-center gap-2 text-brand'>
                {myRegistration.status === 'CONFIRMED' ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}
                <h2 ref={receiptRef} tabIndex={-1} className='type-title-sm'>
                  {locale === 'ko' ? '내 신청 내역' : 'My application'}
                </h2>
              </div>
              <Badge tone={registrationTone(myRegistration.status)} dot>
                {REGISTRATION_STATUS_LABEL[myRegistration.status]?.[locale]}
              </Badge>
              <p className='mt-3 type-body-sm'>
                {CHANNEL_LABEL[myRegistration.channel]?.[locale]} ·{' '}
                {locale === 'ko' ? '신청 접수' : 'Submitted'}
              </p>
              {myRegistration.status === 'PENDING' && (
                <p className='mt-2 type-body-sm text-fg-muted'>
                  {locale === 'ko'
                    ? '신청이 접수되었어요. 운영진이 확인한 뒤 이메일로 안내드려요.'
                    : 'We received your application. We will email you after review.'}
                </p>
              )}
              {myRegistration.status === 'CONFIRMED' && myRegistration.channel === 'ONLINE' && (
                <>
                  {myRegistration.onlineLinkVisible && myRegistration.onlineUrl ? (
                    <a
                      className='mt-4 inline-flex type-label-lg text-brand underline'
                      href={myRegistration.onlineUrl}
                      target='_blank'
                      rel='noreferrer'
                    >
                      {locale === 'ko' ? '온라인 참여 링크 열기' : 'Open join link'}
                    </a>
                  ) : (
                    <p className='mt-3 type-body-sm text-fg-muted'>
                      {locale === 'ko' ? '참여 링크는 운영진이 추후 안내해 드려요.' : 'Join link will follow.'}
                    </p>
                  )}
                </>
              )}
              {myRegistration.status === 'CONFIRMED' && myRegistration.channel === 'OFFLINE' && event.offline && (
                <p className='mt-3 break-words type-body-sm text-fg-secondary'>
                  {locale === 'ko' ? '장소: ' : 'Location: '}
                  {event.offline.location}
                </p>
              )}
              <div className='mt-4 flex flex-wrap gap-1'>
                <Button size='sm' variant='tertiary' onClick={() => setViewAnswers(true)}>
                  {locale === 'ko' ? '신청서 보기' : 'View application'}
                </Button>
                {myRegistration.canCancel && (
                  <Button size='sm' variant='tertiary' onClick={() => setCancelOpen(true)}>
                    {locale === 'ko' ? '신청 취소' : 'Cancel application'}
                  </Button>
                )}
              </div>
              {myRegistration.cancelBlockedReason === 'DEADLINE_PASSED' && (
                <p className='mt-2 type-label-sm text-fg-muted'>
                  {locale === 'ko' ? '신청 마감 후 취소는 운영진에게 문의해 주세요.' : 'Contact organizers to cancel after the deadline.'}
                </p>
              )}
            </section>
          )}
        </aside>
      </div>

      <Modal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title={locale === 'ko' ? '행사 신청' : 'Apply'}
        size='md'
        footer={
          <>
            <Button variant='secondary' onClick={() => setApplyOpen(false)}>
              {locale === 'ko' ? '돌아가기' : 'Back'}
            </Button>
            <Button type='submit' form='event-application-form' loading={submit.isPending}>
              {locale === 'ko' ? '신청하기' : 'Submit'}
            </Button>
          </>
        }
      >
        <form id='event-application-form' className='space-y-5' onSubmit={handleSubmit}>
          <p className='type-label-lg'>{event.title}</p>
          <fieldset className='space-y-2'>
            <legend className='mb-2 type-label-lg'>{locale === 'ko' ? '참여 방식' : 'How you join'}</legend>
            {channels.map((mode) => {
              const seat = event.seats.find((s) => s.channel === mode);
              const remaining = seat?.remaining ?? 0;
              return (
                <label
                  key={mode}
                  className={`flex items-center gap-3 rounded-control border p-3 ${channel === mode ? 'border-brand bg-brand-subtle' : 'border-border'} ${!remaining ? 'text-fg-muted' : ''}`}
                >
                  <input
                    // ui-native: 참여 방식 카드 — 남은 자리 수를 품은 카드 전체가 고르는 곳
                    type='radio'
                    name='event-channel'
                    className='accent-(--color-brand)'
                    checked={channel === mode}
                    disabled={!remaining}
                    onChange={() => setChannel(mode)}
                    aria-label={CHANNEL_LABEL[mode]?.[locale]}
                  />
                  <span className='type-label-lg'>{CHANNEL_LABEL[mode]?.[locale]}</span>
                  <span className='ml-auto type-label-sm'>
                    {remaining
                      ? locale === 'ko'
                        ? `${remaining}자리 남음`
                        : `${remaining} left`
                      : locale === 'ko'
                        ? '정원 마감'
                        : 'Full'}
                  </span>
                </label>
              );
            })}
          </fieldset>
          {questionsUpdated && (
            <p role='status' className='rounded-control bg-warning-bg p-3 type-body-sm text-warning-fg'>
              {locale === 'ko'
                ? '신청 질문이 바뀌었어요. 변경된 질문을 확인한 뒤 신청해 주세요.'
                : 'Questions changed. Review them and apply again.'}
            </p>
          )}
          {formQuestions.map((q) => (
            <QuestionField
              key={q.questionId}
              question={q}
              value={answers[q.questionId]}
              error={fieldErrors[q.questionId]}
              locale={locale}
              onChange={(next) => setAnswers((prev) => ({ ...prev, [q.questionId]: next }))}
            />
          ))}
        </form>
      </Modal>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={locale === 'ko' ? '신청을 취소할까요?' : 'Cancel application?'}
        footer={
          <>
            <Button variant='secondary' onClick={() => setCancelOpen(false)}>
              {locale === 'ko' ? '돌아가기' : 'Back'}
            </Button>
            <Button variant='danger' loading={cancelMutation.isPending} onClick={handleCancel}>
              {locale === 'ko' ? '신청 취소' : 'Cancel'}
            </Button>
          </>
        }
      >
        <p className='type-body-sm text-fg-secondary'>
          {locale === 'ko'
            ? '취소하면 자리가 반환돼요. 모집 중이면 다시 신청할 수 있어요.'
            : 'Your spot will open up. You can apply again while registration is open.'}
        </p>
      </Modal>

      <Modal
        open={viewAnswers}
        onClose={() => setViewAnswers(false)}
        title={locale === 'ko' ? '신청서' : 'Application'}
        size='md'
        footer={
          <Button variant='secondary' onClick={() => setViewAnswers(false)}>
            {locale === 'ko' ? '닫기' : 'Close'}
          </Button>
        }
      >
        <RegistrationAnswers
          locale={locale}
          detail={registrationDetail}
          onLoad={() => void refetchRegistration()}
        />
      </Modal>
    </div>
  );
}

function CardRow({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof CalendarDays;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className='flex gap-3'>
      <Icon aria-hidden size={18} className='mt-1 shrink-0 text-brand' />
      <div>
        <dt className='type-label-lg'>{title}</dt>
        <dd className='mt-1 text-fg-secondary'>{body}</dd>
      </div>
    </div>
  );
}

function QuestionField({
  question,
  value,
  error,
  locale,
  onChange,
}: {
  question: ApiEventDetail['questions'][number];
  value: string | string[] | undefined;
  error?: string;
  locale: Locale;
  onChange: (next: string | string[]) => void;
}) {
  const label = question.label;
  if (question.type === 'TEXT') {
    return (
      <Input
        label={label}
        required={question.required}
        maxLength={TEXT_ANSWER_MAX}
        value={String(value ?? '')}
        error={error}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (question.type === 'TEXTAREA') {
    return (
      <Textarea
        label={label}
        required={question.required}
        maxLength={TEXTAREA_ANSWER_MAX}
        value={String(value ?? '')}
        error={error}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (question.type === 'RADIO') {
    return (
      <div className='space-y-2'>
        <p className='type-label-lg'>
          {label}
          {question.required && <span className='ml-0.5 text-error-600'>*</span>}
        </p>
        <div className='flex flex-col gap-2'>
          {question.options.map((option) => (
            <Radio
              key={option}
              name={question.questionId}
              label={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
          ))}
        </div>
        {error && <p className='type-label-sm text-error-600'>{error}</p>}
      </div>
    );
  }
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className='space-y-2'>
      <p className='type-label-lg'>
        {label}
        {question.required && <span className='ml-0.5 text-error-600'>*</span>}
      </p>
      <div className='flex flex-col gap-2'>
        {question.options.map((option) => (
          <Checkbox
            key={option}
            label={option}
            checked={selected.includes(option)}
            onChange={(e) => {
              const next = new Set(selected);
              if (e.target.checked) next.add(option);
              else next.delete(option);
              onChange([...next]);
            }}
          />
        ))}
      </div>
      {error && <p className='type-label-sm text-error-600'>{error}</p>}
    </div>
  );
}

function RegistrationAnswers({
  locale,
  detail,
  onLoad,
}: {
  locale: Locale;
  detail?: ApiEventRegistration;
  onLoad: () => void;
}) {
  useEffect(() => {
    onLoad();
  }, [onLoad]);
  if (!detail) return <p role='status' className='type-body-sm text-fg-muted'>{locale === 'ko' ? '불러오는 중…' : 'Loading…'}</p>;
  return (
    <dl className='space-y-4'>
      {detail.questions.map((q) => (
        <div key={q.questionId}>
          <dt className='type-label-lg text-fg'>{q.label}</dt>
          <dd className='mt-1 whitespace-pre-wrap type-body-sm text-fg-secondary'>
            {q.answer.length ? q.answer.join(q.type === 'CHECKBOX' ? ', ' : '') : locale === 'ko' ? '(없음)' : '(none)'}
          </dd>
        </div>
      ))}
    </dl>
  );
}