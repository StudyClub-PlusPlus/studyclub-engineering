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
 * 두 가지로 열린다.
 * - **일정 정하기**(일정 없는 반): 요일·시각·기간을 정하면 회차가 깔린다. 깔린 회차의 제목은 비어 있다 — 일정 표에서 채운다.
 * - **스터디 시간 수정**(일정 있는 반): 요일·시각·시간대만 바꾼다. **회차를 더하거나 다시 깔지 않는다** —
 *   회차를 더하고 옮기는 일은 일정 표 하나에서만 한다. 두 곳에서 회차가 생기면 어디서 생긴 것인지 헷갈린다.
 */
export function ClassScheduleDialog({
  open,
  cls,
  onClose,
  onSave,
}: {
  open: boolean;
  cls: StudyClass;
  onClose: () => void;
  onSave: (rule: ScheduleRule) => void;
}) {
  const [rule, setRule] = useState<ScheduleRule>(EMPTY_RULE);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRule(hasSchedule(cls) ? cls.rule : { ...EMPTY_RULE, tz: cls.rule.tz });
    setTouched(false);
  }, [open, cls]);

  const editing = hasSchedule(cls);

  const count = ruleDates(rule).length;
  // 수정은 기간을 받지 않으므로 요일만 있으면 된다
  const valid = editing ? rule.weekdays.length > 0 : canBuildMeetings(rule);
  const invalid = touched && !valid;
  const at = rule.startDate ? wallToInstant(rule.startDate, rule.time, rule.tz) : new Date();
  const other = otherClock(rule);

  function toggleDay(d: number) {
    const on = rule.weekdays.includes(d);
    setRule({ ...rule, weekdays: (on ? rule.weekdays.filter((x) => x !== d) : [...rule.weekdays, d]).sort() });
  }

  function save() {
    setTouched(true);
    if (!valid) return;
    onSave(rule);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `${classLabel(cls)} 스터디 시간 수정` : `${classLabel(cls)} 일정 정하기`}
      footer={
        /* 입력·설정 모달 — 취소 없이 X 로 닫는다 (POL-0008) */
        <Button onClick={save}>{editing ? '저장' : '회차 만들기'}</Button>
      }
    >
      <div data-anno='schedule:14-1' className='flex flex-col gap-4 py-2'>
        <div className='flex flex-col gap-2'>
          <span className='text-sm font-medium text-neutral-800'>{editing ? '스터디 시간' : '진행 일정'}</span>
          {/* 기간은 회차를 깔 때만 받는다 — 수정에서는 회차를 건드리지 않는다 */}
          {!editing && (
            <div className='flex flex-wrap items-center gap-2'>
              <input
                type='date'
                aria-label='시작일'
                aria-describedby='rule-msg'
                aria-invalid={invalid || undefined}
                value={rule.startDate}
                onChange={(ev) => setRule({ ...rule, startDate: ev.target.value })}
                className='h-10 w-[9.5rem] rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none focus:border-brand focus:shadow-[var(--ring)]'
              />
              <span className='text-sm text-fg-muted'>~</span>
              <input
                type='date'
                aria-label='종료일'
                aria-describedby='rule-msg'
                aria-invalid={invalid || undefined}
                value={rule.endDate}
                onChange={(ev) => setRule({ ...rule, endDate: ev.target.value })}
                className='h-10 w-[9.5rem] rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none focus:border-brand focus:shadow-[var(--ring)]'
              />
            </div>
          )}

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
              onChange={(ev) => setRule({ ...rule, time: ev.target.value })}
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
                    onClick={() => setRule({ ...rule, tz: tz.key })}
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
            {editing ? (
              touched && !valid ? (
                <span className='font-medium text-error-600'>요일을 하나 이상 골라 주세요.</span>
              ) : (
                <span className='text-fg-muted'>
                  스터디 시간만 바꿉니다. 회차는 그대로입니다 — 회차를 더하거나 옮기려면 일정 표에서 고칩니다.
                </span>
              )
            ) : count > 0 ? (
              <span className='text-fg-secondary'>
                회차 <b className='tnum'>{count}</b>회 · 제목은 일정 표에서 채웁니다.
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
