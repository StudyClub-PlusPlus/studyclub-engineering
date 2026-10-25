'use client';

import { useState } from 'react';

import { Button, Input, Modal } from '@studyclub/ui';

import { DEFAULT_TIME, isKickoff, validateKickoff, type Meeting, type ScheduleGroup } from './meetings';
import { addDaysYmd, dayLabel, wallParts, zoneLabel, zoneTitle } from './time';

/**
 * 「킥오프 정하기」(없을 때) · 「킥오프 수정」(있을 때) — 반의 0회차를 캡틴이 정한다 (spec 결정 11, share 10-22).
 * 사용자 사이트에서는 네비게이터도 캡틴도 고치지 않는다. 일정 표에서도 킥오프 줄은 고치지 않는다.
 *
 * 처음 값은 지금 킥오프, 없으면 1회차 한 주 전(1회차도 없으면 오늘) · 반의 스터디 시각 — 프로토 10-1 과 같다.
 * 지난 날도 받는다 — 운영 중인 반의 킥오프를 나중에 적는다.
 */
export function KickoffDialog({
  group,
  existing,
  onCancel,
  onSave,
}: {
  group: ScheduleGroup;
  existing: Meeting[];
  onCancel: () => void;
  onSave: (input: { date: string; time: string }, label: string) => void;
}) {
  const tz = group.time.tz;
  const current = existing.find(isKickoff);
  const firstRegular = existing
    .filter((m) => !isKickoff(m))
    .map((m) => m.date)
    .sort()[0];
  const [date, setDate] = useState(
    () => current?.date ?? (firstRegular ? addDaysYmd(firstRegular, -7) : wallParts(new Date(), tz).date),
  );
  const [time, setTime] = useState(() => current?.time ?? (group.time.time || DEFAULT_TIME));
  const [touched, setTouched] = useState(false);

  const errors = validateKickoff({ date, time }, existing);
  const shown = touched ? errors : {};

  function submit() {
    setTouched(true);
    if (errors.date || errors.time) return;
    onSave({ date, time }, `${dayLabel(date)} ${time}`);
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={current ? '킥오프 수정' : '킥오프 정하기'}
      description={`${group.title} · ${zoneTitle(tz)} 기준`}
      footer={
        <>
          <Button variant='secondary' onClick={onCancel}>
            취소
          </Button>
          <Button onClick={submit}>저장</Button>
        </>
      }
    >
      <div className='flex flex-col gap-4 py-2'>
        <p className='text-sm text-fg-secondary'>
          규칙·일정·발표자를 정하는 첫 모임입니다. 네비게이터는 이 날을 고칠 수 없습니다.
        </p>
        {/* Input 은 칸 너비를 꽉 채운다(w-full) — 두 칸이 창 너비를 반씩 나눈다 */}
        <div className='grid gap-3 sm:grid-cols-2'>
          <Input
            type='date'
            label='일자'
            required
            value={date}
            error={shown.date}
            onChange={(ev) => setDate(ev.target.value)}
          />
          <Input
            type='time'
            label={`시작 시각 (${zoneLabel(tz)})`}
            required
            value={time}
            error={shown.time}
            onChange={(ev) => setTime(ev.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}
