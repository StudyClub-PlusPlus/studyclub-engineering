'use client';

import { useEffect, useRef, useState } from 'react';

import { formCardClass, FormHeaderCard, QuestionFillView } from '@core/components/ApplicationFormUi';
import { DiscordNicknameField } from '@core/components/DiscordNicknameField';
import {
  AVAILABLE_DAYS,
  daysIssue,
  extraAnswerIssue,
  nicknameIssue,
} from '@core/lib/apply-validation';
import type { Locale, Study } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';
import { addApplication, getApplication, getDiscordNickname, getRegion, setDiscordNickname } from '@core/lib/me';
import { categoriesOf, toISODate, type MemberRegion } from '@studyclub/mock';
import { Button, Checkbox, Modal } from '@studyclub/ui';
import { CalendarClock } from 'lucide-react';

/**
 * 스터디 신청 폼 — 프로토타입.
 *
 * 이름·이메일은 폼에 두지 않는다 — 계정에서 읽기만 한다.
 * 디스코드 **계정 연동**은 이 화면 앞에서 확인한다. 서버 별명이 있으면 기본값으로 채우고
 * 지원자가 고칠 수 있다. 고친 값은 계정에 다시 저장한다.
 *
 * 참여 가능한 요일은 모든 신청 폼에서 받는다. 확정된 진행 일정이 있으면 그 시간에
 * 참여 가능한지 확인도 받는다.
 *
 * 이미 제출한 신청서는 고치지 않는다. 같은 스터디에 다시 저장하지 않는다.
 *
 * TODO(api): POST /api/studies/{id}/applications — 저장 테이블·API 미구현이라 화면 상태로만 처리.
 * TODO(api): 신청자 지역·디스코드 별명은 로그인 회원 정보에서 읽는다.
 */

/**
 * 백오피스 신청 폼 헤더(제목·설명) + 등록 폼에 있는 스터디 항목.
 * 이름·이메일은 지원자 화면에 두지 않는다.
 */
function StudyFormHeader({ study, locale }: { study: Study; locale: Locale }) {
  const cats = categoriesOf(study);
  const deadline = toISODate(study.recruitment?.deadline);
  const schedule = study.schedule
    ? t(study.schedule, locale)
    : t({ ko: '일정 미정', en: 'Schedule TBD' }, locale);
  const deadlineLabel = deadline
    ? t({ ko: `${deadline}까지 모집`, en: `Apply by ${deadline}` }, locale)
    : t({ ko: '상시 모집', en: 'Always open' }, locale);

  return (
    <div data-anno='apply:1'>
      <FormHeaderCard
        title={study.applicationFormTitle ?? t(study.title, locale)}
        summary={study.applicationFormDescription ?? t(study.summary, locale)}
      />
      <section className={`${formCardClass()} mt-3`}>
        {cats.length > 0 && (
          <p className='text-[11px] font-bold uppercase tracking-[0.14em] text-fg-muted'>{cats.join(' · ')}</p>
        )}
        <dl className={`${cats.length > 0 ? 'mt-3' : ''} flex flex-col gap-2 text-sm`}>
          <div className='flex items-start gap-2'>
            <dt className='shrink-0 font-medium text-fg'>{m('common.schedule', locale)}</dt>
            <dd className='flex items-center gap-1.5 text-fg-secondary'>
              <CalendarClock size={13} strokeWidth={1.75} className='shrink-0' />
              {schedule}
            </dd>
          </div>
          <div className='flex items-start gap-2'>
            <dt className='shrink-0 font-medium text-fg'>{m('detail.deadline', locale)}</dt>
            <dd className='text-fg-secondary'>{deadlineLabel}</dd>
          </div>
        </dl>
        {study.description && (
          <div className='mt-4 border-t border-border pt-4'>
            <p className='text-sm font-bold text-fg'>{m('common.about_study', locale)}</p>
            <p className='mt-2 whitespace-pre-line text-sm leading-[1.75] text-fg-secondary'>
              {t(study.description, locale)}
            </p>
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
}: {
  study: Study;
  locale: Locale;
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const fixedSchedule = study.schedule ? t(study.schedule, locale) : null;
  const [myRegion, setMyRegion] = useState<MemberRegion>('KR');
  // 지역은 브라우저에 저장돼 있어 서버 렌더 시점에는 알 수 없다. 마운트 후 읽는다.
  useEffect(() => setMyRegion(getRegion()), [open]);

  const [agreed, setAgreed] = useState(false);
  const [days, setDays] = useState<string[]>([]);
  const [draftNick, setDraftNick] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [saving, setSaving] = useState(false);
  const extraQuestions = (study.applicationForm ?? []).filter((q) => q.id !== 'discord');
  const [invalidKey, setInvalidKey] = useState<string | null>(null);
  const [attention, setAttention] = useState(0);

  // 미입력 항목이 있으면 신청을 누른 자리에서 그 항목으로 화면을 옮긴다.
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
      <p data-anno='apply:7' role='alert' className='mt-2 text-xs text-error-700'>
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
    setError(null);
    setInvalidKey(null);
    setAttention(0);
    setSaving(false);
  }, [open]);

  function close() {
    setAgreed(false);
    setDays([]);
    setDraftNick('');
    setAnswers({});
    setError(null);
    setInvalidKey(null);
    setAttention(0);
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
    const nick = nicknameIssue(draftNick);
    if (nick === 'empty') {
      return markInvalid(
        'discord',
        t({ ko: '디스코드 서버 별명을 입력해 주세요.', en: 'Enter your Discord server nickname.' }, locale),
      );
    }
    if (nick === 'max') {
      return markInvalid(
        'discord',
        t({ ko: '100자 이내로 입력해 주세요.', en: 'Enter 100 characters or fewer.' }, locale),
      );
    }
    const dayProblem = daysIssue(days);
    if (dayProblem === 'empty' || dayProblem === 'max') {
      return markInvalid(
        'days',
        t({ ko: '참여 가능한 요일을 하나 이상 선택해 주세요.', en: 'Select at least one day you can join.' }, locale),
      );
    }
    if (dayProblem === 'enum') {
      return markInvalid(
        'days',
        t({ ko: '참여 가능한 요일을 다시 선택해 주세요.', en: 'Select a valid weekday.' }, locale),
      );
    }
    const extraProblem = extraQuestions
      .map((q) => ({ q, issue: extraAnswerIssue(q, answers[q.id]) }))
      .find((row) => row.issue);
    if (extraProblem?.issue === 'empty') {
      return markInvalid(
        extraProblem.q.id,
        t({ ko: '필수 질문에 답해 주세요.', en: 'Please answer required questions.' }, locale),
      );
    }
    if (extraProblem?.issue === 'max') {
      const cap = extraProblem.q.type === 'textarea' ? '2,000' : '200';
      return markInvalid(
        extraProblem.q.id,
        t(
          { ko: `${cap}자 이내로 입력해 주세요.`, en: `Enter ${cap.replace(',', '')} characters or fewer.` },
          locale,
        ),
      );
    }
    if (extraProblem?.issue === 'enum') {
      return markInvalid(
        extraProblem.q.id,
        t({ ko: '선택지를 다시 골라 주세요.', en: 'Choose from the given options.' }, locale),
      );
    }
    if (extraProblem?.issue === 'other-empty') {
      return markInvalid(
        extraProblem.q.id,
        t({ ko: '기타 내용을 입력해 주세요.', en: 'Enter the other option.' }, locale),
      );
    }
    if (extraProblem?.issue === 'other-max') {
      return markInvalid(
        extraProblem.q.id,
        t({ ko: '100자 이내로 입력해 주세요.', en: 'Enter 100 characters or fewer.' }, locale),
      );
    }
    if (fixedSchedule && !agreed) {
      return markInvalid(
        'schedule',
        t({ ko: '일정 참여 가능 여부를 확인해 주세요.', en: 'Please confirm you can attend.' }, locale),
      );
    }
    setError(null);
    setInvalidKey(null);
    setSaving(true);
    setDiscordNickname(draftNick);
    // TODO(api): POST /api/studies/{id}/applications
    await new Promise((r) => setTimeout(r, 400));
    addApplication({
      studyId: study.id,
      appliedAt: new Date().toISOString().slice(0, 10),
      status: 'pending',
      region: myRegion,
      cells: days,
    });
    setSaving(false);
    onSubmitted();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size='lg'
      title={t({ ko: '스터디 신청', en: 'Apply to study' }, locale)}
      footer={
        <>
          <Button data-anno='apply:8' variant='secondary' onClick={close} disabled={saving}>
            {t({ ko: '취소', en: 'Cancel' }, locale)}
          </Button>
          <Button data-anno='apply:9' onClick={submit} loading={saving}>
            {t({ ko: '신청', en: 'Apply' }, locale)}
          </Button>
        </>
      }
    >
      <div className='-mx-6 -my-4 h-full bg-surface-1 px-6 py-4'>
        <div className='flex flex-col gap-3'>
          <StudyFormHeader study={study} locale={locale} />

          <section data-anno='apply:2' ref={discordRef} tabIndex={-1} className={`${cardClass('discord')} outline-none`}>
            <DiscordNicknameField
              value={draftNick}
              onChange={(v) => {
                clearInvalid('discord');
                setDraftNick(v);
              }}
            />
            <FieldHint field='discord' />
          </section>

          <section data-anno='apply:4' ref={daysRef} tabIndex={-1} className={`${cardClass('days')} outline-none`}>
            <p className='text-sm font-medium text-neutral-800'>
              {t({ ko: '참여 가능한 요일', en: 'Days you can join' }, locale)}
              <span className='ml-0.5 text-error-600'>*</span>
            </p>
            <div className='mt-2 flex flex-col gap-2'>
              {AVAILABLE_DAYS.map((d) => (
                <Checkbox
                  key={d.key}
                  label={locale === 'ko' ? d.ko : d.en}
                  checked={days.includes(d.key)}
                  onChange={() => toggleDay(d.key)}
                />
              ))}
            </div>
            <FieldHint field='days' />
          </section>

          {fixedSchedule && (
            <section data-anno='apply:3' ref={scheduleRef} tabIndex={-1} className={`${cardClass('schedule')} outline-none`}>
              <Checkbox
                label={t({ ko: `${fixedSchedule} 참여 가능합니다`, en: `I can attend: ${fixedSchedule}` }, locale)}
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
              data-anno='apply:5'
              tabIndex={-1}
              ref={(el) => {
                questionRefs.current[q.id] = el;
              }}
              className={`${cardClass(q.id)} outline-none`}
            >
              <QuestionFillView
                q={q}
                value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                values={Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : []}
                onChange={(value) => {
                  clearInvalid(q.id);
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
              />
              <FieldHint field={q.id} />
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
