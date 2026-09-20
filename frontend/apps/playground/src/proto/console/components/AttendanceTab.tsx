'use client';

import { useEffect, useState } from 'react';

import { classLabel, classPeriod, type StudyClass } from '@console/lib/classes';
import { tzAbbr, wallToInstant } from '@console/lib/schedule';
import { attendanceRate, type AttendanceStatus, type Crew, type Study, type StudyMeeting } from '@studyclub/mock';
import { Button } from '@studyclub/ui';
import { CalendarPlus, Plus } from 'lucide-react';

/**
 * 출석 탭 — 크루 × 회차 격자.
 *
 * 지금까지 구글시트로 하던 일이라 **시트와 같은 모양**을 유지한다. 화면은 이 격자 하나뿐 —
 * 회차별 화면을 따로 두면 같은 일을 두 곳에서 하게 되고, 한 사람이 몇 번 빠졌는지 보려면
 * 회차를 하나씩 열어야 한다.
 *
 * 칸을 눌러도 저장하지 않는다. 여러 칸을 고친 뒤 **저장**을 눌러 한 번에 반영한다.
 * 출석률은 칸을 바꿀 때 화면에서 다시 계산한다 — 저장 전 미리보기다.
 * 분모는 **체크된 회차만** — 아직 열리지 않은 회차 때문에 출석률이 낮아 보이면 안 된다.
 */

type AttendanceBook = Record<string, Record<string, AttendanceStatus>>;

const CELL_STYLE: Record<AttendanceStatus, string> = {
  present: 'border-transparent bg-success-100 text-success-700',
  late: 'border-transparent bg-warning-100 text-warning-700',
  absent: 'border-transparent bg-error-50 text-error-700',
  excused: 'border-transparent bg-surface-2 text-fg-secondary',
};

const CELL_LABEL: Record<AttendanceStatus, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  excused: '휴가',
};

function cloneBook(book: AttendanceBook): AttendanceBook {
  return Object.fromEntries(Object.entries(book).map(([id, row]) => [id, { ...row }]));
}

/** 미체크 → 출석 → 지각 → 결석 → 휴가 → 미체크. 잘못 누른 것을 되돌릴 수 있어야 한다. */
function nextStatus(cur: AttendanceStatus | undefined): AttendanceStatus | undefined {
  if (cur === undefined) return 'present';
  if (cur === 'present') return 'late';
  if (cur === 'late') return 'absent';
  if (cur === 'absent') return 'excused';
  return undefined;
}

function cellOf(book: AttendanceBook, crewId: string, meetingId: string): AttendanceStatus | undefined {
  return book[crewId]?.[meetingId];
}

function changedCount(a: AttendanceBook, b: AttendanceBook): number {
  let n = 0;
  const crewIds = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of crewIds) {
    const left = a[id] ?? {};
    const right = b[id] ?? {};
    const meetings = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const meetingId of meetings) {
      if (left[meetingId] !== right[meetingId]) n += 1;
    }
  }
  return n;
}

function Cell({
  status,
  changed,
  onClick,
  disabled,
}: {
  status: AttendanceStatus | undefined;
  changed?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const label = status ? CELL_LABEL[status] : '미체크';
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled}
      aria-label={changed ? `${label} · 저장되지 않음` : label}
      title={
        changed
          ? '저장되지 않음 — 눌러서 출석 → 지각 → 결석 → 휴가 → 미체크'
          : '눌러서 출석 → 지각 → 결석 → 휴가 → 미체크'
      }
      className={`relative h-8 w-full rounded-sm border text-[11px] font-bold transition-colors ${
        status ? CELL_STYLE[status] : 'border-dashed border-border-strong bg-surface text-fg-muted hover:bg-surface-2'
      } ${changed ? 'border-solid border-brand ring-2 ring-brand/80' : ''}`}
    >
      {status ? CELL_LABEL[status] : ''}
      {changed && (
        <span className='absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-brand ring-2 ring-bg' aria-hidden />
      )}
    </button>
  );
}

export function AttendanceTab({
  crew,
  meetings,
  attendance,
  classes,
  classId,
  onClass,
  onSave,
  onGoCrew,
  onDirtyChange,
}: {
  study: Study;
  crew: Crew[];
  meetings: StudyMeeting[];
  attendance: AttendanceBook;
  classes: StudyClass[];
  classId: string;
  onClass: (id: string) => void;
  onSave: (next: AttendanceBook) => Promise<void>;
  onGoCrew: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => cloneBook(attendance));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(cloneBook(attendance));
  }, [attendance]);

  const pending = changedCount(draft, attendance);
  const dirty = pending > 0;

  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  function toggle(crewId: string, meetingId: string) {
    if (saving) return;
    setDraft((book) => {
      const row = { ...(book[crewId] ?? {}) };
      const next = nextStatus(row[meetingId]);
      if (next === undefined) delete row[meetingId];
      else row[meetingId] = next;
      return { ...book, [crewId]: row };
    });
    setSaved(false);
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    await onSave(cloneBook(draft));
    setSaving(false);
    setSaved(true);
  }

  function revert() {
    if (saving) return;
    setDraft(cloneBook(attendance));
    setSaved(false);
  }

  const cls = classes.find((c) => c.id === classId);
  const rule = cls?.rule;
  // 회차가 없다는 건 아직 반이 없거나 그 반의 일정이 비었다는 뜻이다. 그 사실과 갈 곳을 같이 말한다 —
  // 「아직 회차가 없습니다」만 두면 운영자는 여기서 무엇을 눌러야 하는지 알 수 없다.
  if (!cls || meetings.length === 0 || !rule) {
    return (
      <div data-anno='attendance:5' className='card px-6 py-10 text-center'>
        <p className='text-sm font-semibold text-fg'>아직 반이 없습니다.</p>
        <p className='mt-1.5 text-sm text-fg-muted'>
          크루 탭에서 가능한 시간을 보고 반을 만들면 그 반의 출석부가 만들어집니다.
        </p>
        <Button size='sm' className='mt-4' leadingIcon={<CalendarPlus size={15} />} onClick={onGoCrew}>
          반 만들기
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* 반이 하나면 고를 것이 없다. 탭줄을 늘 띄우면 없는 선택을 있는 것처럼 보이게 한다 */}
      {classes.length > 1 && (
        <nav data-anno='attendance:0' className='mb-4 flex flex-wrap gap-1.5'>
          {classes.map((c) => (
            <button
              key={c.id}
              type='button'
              onClick={() => onClass(c.id)}
              className={`rounded-pill border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                c.id === classId
                  ? 'border-brand bg-brand text-white'
                  : 'border-border-strong bg-bg text-fg-secondary hover:bg-surface-2'
              }`}
            >
              {classLabel(c)}
            </button>
          ))}
        </nav>
      )}

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 data-anno='attendance:1' className='text-[15px] font-bold'>
          출석부
          {/* 회차 날짜는 스터디가 도는 시간대의 벽시계다. 기준을 적지 않으면 미국 스터디의 날짜를
              한국 날짜로 읽게 된다 — 목 21:00 KST 는 미국에서 수요일이다 */}
          <span className='ml-2 text-[13px] font-medium text-fg-muted'>
            {classLabel(cls)} · 크루 {crew.length} · 회차 {meetings.length} ·{' '}
            {tzAbbr(rule.tz, wallToInstant(meetings[0]!.date, rule.time, rule.tz))} 기준
          </span>
          {dirty && (
            <span
              data-anno='attendance:8'
              className='ml-2 inline-flex translate-y-[-1px] items-center rounded-pill bg-brand-subtle px-2 py-0.5 text-[11px] font-bold text-brand'
            >
              저장 필요 · {pending}칸
            </span>
          )}
        </h2>
        <Button
          data-anno='attendance:2'
          size='sm'
          variant='secondary'
          leadingIcon={<Plus size={15} />}
          disabled
          title='미구현'
        >
          회차 추가
        </Button>
      </div>

      <div data-anno='attendance:3' className='card mt-3 overflow-x-auto'>
        <table className='w-full border-separate border-spacing-0 text-sm'>
          <thead>
            <tr>
              <th
                data-anno='attendance:3-1'
                className='sticky left-0 z-[1] bg-surface px-4 py-3 text-left text-xs font-semibold text-fg-muted'
              >
                크루
              </th>
              {meetings.map((s) => (
                <th
                  key={s.id}
                  data-anno='attendance:3-2'
                  className='tnum w-[3.6rem] px-1 py-2 text-center text-[11px] font-semibold text-fg-secondary'
                >
                  {s.no}회<span className='block text-[10px] font-medium text-fg-muted'>{s.date.slice(5)}</span>
                </th>
              ))}
              <th data-anno='attendance:3-4' className='px-3 py-2 text-right text-xs font-semibold text-fg-muted'>
                출석률
              </th>
            </tr>
          </thead>
          <tbody>
            {crew.map((c) => {
              const row = draft[c.id];
              const rate = attendanceRate(row);
              return (
                <tr key={c.id}>
                  <td className='sticky left-0 z-[1] whitespace-nowrap border-t border-border bg-surface px-4 py-1.5 font-semibold'>
                    {c.name}
                  </td>
                  {meetings.map((s) => (
                    <td key={s.id} data-anno='attendance:3-3' className='border-t border-border px-1 py-1.5'>
                      <Cell
                        status={row?.[s.id]}
                        changed={cellOf(draft, c.id, s.id) !== cellOf(attendance, c.id, s.id)}
                        onClick={() => toggle(c.id, s.id)}
                        disabled={saving}
                      />
                    </td>
                  ))}
                  <td className='tnum border-t border-border px-3 py-1.5 text-right font-bold'>
                    {rate === undefined ? (
                      <span className='text-fg-muted'>—</span>
                    ) : (
                      <span className={rate >= 80 ? 'text-success-700' : rate >= 60 ? 'text-fg' : 'text-error-700'}>
                        {rate}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p data-anno='attendance:6' className='mt-2 text-xs text-fg-secondary'>
        진행 기간 {classPeriod(cls) || '미정'}
      </p>
      <p data-anno='attendance:4' className='mt-1 text-xs text-fg-muted'>
        칸을 누르면 출석 → 지각 → 결석 → 휴가 → 미체크 순으로 바뀝니다. 출석률은 출석 1, 지각 0.5로 셉니다. 저장을
        눌러야 반영됩니다.
      </p>
      <div className='mt-4 flex flex-wrap items-center gap-3'>
        {dirty ? (
          <p data-anno='attendance:8' className='text-sm font-medium text-brand'>
            저장되지 않은 변경 {pending}칸. 저장을 눌러야 반영됩니다.
          </p>
        ) : (
          saved && <span className='text-sm font-medium text-success-700'>저장되었습니다.</span>
        )}
        <div className='ml-auto flex items-center gap-2'>
          {dirty && (
            <Button variant='secondary' onClick={revert} disabled={saving}>
              변경 취소
            </Button>
          )}
          <span data-anno='attendance:7'>
            <Button onClick={save} loading={saving} disabled={!dirty}>
              저장
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}
