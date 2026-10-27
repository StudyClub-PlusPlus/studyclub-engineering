'use client';

import { useState } from 'react';

import { Button, Input, Modal } from '@studyclub/ui';

import { hasTime, type GroupTime, type ScheduleGroup } from './meetings';
import { DOW_LABEL, otherClock, STUDY_TZS, tzAbbr } from './time';

const CHIP = 'h-10 rounded-control border text-sm font-semibold transition-colors';
const chipTone = (on: boolean) =>
  on ? 'border-brand bg-brand text-white' : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2';

/**
 * 반의 스터디 시간(요일 · 시각 · 시간대) — 「스터디 시간 정하기」(처음) · 「스터디 시간 수정」(있을 때) (일정 탭 14-1).
 *
 * **회차를 만들지도 지우지도 않는다.** 회차는 일정 표의 「회차 추가」로만 만든다 — 그 창이 이 요일 · 시각으로
 * 매주 반복을 채워 연다. 기간 칸은 없다 — 반의 기간은 첫 회차 ~ 마지막 회차다.
 *
 * 연 쪽이 `key` 로 다시 그려 처음 값을 채운다 — 열 때마다 지금 값에서 시작한다.
 */
export function GroupTimeDialog({
  group,
  onClose,
  onSave,
}: {
  group: ScheduleGroup;
  onClose: () => void;
  onSave: (time: GroupTime) => void;
}) {
  const editing = hasTime(group);
  const [time, setTime] = useState<GroupTime>(() =>
    editing ? group.time : { weekdays: [], time: '', tz: group.time.tz },
  );
  const [touched, setTouched] = useState(false);

  const valid = time.weekdays.length > 0;
  const other = otherClock(time.weekdays, time.time, time.tz);

  function toggleDay(d: number) {
    const on = time.weekdays.includes(d);
    setTime({ ...time, weekdays: (on ? time.weekdays.filter((x) => x !== d) : [...time.weekdays, d]).sort() });
  }

  function save() {
    setTouched(true);
    if (valid) onSave(time);
  }

  return (
    <Modal
      open
      onClose={onClose}
      // 제목은 하는 일, 대상(반)은 제목 아래 작은 글씨 — 회차 추가 창과 같다 (POL-0008)
      title={editing ? '스터디 시간 수정' : '스터디 시간 정하기'}
      description={group.title}
      // 입력·설정 모달 — 취소 없이 X 로 닫는다 (POL-0008)
      footer={<Button onClick={save}>저장</Button>}
    >
      <div className='flex flex-col gap-4 py-2'>
        <div className='flex flex-col gap-2'>
          <span id='group-time-days' className='text-sm font-medium text-neutral-800'>
            스터디 요일
          </span>
          <div
            role='group'
            aria-labelledby='group-time-days'
            aria-describedby='group-time-msg'
            aria-invalid={(touched && !valid) || undefined}
            className='flex gap-1'
          >
            {DOW_LABEL.map((label, d) => (
              <button
                key={label}
                type='button'
                aria-pressed={time.weekdays.includes(d)}
                onClick={() => toggleDay(d)}
                className={`${CHIP} w-9 ${chipTone(time.weekdays.includes(d))}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className='flex flex-col gap-2'>
          <label htmlFor='group-time-clock' className='text-sm font-medium text-neutral-800'>
            스터디 시간
          </label>
          <div className='flex flex-wrap items-center gap-2'>
            <div className='w-48'>
              <Input
                size='sm'
                type='time'
                id='group-time-clock'
                value={time.time}
                onChange={(ev) => setTime({ ...time, time: ev.target.value })}
              />
            </div>
            {/* 선택지가 둘뿐이라 칩으로 나란히 둔다 — 펼쳐야 보이는 목록에 둘을 숨길 이유가 없다.
                시간대는 서버 반의 것으로 고정이다 — 회차를 그 시간대로 저장한다. TODO(api): 반 PATCH 가 timezone 을 받으면 연다 */}
            <div role='group' aria-label='시간대' className='flex gap-1'>
              {STUDY_TZS.map((tz) => (
                <button
                  key={tz.key}
                  type='button'
                  aria-pressed={time.tz === tz.key}
                  disabled={tz.key !== group.time.tz}
                  onClick={() => setTime({ ...time, tz: tz.key })}
                  className={`${CHIP} px-3 ${chipTone(time.tz === tz.key)} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {tz.label} <span className='opacity-70'>{tzAbbr(tz.key)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 반대편 시각을 같이 적는다 — 목 21:00 KST 는 미국에서 수요일이다 */}
        {other && (
          <p className='text-xs text-fg-muted'>
            {STUDY_TZS.find((t) => t.key !== time.tz)?.label} 기준 <b className='font-semibold'>{other}</b>
          </p>
        )}

        <p id='group-time-msg' role='status' className='text-xs'>
          {touched && !valid ? (
            <span className='font-medium text-error-600'>요일을 하나 이상 골라 주세요.</span>
          ) : (
            <span className='text-fg-muted'>
              스터디 시간만 {editing ? '바꿉니다. 이미 있는 회차는 그대로입니다' : '정합니다'}.
              <br />
              회차는 일정 표의 「회차 추가」로 만듭니다.
            </span>
          )}
        </p>
      </div>
    </Modal>
  );
}
