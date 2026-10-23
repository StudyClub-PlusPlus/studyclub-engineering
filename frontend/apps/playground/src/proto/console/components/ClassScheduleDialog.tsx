'use client';

import { useEffect, useState } from 'react';

import { classLabel, hasSchedule, type StudyClass } from '@console/lib/classes';
import { EMPTY_RULE, STUDY_TZS, WEEKDAY_LABELS, otherClock, tzAbbr, type ScheduleRule } from '@console/lib/schedule';
import { Button, Input, Modal } from '@studyclub/ui';

/**
 * 반의 스터디 시간(요일 · 시각 · 시간대) — 일정 탭에서 연다.
 *
 * - **스터디 시간 정하기**(아직 없는 반) · **스터디 시간 수정**(있는 반) 둘 다 같은 칸이다.
 * - **회차를 만들지도 지우지도 않는다.** 회차는 일정 표의 「회차 추가」로만 만든다 — 그 창이 이 요일 · 시각으로
 *   매주 반복을 채워 연다. 기간도 받지 않는다 — 반의 기간은 첫 회차 ~ 마지막 회차로 계산한다.
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

  const valid = rule.weekdays.length > 0;
  const invalid = touched && !valid;
  // 시간대 칩의 KST/PDT 표기는 오늘 기준 — 기간을 받지 않으니 기준일이 없다
  const at = new Date();
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
      // 제목은 하는 일, 대상(반)은 제목 아래 작은 글씨 — 회차 추가 창과 같다 (POL-0008)
      title={editing ? '스터디 시간 수정' : '스터디 시간 정하기'}
      description={classLabel(cls)}
      footer={
        /* 입력·설정 모달 — 취소 없이 X 로 닫는다 (POL-0008) */
        <Button onClick={save}>저장</Button>
      }
    >
      <div data-anno='schedule:14-1' className='flex flex-col gap-4 py-2'>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col gap-2'>
            <span id='rule-days' className='text-sm font-medium text-neutral-800'>
              스터디 요일
            </span>
            <div
              role='group'
              aria-labelledby='rule-days'
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
          </div>

          <div className='flex flex-col gap-2'>
            <label htmlFor='rule-time' className='text-sm font-medium text-neutral-800'>
              스터디 시간
            </label>
            <div className='flex flex-wrap items-center gap-2'>
              <div className='w-40'>
                <Input
                  size='sm'
                  type='time'
                  id='rule-time'
                  value={rule.time}
                  onChange={(ev) => setRule({ ...rule, time: ev.target.value })}
                />
              </div>
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
          </div>

          {/* 반대편 시각을 같이 적는다 — 목 21:00 KST 는 미국에서 수요일이다 */}
          {other ? (
            <p className='text-xs text-fg-muted'>
              {STUDY_TZS.find((t) => t.key !== rule.tz)?.label} 기준 <b className='font-semibold'>{other}</b>
            </p>
          ) : null}

          <p id='rule-msg' role='status' className='text-xs'>
            {touched && !valid ? (
              <span className='font-medium text-error-600'>요일을 하나 이상 골라 주세요.</span>
            ) : (
              <span className='text-fg-muted'>
                스터디 시간만 {editing ? '바꿉니다. 이미 있는 회차는 그대로입니다' : '정합니다'}. 회차는 일정 표의
                「회차 추가」로 만듭니다.
              </span>
            )}
          </p>
        </div>
      </div>
    </Modal>
  );
}
