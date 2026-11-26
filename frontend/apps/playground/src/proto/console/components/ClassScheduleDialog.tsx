'use client';

import { useEffect, useState } from 'react';

import { classLabel, hasSchedule, type StudyClass } from '@console/lib/classes';
import { EMPTY_RULE, WEEKDAY_LABELS, otherClock, type ScheduleRule } from '@console/lib/schedule';
import { TimeZoneField } from '@core/components/TimeZoneField';
import { isValidZone, scheduleZoneTitle } from '@core/lib/schedule-timezone';
import { useDisplayTimeZone, useTimeZoneChangeLock } from '@core/lib/use-display-timezone';
import { Button, Modal, FilterChip, TimePicker } from '@studyclub/ui';

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
  const viewerZone = useDisplayTimeZone();
  useTimeZoneChangeLock(open);

  const valid = rule.weekdays.length > 0 && isValidZone(rule.tz);
  const invalid = touched && !valid;
  const other = otherClock(rule, viewerZone);

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
            <span id='rule-days' className='type-label-lg text-neutral-800'>
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
                  <FilterChip key={label} selected={on} selectMode='single' onClick={() => toggleDay(d)} className='w-9 justify-center px-0'>
                    {label}
                  </FilterChip>
                );
              })}
            </div>
          </div>

          <div className='flex flex-col gap-2'>
            <label htmlFor='rule-time' className='type-label-lg text-neutral-800'>
              스터디 시간
            </label>
            <div className='flex flex-wrap items-center gap-2'>
              <div className='w-48'>
                <TimePicker
                  id='rule-time'
                  value={rule.time}
                  onChange={(value) => setRule({ ...rule, time: value })}
                />
              </div>
              <div className='min-w-48 flex-1'>
                <TimeZoneField
                  prioritizeCountries
                  locale='ko' label='기준 시간대' hideLabel compact annotation={false}
                  value={rule.tz} onChange={(tz) => setRule({ ...rule, tz })}
                />
              </div>
            </div>
          </div>

          {other && (
            <p className='type-label-sm text-fg-muted' aria-live='polite'>
              {scheduleZoneTitle(viewerZone)} 기준 · {other}
            </p>
          )}

          <p id='rule-msg' role='status' className='type-label-sm'>
            {touched && !valid ? (
              <span className='font-semibold text-error-600'>요일을 하나 이상 골라 주세요.</span>
            ) : (
              <span className='text-fg-muted'>
                스터디 시간만 {editing ? '바꿉니다. 이미 있는 회차는 그대로입니다' : '정합니다'}.
                <br />
                회차는 일정 표의 「회차 추가」로 만듭니다.
              </span>
            )}
          </p>
        </div>
      </div>
    </Modal>
  );
}
