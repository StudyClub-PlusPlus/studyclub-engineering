'use client';

import { useState } from 'react';

import { Button, Input, Modal, cx } from '@studyclub/ui';

import {
  DEFAULT_TIME,
  defaultDate,
  defaultUntil,
  isKickoff,
  maxUntil,
  planDraft,
  previewOf,
  REPEAT_SPAN_DAYS,
  TITLE_MAX,
  type DraftErrors,
  type Meeting,
  type MeetingDraft,
  type Repeat,
  type ScheduleGroup,
} from './meetings';
import {
  addDaysYmd,
  dayLabel,
  DOW_LABEL,
  dowOf,
  scheduleLabel,
  wallParts,
  zonedInstant,
  zoneLabel,
  zoneTitle,
} from './time';

const REPEAT_OPTIONS: { key: Repeat; label: string }[] = [
  { key: 'none', label: '반복 안 함' },
  { key: 'daily', label: '매일' },
  { key: 'weekly', label: '매주' },
];

/** 월요일부터 — 주간 일정과 같은 순서. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const CHIP = 'h-9 rounded-control border text-sm font-semibold transition-colors';
const chipTone = (on: boolean) =>
  on ? 'border-brand bg-brand text-white' : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2';

/**
 * 회차 추가 창 — 한 번 또는 매일 · 매주 반복 (PRD §7). 회차를 만드는 곳은 여기 하나다.
 * 시각은 반 시간대의 벽시계로 받는다. 저장은 UTC.
 */
export function AddMeetingDialog({
  group,
  existing,
  onCancel,
  onAdd,
}: {
  group: ScheduleGroup;
  existing: Meeting[];
  onCancel: () => void;
  onAdd: (input: { dates: string[]; time: string; title: string }, label: string) => void;
}) {
  const tz = group.time.tz;
  const [draft, setDraft] = useState<MeetingDraft>(() => initialDraft(group, existing));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [touched, setTouched] = useState(false);

  const { errors: live, plan } = planDraft(draft, existing, tz);

  function change(patch: Partial<MeetingDraft>) {
    const next = { ...draft, ...patch };
    if (patch.repeat && patch.repeat !== 'none' && !next.until) next.until = defaultUntil(next.date, patch.repeat);
    // 매주를 처음 고르면 시작 일자의 요일을 켜 둔다 — 빈 채로 두면 무엇을 눌러야 할지 모른다
    if (patch.repeat === 'weekly' && next.weekdays.length === 0 && next.date) next.weekdays = [dowOf(next.date)];
    setDraft(next);
    // 한 번 막힌 뒤에는 고치는 즉시 문구가 풀려야 한다
    if (touched) setErrors(planDraft(next, existing, tz).errors);
  }

  function toggleWeekday(d: number) {
    const on = draft.weekdays.includes(d);
    change({ weekdays: on ? draft.weekdays.filter((x) => x !== d) : [...draft.weekdays, d].sort() });
  }

  function submit() {
    setTouched(true);
    setErrors(live);
    if (!plan) return;
    const { from } = previewOf(plan, existing);
    const first = plan.dates[0];
    const last = plan.dates[plan.dates.length - 1];
    onAdd(
      { dates: plan.dates, time: draft.time, title: draft.title },
      plan.dates.length === 1
        ? `${from}회차 · ${dayLabel(first)} ${draft.time}`
        : `회차 ${plan.dates.length}개 · ${dayLabel(first)} ~ ${dayLabel(last)} ${draft.time}`,
    );
  }

  const preview = plan ? previewOf(plan, existing) : undefined;
  const first = plan?.dates[0];

  return (
    <Modal
      open
      onClose={onCancel}
      title='회차 추가'
      description={`${group.title} · ${zoneTitle(tz)} 기준`}
      footer={
        <>
          <Button variant='secondary' onClick={onCancel}>
            취소
          </Button>
          <Button onClick={submit}>
            {plan && plan.dates.length > 1 ? `회차 ${plan.dates.length}개 추가` : '추가'}
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-4 py-2'>
        <div className='grid gap-3 sm:grid-cols-2'>
          <Input
            type='date'
            label={draft.repeat === 'none' ? '일자' : '시작 일자'}
            required
            value={draft.date}
            error={errors.date}
            onChange={(ev) => change({ date: ev.target.value })}
          />
          <Input
            type='time'
            label={`시작 시각 (${zoneLabel(tz)})`}
            required
            value={draft.time}
            error={errors.time}
            onChange={(ev) => change({ time: ev.target.value })}
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <span className='text-sm font-medium text-neutral-800'>반복</span>
          <div role='group' aria-label='반복' className='flex flex-wrap gap-1.5'>
            {REPEAT_OPTIONS.map((o) => (
              <button
                key={o.key}
                type='button'
                aria-pressed={draft.repeat === o.key}
                onClick={() => change({ repeat: o.key })}
                className={cx(CHIP, 'px-3', chipTone(draft.repeat === o.key))}
              >
                {o.label}
              </button>
            ))}
          </div>
          {draft.repeat === 'weekly' && (
            <div className='mt-1 flex flex-col gap-1'>
              <div role='group' aria-label='반복 요일' className='flex flex-wrap gap-1'>
                {WEEK_ORDER.map((d) => (
                  <button
                    key={d}
                    type='button'
                    aria-pressed={draft.weekdays.includes(d)}
                    aria-label={`${DOW_LABEL[d]}요일`}
                    onClick={() => toggleWeekday(d)}
                    className={cx(CHIP, 'w-9', chipTone(draft.weekdays.includes(d)))}
                  >
                    {DOW_LABEL[d]}
                  </button>
                ))}
              </div>
              {errors.weekdays && <p className='text-xs text-error-700'>{errors.weekdays}</p>}
            </div>
          )}
        </div>

        {draft.repeat !== 'none' && (
          <div className='sm:max-w-[18rem]'>
            <Input
              type='date'
              label='종료일'
              labelHint={`이 날까지 · 시작부터 최대 ${REPEAT_SPAN_DAYS}일`}
              required
              min={draft.date}
              max={maxUntil(draft.date)}
              value={draft.until}
              error={errors.until}
              onChange={(ev) => change({ until: ev.target.value })}
            />
          </div>
        )}

        <Input
          label='제목'
          labelHint={`선택 · ${draft.title.trim().length}/${TITLE_MAX}`}
          placeholder={draft.repeat === 'none' ? '예: 3장 저장소와 검색' : '반복하면 모든 회차에 같은 제목이 붙습니다'}
          value={draft.title}
          error={errors.title}
          onChange={(ev) => change({ title: ev.target.value })}
        />

        <div className='rounded-control border border-border px-3.5 py-2.5 text-sm'>
          {plan && preview && first ? (
            <>
              <p className='font-bold text-fg'>
                {plan.dates.length === 1 ? (
                  <>
                    <span className='tnum'>{preview.from}</span>회차로 추가됩니다
                  </>
                ) : (
                  <>
                    회차 <span className='tnum'>{plan.dates.length}</span>개 ·{' '}
                    <span className='tnum'>
                      {preview.from}~{preview.to}
                    </span>
                    회차로 추가됩니다
                  </>
                )}
              </p>
              <ul className='mt-1 flex flex-col gap-0.5 text-xs text-fg-secondary'>
                {plan.dates.length > 1 && (
                  <li className='tnum'>
                    {dayLabel(first)} ~ {dayLabel(plan.dates[plan.dates.length - 1])}
                  </li>
                )}
                <li className='tnum'>
                  {plan.dates.length > 1 ? '첫 회차 ' : ''}KST{' '}
                  {scheduleLabel(zonedInstant(first, draft.time, tz), 'Asia/Seoul')} · PDT{' '}
                  {scheduleLabel(zonedInstant(first, draft.time, tz), 'America/Los_Angeles')}
                </li>
                {plan.skipped.length > 0 && (
                  <li className='text-warning-700'>
                    건너뜀 <b className='tnum'>{plan.skipped.length}</b>개:{' '}
                    {plan.skipped.map((s) => `${dayLabel(s.date)} ${s.reason}`).join(', ')}
                  </li>
                )}
                {preview.shifted > 0 && (
                  <li>
                    기존 회차 <b className='tnum'>{preview.shifted}</b>개의 번호가 뒤로 밀립니다.
                  </li>
                )}
                {preview.extendsTo && <li>마지막 회차 뒤라 스터디 기간이 {preview.extendsTo}까지 늘어납니다.</li>}
              </ul>
            </>
          ) : touched && errors.form ? (
            <p className='font-medium text-error-700'>{errors.form}</p>
          ) : (
            <p className='text-fg-muted'>
              일자와 시작 시각을 정하면 몇 회차가 되는지 보여 드립니다. 반복은 시작부터 {REPEAT_SPAN_DAYS}일까지.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}

/**
 * 처음 값. 회차가 하나도 없는 반은 반의 스터디 요일 매주 반복 · 스터디 시각 · 다음 그 요일부터 4주로 채운다 (일정 탭 14-2).
 * 아니면 한 번, 마지막 회차의 다음 주 같은 요일.
 */
function initialDraft(group: ScheduleGroup, existing: Meeting[]): MeetingDraft {
  const today = wallParts(new Date(), group.time.tz).date;
  const time = group.time.time || DEFAULT_TIME;
  const days = group.time.weekdays;
  if (existing.filter((m) => !isKickoff(m)).length === 0 && days.length > 0) {
    let date = addDaysYmd(today, 1);
    while (!days.includes(dowOf(date))) date = addDaysYmd(date, 1);
    return { date, time, title: '', repeat: 'weekly', until: defaultUntil(date, 'weekly'), weekdays: days };
  }
  return { date: defaultDate(existing, today), time, title: '', repeat: 'none', until: '', weekdays: [] };
}
