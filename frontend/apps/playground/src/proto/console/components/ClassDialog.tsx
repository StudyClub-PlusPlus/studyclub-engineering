'use client';

import { useEffect, useState } from 'react';

import { AVAIL_DAYS, AVAIL_SLOTS, classLabel, ruleFromCell, type StudyClass } from '@console/lib/classes';
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
import type { Crew } from '@studyclub/mock';
import { Button, Modal } from '@studyclub/ui';

/**
 * 반 만들기.
 *
 * 가능한 시간 표의 칸에서 열면 그 요일·시각이 채워진 채로 시작한다 — 방금 고른 칸을 다시 입력하게
 * 하지 않는다. 「반 추가」로 열면 빈 칸에서 시작한다.
 *
 * 구간(시작일·종료일)은 여기서 받는다. 회차를 만들려면 요일만으로는 부족하다.
 */
export function ClassDialog({
  open,
  cell,
  candidates,
  edit,
  onClose,
  onCreate,
}: {
  open: boolean;
  cell?: string;
  candidates: Crew[];
  /** 있으면 그 반을 고치는 모드. 일정은 나중에 바뀐다 — 크루가 더 들어오거나 시간이 안 맞아서다. */
  edit?: StudyClass;
  onClose: () => void;
  onCreate: (cls: StudyClass) => void;
}) {
  const [rule, setRule] = useState<ScheduleRule>(EMPTY_RULE);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRule(edit ? edit.rule : cell ? ruleFromCell(cell, 'Asia/Seoul') : EMPTY_RULE);
    setTouched(false);
  }, [open, cell, edit]);

  const count = ruleDates(rule).length;
  const at = rule.startDate ? wallToInstant(rule.startDate, rule.time, rule.tz) : new Date();
  const other = otherClock(rule);

  function toggleDay(d: number) {
    const on = rule.weekdays.includes(d);
    setRule({ ...rule, weekdays: (on ? rule.weekdays.filter((x) => x !== d) : [...rule.weekdays, d]).sort() });
  }

  function create() {
    setTouched(true);
    if (!canBuildMeetings(rule)) return;
    onCreate({ id: edit ? edit.id : `c${Date.now()}`, rule });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={edit ? '반 수정' : '반 만들기'}
      footer={
        <>
          <Button variant='secondary' onClick={onClose}>
            취소
          </Button>
          <Button onClick={create}>{edit ? '저장' : '만들기'}</Button>
        </>
      }
    >
      <div data-anno='class:1-2' className='flex flex-col gap-4 py-2'>
        {cell ? (
          <p className='text-sm text-fg-muted'>
            {cellLabel(cell)} 가능한 사람 <b className='tnum font-bold text-fg'>{candidates.length}</b>명 —{' '}
            {candidates
              .slice(0, 6)
              .map((c) => c.name)
              .join(' · ')}
            {candidates.length > 6 ? ` 외 ${candidates.length - 6}명` : ''}
          </p>
        ) : null}

        <div className='flex flex-col gap-2'>
          <span className='text-sm font-medium text-neutral-800'>진행 일정</span>
          <div className='flex flex-wrap items-center gap-2'>
            <input
              type='date'
              aria-label='시작일'
              value={rule.startDate}
              onChange={(ev) => setRule({ ...rule, startDate: ev.target.value })}
              className='h-10 w-[9.5rem] rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none focus:border-brand focus:shadow-[var(--ring)]'
            />
            <span className='text-sm text-fg-muted'>~</span>
            <input
              type='date'
              aria-label='종료일'
              value={rule.endDate}
              onChange={(ev) => setRule({ ...rule, endDate: ev.target.value })}
              className='h-10 w-[9.5rem] rounded-control border border-border-strong bg-bg px-3 text-sm text-neutral-900 outline-none focus:border-brand focus:shadow-[var(--ring)]'
            />
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <div className='flex gap-1'>
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

          {/* 이름을 받지 않으므로 무엇으로 불리게 될지 먼저 보여 준다 */}
          {rule.weekdays.length > 0 && rule.time ? (
            <p className='text-xs text-fg-secondary'>
              반 이름 <b className='font-bold text-fg'>{classLabel({ rule })}</b>
            </p>
          ) : null}

          <p className='text-xs'>
            {count > 0 ? (
              <span className='text-fg-secondary'>
                회차 <b className='tnum'>{count}</b>회가 만들어집니다.
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

function cellLabel(cell: string): string {
  const [dayKey, slotKey] = cell.split('-');
  const day = AVAIL_DAYS.find((d) => d.key === dayKey)?.label ?? '';
  const slot = AVAIL_SLOTS.find((s) => s.key === slotKey)?.label ?? '';
  return `${day} ${slot}`;
}
