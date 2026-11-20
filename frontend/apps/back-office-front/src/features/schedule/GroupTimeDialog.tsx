'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Modal, Select, FilterChip, TimeSelect } from '@studyclub/ui';
import { useForm } from 'react-hook-form';

import { groupTimeSchema, type GroupTimeValues } from '@/features/schedule/form-schemas';
import { hasTime, type GroupTime, type ScheduleGroup } from '@/features/schedule/meetings';
import { DOW_LABEL, otherClock, STUDY_TZS, type StudyTz } from '@/features/schedule/time';

/**
 * 반의 스터디 시간(요일 · 시각 · 시간대) — 「스터디 시간 정하기」(처음) · 「스터디 시간 수정」(있을 때) (일정 탭 14-1).
 *
 * **회차를 만들지도 지우지도 않는다.** 회차는 일정 표의 「회차 추가」로만 만든다 — 그 창이 이 요일 · 시각으로
 * 매주 반복을 채워 연다. 기간 칸은 없다 — 반의 기간은 첫 회차 ~ 마지막 회차다.
 * 시각이나 시간대를 바꾸면 시작 전 회차도 옮길지 묻는다 — 옮기기는 서버가 같은 날짜의 새 시각으로 다시 계산한다.
 *
 * 연 쪽이 `key` 로 다시 그려 처음 값을 채운다 — 열 때마다 지금 값에서 시작한다.
 */
export function GroupTimeDialog({
  group,
  upcomingCount,
  onClose,
  onSave,
}: {
  group: ScheduleGroup;
  /** 아직 시작 안 한 회차 수 — 서버의 `started` 로 센다. */
  upcomingCount: number;
  onClose: () => void;
  onSave: (time: GroupTime, moveUpcomingMeetings: boolean) => void;
}) {
  const editing = hasTime(group);
  const [asking, setAsking] = useState<GroupTime | null>(null);
  const {
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitted: touched },
  } = useForm<GroupTimeValues>({
    resolver: zodResolver(groupTimeSchema),
    defaultValues: editing ? group.time : { weekdays: [], time: '', tz: group.time.tz },
  });
  const time = watch();
  const valid = !errors.weekdays;

  const other = otherClock(time.weekdays, time.time, time.tz);

  function toggleDay(d: number) {
    const on = time.weekdays.includes(d);
    setValue('weekdays', (on ? time.weekdays.filter((x) => x !== d) : [...time.weekdays, d]).sort(), {
      shouldDirty: true,
      shouldValidate: touched,
    });
  }

  const save = handleSubmit((next) => {
    const clockChanged = next.time !== group.time.time || next.tz !== group.time.tz;
    if (upcomingCount > 0 && clockChanged) setAsking(next);
    else onSave(next, false);
  });

  if (asking) {
    return (
      <Modal
        open
        onClose={onClose}
        title='회차도 옮길까요?'
        description={group.title}
        footer={
          <>
            <Button variant='secondary' onClick={() => onSave(asking, false)}>
              반 정보만 바꾸기
            </Button>
            <Button onClick={() => onSave(asking, true)}>옮기기</Button>
          </>
        }
      >
        <p className='py-2 type-body-sm text-fg'>
          아직 시작 안 한 회차 {upcomingCount}개도 새 시각으로 옮길까요?
          <br />
          <span className='text-fg-muted'>날짜는 그대로 두고 시각만 바뀝니다. 이미 시작한 회차는 그대로입니다.</span>
        </p>
      </Modal>
    );
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
          <span id='group-time-days' className='type-label-lg text-neutral-800'>
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
              <FilterChip
                key={label}
                selected={time.weekdays.includes(d)}
                selectMode='single'
                onClick={() => toggleDay(d)}
                className='w-9 justify-center px-0'
              >
                {label}
              </FilterChip>
            ))}
          </div>
        </div>

        <div className='flex flex-col gap-2'>
          <div className='w-48'>
            <TimeSelect
              size='sm'
              label='스터디 시간'
              value={time.time}
              onChange={(value) => setValue('time', value, { shouldDirty: true, shouldValidate: touched })}
            />
          </div>
          <div className='flex flex-col gap-2'>
            <Select
              size='sm'
              aria-label='시간대'
              value={time.tz}
              onChange={(ev) =>
                setValue('tz', ev.target.value as StudyTz, { shouldDirty: true, shouldValidate: touched })
              }
            >
              {STUDY_TZS.map((tz) => (
                <option key={tz.key} value={tz.key}>
                  {tz.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* 반대편 시각을 같이 적는다 — 목 21:00 KST 는 미국에서 수요일이다 */}
        {other && (
          <p className='type-label-sm text-fg-muted'>
            {time.tz === 'Asia/Seoul' ? '뉴욕' : '서울'} 기준 <b className='font-semibold'>{other}</b>
          </p>
        )}

        <p id='group-time-msg' role='status' className='type-label-sm'>
          {touched && !valid ? (
            <span className='font-semibold text-error-600'>요일을 하나 이상 골라 주세요.</span>
          ) : (
            <span className='text-fg-muted'>
              {editing ? '시각이나 시간대를 바꾸면 아직 시작 안 한 회차도 옮길지 묻습니다' : '스터디 시간만 정합니다'}.
              <br />
              회차는 일정 표의 「회차 추가」로 만듭니다.
            </span>
          )}
        </p>
      </div>
    </Modal>
  );
}
