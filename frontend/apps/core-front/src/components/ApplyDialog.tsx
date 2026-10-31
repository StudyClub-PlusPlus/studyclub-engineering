'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { categoriesOf, type ApplicationQuestionType, type MemberRegion } from '@studyclub/mock';
import type { ApiStudyApplicationForm } from '@studyclub/mock/msw';
import { Button, Checkbox, Modal } from '@studyclub/ui';
import { CalendarClock } from 'lucide-react';

import { FormHeaderCard, QuestionFillView, formCardClass } from '@/components/ApplicationFormUi';
import { DiscordNicknameField } from '@/components/DiscordNicknameField';
import { useStudyApplicationForm, useSubmitApplication } from '@/features/applications/queries';
import { track } from '@/lib/analytics';
import { AVAILABLE_DAYS, makeApplySchema, normalizeSingleLine } from '@/lib/apply-validation';
import type { Locale, Study } from '@/lib/content';
import { ApiError } from '@/lib/http';
import { m, t } from '@/lib/i18n';
import { addApplication, getApplication, getDiscordNickname, getRegion, setDiscordNickname } from '@/lib/me';

function StudyFormHeader({
  study,
  form,
  locale,
}: {
  study: Study;
  form: ApiStudyApplicationForm | null;
  locale: Locale;
}) {
  const cats = categoriesOf(study);
  const schedule = form?.schedule ? form.schedule : t({ ko: '일정 미정', en: 'Schedule TBD' }, locale);
  const deadline = form?.recruitDeadline?.slice(0, 10);
  const deadlineLabel = deadline
    ? t({ ko: `${deadline}까지 모집`, en: `Apply by ${deadline}` }, locale)
    : t({ ko: '모집 기한 미정', en: 'Deadline TBD' }, locale);

  return (
    <div>
      <FormHeaderCard
        title={form?.title ?? t(study.title, locale)}
        summary={form?.description ?? t(study.summary, locale)}
      />
      <section className={`${formCardClass()} mt-3`}>
        {cats.length > 0 && (
          <p className='type-label-sm uppercase text-fg-muted'>{cats.join(' · ')}</p>
        )}
        <dl className={`${cats.length > 0 ? 'mt-3' : ''} flex flex-col gap-2 type-body-sm`}>
          <div className='flex items-start gap-2'>
            <dt className='shrink-0 font-semibold text-fg'>{m('common.schedule', locale)}</dt>
            <dd className='flex items-center gap-1.5 text-fg-secondary'>
              <CalendarClock size={13} strokeWidth={1.75} className='shrink-0' />
              {schedule}
            </dd>
          </div>
          <div className='flex items-start gap-2'>
            <dt className='shrink-0 font-semibold text-fg'>{m('detail.deadline', locale)}</dt>
            <dd className='text-fg-secondary'>{deadlineLabel}</dd>
          </div>
        </dl>
        {form?.detail && (
          <div className='mt-4 border-t border-border pt-4'>
            <p className='type-label-lg text-fg'>{m('common.about_study', locale)}</p>
            <p className='mt-2 whitespace-pre-line type-body-sm text-fg-secondary'>{form.detail}</p>
          </div>
        )}
      </section>
    </div>
  );
}

export function ApplyDialog({
  study,
  locale,
  open,
  onClose,
  onSubmitted,
  onDeadline,
  onRequireDiscord,
}: {
  study: Study;
  locale: Locale;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  onDeadline?: (label: string) => void;
  onRequireDiscord?: () => void;
}) {
  const router = useRouter();

  const {
    data: formData,
    isLoading,
    isFetching,
    isError: formError,
    refetch: refetchForm,
  } = useStudyApplicationForm(study.study_id, open);
  const form = formData ?? null;
  const formLoading = isLoading || isFetching;

  const submitMutation = useSubmitApplication(study.study_id);
  const saving = submitMutation.isPending;

  const fixedSchedule = form?.schedule ?? null;
  const extraQuestions = (form?.questions ?? []).map((q) => ({
    ...q,
    type: q.type.toLowerCase() as ApplicationQuestionType,
  }));

  const applySchema = useMemo(
    () =>
      makeApplySchema({
        extraQuestions,
        hasFixedSchedule: Boolean(fixedSchedule),
        locale,
      }),
    [extraQuestions, fixedSchedule, locale],
  );

  const [myRegion, setMyRegion] = useState<MemberRegion>('KR');
  useEffect(() => setMyRegion(getRegion()), [open]);

  const [agreed, setAgreed] = useState(false);
  const [days, setDays] = useState<string[]>([]);
  const [draftNick, setDraftNick] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [otherSelected, setOtherSelected] = useState<Record<string, boolean>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [invalidKey, setInvalidKey] = useState<string | null>(null);
  const [attention, setAttention] = useState(0);

  const dialogOpenTracked = useRef(false);

  useEffect(() => {
    if (open && form && !dialogOpenTracked.current) {
      dialogOpenTracked.current = true;
      track({
        name: 'Study Apply Dialog Opened',
        props: { study_id: String(study.study_id), has_fixed_schedule: !!form.schedule, my_region: myRegion },
      });
    }
    if (!open) dialogOpenTracked.current = false;
  }, [open, form, myRegion, study.study_id]);

  useEffect(() => {
    if (!open || days.length === 0) return;
    const timer = setTimeout(() => {
      track({
        name: 'Study Apply Slots Selected',
        props: {
          study_id: String(study.study_id),
          selected_slots_count: days.length,
          selected_days: days,
          region: myRegion,
        },
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [days, open, myRegion, study.study_id]);

  const discordRef = useRef<HTMLElement>(null);
  const scheduleRef = useRef<HTMLElement>(null);
  const daysRef = useRef<HTMLElement>(null);
  const questionRefs = useRef<Record<string, HTMLElement | null>>({});

  function cardClass(key: string) {
    return invalidKey === key
      ? 'apply-invalid rounded-xl border-2 border-error-600 bg-error-50 px-6 py-5'
      : formCardClass();
  }

  function fieldOf(key: string | null) {
    if (!key) return null;
    if (key === 'discord') return discordRef.current;
    if (key === 'schedule') return scheduleRef.current;
    if (key === 'days') return daysRef.current;
    return questionRefs.current[key] ?? null;
  }

  function markInvalid(key: string, message: string) {
    setInvalidKey(key);
    setAttention((n) => n + 1);
    setError(message);
  }

  function clearInvalid(key: string) {
    setError(null);
    setInvalidKey((cur) => (cur === key ? null : cur));
  }

  function FieldHint({ field }: { field: string }) {
    if (invalidKey !== field || !error) return null;
    return (
      <p role='alert' className='mt-2 type-label-sm text-error-700'>
        {error}
      </p>
    );
  }

  useEffect(() => {
    if (!open || !invalidKey) return;
    const el = fieldOf(invalidKey);
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const id = window.setTimeout(() => {
      const control = el.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])',
      );
      (control ?? el).focus({ preventScroll: true });
    }, 280);
    return () => window.clearTimeout(id);
  }, [invalidKey, attention, open]);

  useEffect(() => {
    if (!open) return;
    setAgreed(false);
    setDays([]);
    setDraftNick(getDiscordNickname() ?? '');
    setAnswers({});
    setOtherSelected({});
    setOtherTexts({});
    setError(null);
    setInvalidKey(null);
    setAttention(0);
    setSubmitError(null);
    setDone(false);
  }, [open]);

  function close(silent = false) {
    if (!done && !silent) {
      track({
        name: 'Study Apply Dialog Dismissed',
        props: {
          study_id: String(study.study_id),
          interaction_step: agreed ? 'schedule' : days.length > 0 ? 'slots' : 'idle',
        },
      });
    }
    setAgreed(false);
    setDays([]);
    setDraftNick('');
    setAnswers({});
    setOtherSelected({});
    setOtherTexts({});
    setError(null);
    setInvalidKey(null);
    setAttention(0);
    setSubmitError(null);
    if (done) onSubmitted();
    setDone(false);
    onClose();
  }

  function toggleDay(key: string) {
    clearInvalid('days');
    setDays((d) => (d.includes(key) ? d.filter((x) => x !== key) : [...d, key]));
  }

  async function submit() {
    if (getApplication(study.id)) {
      onSubmitted();
      return;
    }

    const parseResult = applySchema.safeParse({
      discordNickname: draftNick,
      days,
      answers,
      otherSelected,
      otherTexts,
      agreed,
    });

    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      const fieldKey = String(issue.path[0]);
      return markInvalid(fieldKey, issue.message);
    }

    setError(null);
    setInvalidKey(null);
    setSubmitError(null);
    const normalizedNick = normalizeSingleLine(draftNick);
    setDiscordNickname(normalizedNick);

    track({
      name: 'Study Apply Submitted',
      props: {
        study_id: String(study.study_id),
        study_title_ko: study.title.ko,
        study_category: study.category ?? '',
        study_status: study.status,
        has_fixed_schedule: !!fixedSchedule,
        selected_slots_count: days.length,
        region: myRegion,
        schedule_confirmed: agreed,
      },
    });

    try {
      const finalAnswers: Record<string, string | string[]> = {};
      for (const q of extraQuestions) {
        if (q.type === 'checkbox') {
          const selected = Array.isArray(answers[q.id]) ? [...(answers[q.id] as string[])] : [];
          if (otherSelected[q.id] && otherTexts[q.id]?.trim()) {
            selected.push(normalizeSingleLine(otherTexts[q.id]));
          }
          if (selected.length > 0) {
            finalAnswers[q.id] = selected;
          }
        } else if (q.type === 'radio' && otherSelected[q.id]) {
          finalAnswers[q.id] = normalizeSingleLine(otherTexts[q.id]);
        } else if (answers[q.id] !== undefined && answers[q.id] !== '') {
          finalAnswers[q.id] = answers[q.id];
        }
      }

      const reqBody: {
        discordNickname: string;
        availableDays: string[];
        answers: Record<string, string | string[]>;
        scheduleAgreed?: boolean;
      } = {
        discordNickname: normalizedNick,
        availableDays: days,
        answers: finalAnswers,
      };
      if (fixedSchedule) reqBody.scheduleAgreed = agreed;

      await submitMutation.mutateAsync(reqBody);

      addApplication({
        studyId: study.id,
        appliedAt: new Date().toISOString().slice(0, 10),
        status: 'pending',
        region: myRegion,
        cells: days,
      });
      setDone(true);
      track({
        name: 'Study Apply Completed',
        props: {
          study_id: String(study.study_id),
          study_title_ko: study.title.ko,
          study_category: study.category ?? '',
          study_status: study.status,
          apply_type: 'internal',
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          close(true);
          onRequireDiscord?.();
          return;
        }

        if (err.status === 409) {
          if (err.message.includes('이미 신청')) {
            addApplication({
              studyId: study.id,
              appliedAt: new Date().toISOString().slice(0, 10),
              status: 'pending',
              region: myRegion,
              cells: days,
            });
            onSubmitted();
            return;
          }

          if (err.message.includes('이미 참여')) {
            setSubmitError(
              t({ ko: '이미 참여 중인 스터디입니다.', en: 'You are already participating in this study.' }, locale),
            );
            return;
          }

          if (err.message.includes('정원')) {
            const label = t({ ko: '정원 마감', en: 'Full' }, locale);
            close(true);
            onDeadline?.(label);
            return;
          }

          const label = t({ ko: '모집 마감', en: 'Recruiting closed' }, locale);
          close(true);
          onDeadline?.(label);
          return;
        }
      }

      track({
        name: 'Study Apply Failed',
        props: {
          study_id: String(study.study_id),
          error_type: err instanceof ApiError ? 'server' : 'network',
          validation_field: null,
        },
      });
      setSubmitError(
        err instanceof ApiError && err.message
          ? err.message
          : t({ ko: '신청하지 못했습니다. 다시 시도해 주세요.', en: 'Application failed. Please try again.' }, locale),
      );
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : () => close()}
      size='lg'
      title={t({ ko: '스터디 신청', en: 'Apply to study' }, locale)}
      footer={
        done ? (
          <>
            <Button variant='secondary' onClick={() => close()}>
              {t({ ko: '닫기', en: 'Close' }, locale)}
            </Button>
            <Button
              onClick={() => {
                close();
                // 내 스터디룸 — 기본 탭(참여중)에는 아직 시작 전인 새 스터디가 없어 「전체」로 연다
                router.push(`/${locale}/my/joined?status=all`);
              }}
            >
              {t({ ko: '내 스터디룸 보러 가기', en: 'Go to My study room' }, locale)}
            </Button>
          </>
        ) : (
          <>
            <Button variant='secondary' onClick={() => close()} disabled={saving}>
              {t({ ko: '취소', en: 'Cancel' }, locale)}
            </Button>
            <Button onClick={submit} loading={saving} disabled={!form || formLoading || formError}>
              {t({ ko: '신청', en: 'Apply' }, locale)}
            </Button>
          </>
        )
      }
    >
      {done ? (
        // 신청하면 곧 참여다 — 승인 대기가 없다 (POL-0004)
        <div className='flex flex-col gap-2 py-4 type-body-sm'>
          <p className='text-fg'>
            {t(
              {
                ko: '스터디 신청이 완료되었습니다. 내 스터디룸으로 이동할까요?',
                en: 'Your application is in. Go to My study room?',
              },
              locale,
            )}
          </p>
          <p className='text-fg-secondary'>
            {t({ ko: '제출한 내용은 수정할 수 없습니다.', en: 'Submitted answers cannot be edited.' }, locale)}
          </p>
        </div>
      ) : (
        <div className='-mx-6 -my-4 h-full bg-surface-1 px-6 py-4'>
          <div className='flex flex-col gap-3'>
            {formLoading ? (
              <div className='flex flex-col items-center justify-center py-16 text-center'>
                <p className='type-body-sm text-fg-secondary'>{t({ ko: '불러오는 중…', en: 'Loading…' }, locale)}</p>
              </div>
            ) : formError ? (
              <div className='flex flex-col items-center justify-center gap-3 py-16 text-center'>
                <p className='type-body-sm text-fg-secondary'>
                  {t(
                    {
                      ko: '신청 폼을 불러오지 못했습니다. 다시 시도해 주세요.',
                      en: 'Failed to load the application form. Please try again.',
                    },
                    locale,
                  )}
                </p>
                <Button variant='secondary' onClick={() => void refetchForm()}>
                  {t({ ko: '다시 시도', en: 'Retry' }, locale)}
                </Button>
              </div>
            ) : (
              <>
                <StudyFormHeader study={study} form={form} locale={locale} />

                <section ref={discordRef} tabIndex={-1} className={`${cardClass('discord')} outline-none`}>
                  <DiscordNicknameField
                    value={draftNick}
                    invalid={invalidKey === 'discord'}
                    onChange={(v) => {
                      clearInvalid('discord');
                      setDraftNick(v);
                    }}
                  />
                  <FieldHint field='discord' />
                </section>

                <section ref={daysRef} tabIndex={-1} className={`${cardClass('days')} outline-none`}>
                  <p className='type-label-lg text-neutral-800'>
                    {t({ ko: '참여 가능한 요일', en: 'Days you can join' }, locale)}
                    <span className='ml-0.5 text-error-600'>*</span>
                  </p>
                  <div className='mt-2 flex flex-col gap-2'>
                    {AVAILABLE_DAYS.map((d) => (
                      <Checkbox
                        key={d.key}
                        aria-invalid={invalidKey === 'days' ? 'true' : undefined}
                        label={locale === 'ko' ? d.ko : d.en}
                        checked={days.includes(d.key)}
                        onChange={() => toggleDay(d.key)}
                      />
                    ))}
                  </div>
                  <FieldHint field='days' />
                </section>

                {fixedSchedule && (
                  <section ref={scheduleRef} tabIndex={-1} className={`${cardClass('schedule')} outline-none`}>
                    <Checkbox
                      aria-invalid={invalidKey === 'schedule' ? 'true' : undefined}
                      label={t(
                        { ko: `${fixedSchedule} 참여 가능합니다`, en: `I can attend: ${fixedSchedule}` },
                        locale,
                      )}
                      checked={agreed}
                      onChange={(e) => {
                        setAgreed(e.target.checked);
                        clearInvalid('schedule');
                      }}
                    />
                    <FieldHint field='schedule' />
                  </section>
                )}

                {extraQuestions.map((q) => (
                  <section
                    key={q.id}
                    tabIndex={-1}
                    ref={(el) => {
                      questionRefs.current[q.id] = el;
                    }}
                    className={`${cardClass(q.id)} outline-none`}
                  >
                    <QuestionFillView
                      q={q}
                      invalid={invalidKey === q.id}
                      value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                      values={Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []}
                      otherChecked={Boolean(otherSelected[q.id])}
                      otherValue={otherTexts[q.id] ?? ''}
                      onChange={(value) => {
                        clearInvalid(q.id);
                        setOtherSelected((prev) => ({ ...prev, [q.id]: false }));
                        setAnswers((prev) => ({ ...prev, [q.id]: value }));
                      }}
                      onToggle={(option) => {
                        clearInvalid(q.id);
                        setAnswers((prev) => {
                          const cur = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
                          return {
                            ...prev,
                            [q.id]: cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option],
                          };
                        });
                      }}
                      onOtherToggle={(checked) => {
                        clearInvalid(q.id);
                        setOtherSelected((prev) => ({ ...prev, [q.id]: checked }));
                        if (q.type === 'radio' && checked) {
                          setAnswers((prev) => ({ ...prev, [q.id]: otherTexts[q.id] ?? '' }));
                        }
                      }}
                      onOtherChange={(text) => {
                        clearInvalid(q.id);
                        setOtherTexts((prev) => ({ ...prev, [q.id]: text }));
                        if (q.type === 'radio') {
                          setAnswers((prev) => ({ ...prev, [q.id]: text }));
                        }
                      }}
                    />
                    <FieldHint field={q.id} />
                  </section>
                ))}

                {submitError && (
                  <div role='alert' className='flex items-center gap-3 rounded-xl bg-error-50 px-4 py-3'>
                    <p className='flex-1 type-body-sm text-error-700'>{submitError}</p>
                    <Button variant='secondary' onClick={submit} disabled={saving}>
                      {t({ ko: '다시 시도', en: 'Retry' }, locale)}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
