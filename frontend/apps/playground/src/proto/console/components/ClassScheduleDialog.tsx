'use client';

import { useEffect, useState } from 'react';

import { classLabel, hasSchedule, type StudyClass } from '@console/lib/classes';
import {
  EMPTY_RULE,
  STUDY_TZS,
  WEEKDAY_LABELS,
  canBuildMeetings,
  otherClock,
  ruleDates,
  tzAbbr,
  wallToInstant,
  type ScheduleRule,
} from '@console/lib/schedule';
import { Button, Modal } from '@studyclub/ui';

/**
 * 반의 진행 일정 — 일정 탭에서 연다.
 *
 * 반은 신청자 탭에서 제목만으로 만들어진다. 요일·시각·기간은 여기서 정하고, 정하면 회차가 깔린다.
 * 깔린 회차의 제목은 비어 있다 — 일정 표에서 바로 채운다.
 * 이미 정한 일정을 바꾸면 **오늘 이후 회차만** 다시 깔린다. 찍힌 출석은 남는다.
 */
export function ClassScheduleDialog({
  open,
  cls,
  blocked = false,
  onClose,
  onSave,
}: {
  open: boolean;
  cls: StudyClass;
  /** 일정 표 · 규칙에 저장하지 않은 고침이 있다. 있으면 저장을 막는다. */
  blocked?: boolean;
  onClose: () => void;
  onSave: (rule: ScheduleRule) => void;
}) {
  const [rule, setRule] = useState<ScheduleRule>(EMPTY_RULE);
  const [touched, setTouched] = useState(false);
  // 이미 일정이 있는 반은 저장 전에 한 번 더 묻는다 — 오늘 이후 회차와 거기 적은 것이 지워진다
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRule(hasSchedule(cls) ? cls.rule : { ...EMPTY_RULE, tz: cls.rule.tz });
    setTouched(false);
    setConfirming(false);
  }, [open, cls]);

  const editing = hasSchedule(cls);

  const count = ruleDates(rule).length;
  const invalid = touched && !canBuildMeetings(rule);
  const at = rule.startDate ? wallToInstant(rule.startDate, rule.time, rule.tz) : new Date();
  const other = otherClock(rule);

  function toggleDay(d: number) {
    const on = rule.weekdays.includes(d);
    update({ ...rule, weekdays: (on ? rule.weekdays.filter((x) => x !== d) : [...rule.weekdays, d]).sort() });
  }

  /** 값을 바꾸면 확인을 다시 받는다 — 확인한 것과 저장할 것이 달라지면 안 된다. */
  function update(next: ScheduleRule) {
    setRule(next);
    setConfirming(false);
  }

  function save() {
    setTouched(true);
    if (blocked || !canBuildMeetings(rule)) return;
    if (editing && !confirming) {
      setConfirming(true);
      return;
    }
    onSave(rule);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${classLabel(cls)} 일정`}
      footer={
        /* 입력·설정 모달 — 취소 없이 X 로 닫는다 (POL-0008) */
        <Button onClick={save} disabled={blocked}>{!editing ? '회차 만들기' : confirming ? '지우고 다시 만들기' : '저장'}</Button>
      }
    >
      <div data-anno='schedule:14-1' className='flex flex-col gap-4 py-2'>
        <div className='flex flex-col gap-2'>
          <span className='text-sm font-medium text-neutral-800'>진행 일정</span>
          <div className='flex flex-wrap items-center gap-2'>
            <input
              type='date'
              aria-label='시작일'
              aria-describedby='rule-msg'
              aria-invalid={invalid || undefined}
              value={rule.startDate}
              onChange={(ev) => update({ ...rule, startDate: ev.target.value })}
              className='h-10 w-[9.5rem] rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none focus:border-brand focus:shadow-[var(--ring)]'
            />
            <span className='text-sm text-fg-muted'>~</span>
            <input
              type='date'
              aria-label='종료일'
              aria-describedby='rule-msg'
              aria-invalid={invalid || undefined}
              value={rule.endDate}
              onChange={(ev) => update({ ...rule, endDate: ev.target.value })}
              className='h-10 w-[9.5rem] rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none focus:border-brand focus:shadow-[var(--ring)]'
            />
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <div
              role='group'
              aria-label='요일'
              aria-describedby='rule-msg'
              aria-invalid={invalid || undefined}
              className='flex gap-1'
            >
              {WEEKDAY_LABELS.map((label, d) => {
                const on = rule.weekdays.includes(d);
                return (
                  <button
                    key={label}
                    type='button'
                    aria-pressed={on}
                    onClick={() => toggleDay(d)}
                    className={`h-9 w-9 rounded-control border text-sm font-semibold transition-colors ${
                      on
                        ? 'border-brand bg-brand text-white'
                        : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <input
              type='time'
              aria-label='시간'
              value={rule.time}
              onChange={(ev) => update({ ...rule, time: ev.target.value })}
              className='h-10 w-[7.5rem] rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none focus:border-brand focus:shadow-[var(--ring)]'
            />
            {/* 선택지가 둘뿐이라 칩으로 나란히 둔다 — 펼쳐야 보이는 목록에 둘을 숨길 이유가 없다 */}
            <div role='group' aria-label='시간대' className='flex gap-1'>
              {STUDY_TZS.map((tz) => {
                const on = rule.tz === tz.key;
                return (
                  <button
                    key={tz.key}
                    type='button'
                    aria-pressed={on}
                    onClick={() => update({ ...rule, tz: tz.key })}
                    className={`h-10 rounded-control border px-3 text-sm font-semibold transition-colors ${
                      on
                        ? 'border-brand bg-brand text-white'
                        : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2'
                    }`}
                  >
                    {tz.label} <span className='opacity-70'>{tzAbbr(tz.key, at)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 반대편 시각을 같이 적는다 — 목 21:00 KST 는 미국에서 수요일이다 */}
          {other ? (
            <p className='text-xs text-fg-muted'>
              {STUDY_TZS.find((t) => t.key !== rule.tz)?.label} 기준 <b className='font-semibold'>{other}</b>
            </p>
          ) : null}

          <p id='rule-msg' role='status' className='text-xs'>
            {blocked ? (
              <span className='font-medium text-error-600'>
                일정 표나 스터디 규칙에 저장하지 않은 고침이 있습니다. 먼저 저장하거나 취소한 뒤 일정을 바꿔 주세요.
              </span>
            ) : confirming ? (
              <span className='font-medium text-error-600'>
                오늘 이후 회차를 지우고 새 일정으로 다시 만듭니다. 그 회차에 적은 제목 · 발표자와 휴가 신청도 함께
                지워집니다. 지난 회차와 출석은 남습니다.
              </span>
            ) : count > 0 ? (
              <span className='text-fg-secondary'>
                {editing ? '오늘 이후 회차가 다시 만들어집니다 — ' : ''}회차 <b className='tnum'>{count}</b>회 · 제목은
                일정 표에서 채웁니다.
              </span>
            ) : touched ? (
              <span className='font-medium text-error-600'>시작일 · 종료일 · 요일을 모두 정해야 합니다.</span>
            ) : (
              <span className='text-fg-muted'>시작일 · 종료일 · 요일을 정하면 회차가 만들어집니다.</span>
            )}
          </p>
        </div>
      </div>
    </Modal>
  );
}
