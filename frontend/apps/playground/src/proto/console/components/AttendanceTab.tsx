'use client';

import { useEffect, useState } from 'react';

import { classLabel, classPeriod, type StudyClass } from '@console/lib/classes';
import { tzAbbr, wallToInstant } from '@console/lib/schedule';
import { attendanceRate, type AttendanceStatus, type Crew, type Study, type StudyMeeting } from '@studyclub/mock';
import { Badge, Button } from '@studyclub/ui';
import { CalendarPlus, Mic, Plus } from 'lucide-react';

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
 *
 * 사용자 사이트(스터디 일정)는 몇 가지를 더 넘긴다 — 없으면 백오피스 모양 그대로다.
 * - `readOnly`: 크루는 보기만 한다
 * - `presentersOf`: 그 회차 발표자. 칸에 발표 표시를 붙이고 이름 옆에 발표 횟수를 센다
 *   (발표 여부는 따로 입력하지 않는다 — 일정의 발표자1·2가 정본이다)
 * - `notCounted`: 출석률에 넣지 않는 회차(킥오프). 칸은 보이고 체크도 한다
 * - `minimal`: 머리 줄(반 · 크루 수 · 기준 시간대) · 진행 기간 · 조작 안내 · 회차 추가를 숨긴다 — 탭 이름과 표가 이미 말해 준다
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
  readOnly,
  presenting,
  dot = true,
}: {
  status: AttendanceStatus | undefined;
  changed?: boolean;
  onClick: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** 이 회차의 발표자 — 칸 왼쪽 위에 마이크 표시. */
  presenting?: boolean;
  /** 고친 칸 오른쪽 위 점. 사용자 사이트는 테두리 강조만 쓴다. */
  dot?: boolean;
}) {
  const label = `${status ? CELL_LABEL[status] : '미체크'}${presenting ? ' · 발표' : ''}`;
  // 보기만 하는 칸은 버튼이 아니다 — 키보드 탭이 칸마다 멈추지 않게 한다.
  if (readOnly) {
    return (
      <span
        role='img'
        aria-label={label}
        title={label}
        className={`relative grid h-8 w-full place-items-center rounded-sm border text-[11px] font-bold ${
          status ? CELL_STYLE[status] : 'border-border bg-surface text-fg-muted'
        }`}
      >
        {presenting && <Mic size={10} strokeWidth={2.5} aria-hidden className='absolute left-0.5 top-0.5 text-brand' />}
        {status ? CELL_LABEL[status] : ''}
      </span>
    );
  }
  return (
    <button
      type='button'
      onClick={readOnly ? undefined : onClick}
      disabled={disabled}
      aria-disabled={readOnly || undefined}
      aria-label={changed ? `${label} · 저장되지 않음` : label}
      // 가리킬 때는 조작 방법만 — 저장 상태는 테두리 강조가 보여 준다(스크린리더는 aria-label 로 듣는다).
      title={readOnly ? label : '눌러서 출석 → 지각 → 결석 → 휴가 → 미체크'}
      className={`relative h-8 w-full rounded-sm border text-[11px] font-bold transition-colors ${
        status
          ? CELL_STYLE[status]
          : `border-dashed border-border-strong bg-surface text-fg-muted ${readOnly ? '' : 'hover:bg-surface-2'}`
      } ${readOnly ? 'cursor-default' : ''} ${changed ? 'border-solid border-brand ring-2 ring-brand/80' : ''}`}
    >
      {presenting && <Mic size={10} strokeWidth={2.5} aria-hidden className='absolute left-0.5 top-0.5 text-brand' />}
      {status ? CELL_LABEL[status] : ''}
      {changed && dot && (
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
  onAddMeeting,
  readOnly = false,
  presentersOf,
  notCounted,
  headOf,
  minimal = false,
}: {
  study: Study;
  /** 이름 칸에 쓰는 것만 받는다 — 사용자 사이트는 명부 밖의 「나」도 넣는다. */
  crew: (Pick<Crew, 'id' | 'name'> & {
    role?: 'captain' | 'navigator';
    /** 스터디를 중단한 사람 — 이름을 흐리게, 칩 문구, 중단 일자(이 날 뒤 회차는 「—」·출석률 제외). */
    left?: { label: string; at: string };
  })[];
  meetings: StudyMeeting[];
  attendance: AttendanceBook;
  classes: StudyClass[];
  classId: string;
  onClass: (id: string) => void;
  onSave: (next: AttendanceBook) => Promise<void>;
  onGoCrew: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** 있으면 「회차 추가」가 켜진다. 사용자 사이트는 일정 관리로 보낸다. */
  onAddMeeting?: () => void;
  readOnly?: boolean;
  presentersOf?: (meetingId: string) => string[];
  notCounted?: Set<string>;
  /** 열 머리 — 기본 「3회」. 킥오프는 「킥오프」. */
  headOf?: (meeting: StudyMeeting) => string;
  minimal?: boolean;
}) {
  const [draft, setDraft] = useState(() => cloneBook(attendance));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  /** 결과 문구를 숨기는 화면(minimal)에서도 스크린리더는 저장 결과를 듣는다. */
  const [announce, setAnnounce] = useState('');

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
    if (saving || readOnly) return;
    setAnnounce('');
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
    setAnnounce(`출석 ${pending}칸을 저장했습니다.`);
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

      {!minimal && (
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
          {!readOnly && (
            <Button
              data-anno='attendance:2'
              size='sm'
              variant='secondary'
              leadingIcon={<Plus size={15} />}
              disabled={!onAddMeeting}
              title={onAddMeeting ? undefined : '미구현'}
              onClick={onAddMeeting}
            >
              회차 추가
            </Button>
          )}
        </div>
      )}

      <div data-anno='attendance:3' className={`card overflow-x-auto ${minimal ? '' : 'mt-3'}`}>
        <table className='w-full border-separate border-spacing-0 text-sm'>
          <thead>
            <tr>
              <th
                data-anno='attendance:3-1'
                className='sticky left-0 z-[1] bg-surface px-4 py-3 text-left text-xs font-semibold text-fg-muted'
              >
                크루
              </th>
              {presentersOf && (
                <th
                  data-anno='attendance:3-5'
                  className='w-16 whitespace-nowrap px-2 py-2 text-center text-[11px] font-semibold text-fg-muted'
                  title='일정의 발표자1·2로 맡은 횟수'
                >
                  발표 횟수
                </th>
              )}
              {meetings.map((s) => (
                <th
                  key={s.id}
                  data-anno='attendance:3-2'
                  className='tnum w-[3.6rem] px-1 py-2 text-center text-[11px] font-semibold text-fg-secondary'
                >
                  {headOf ? headOf(s) : `${s.no}회`}
                  <span className='block text-[10px] font-medium text-fg-muted'>{`${Number(s.date.slice(5, 7))}/${s.date.slice(8, 10)}`}</span>
                </th>
              ))}
              <th
                data-anno='attendance:3-4'
                className='w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] whitespace-nowrap px-3 py-2 text-right text-xs font-semibold text-fg-muted'
              >
                출석률
              </th>
            </tr>
          </thead>
          <tbody>
            {crew.map((c) => {
              const row = draft[c.id];
              // 킥오프처럼 세지 않는 회차는 칸에만 두고 출석률에서 뺀다.
              // 중단한 사람은 중단 일자 뒤 회차를 칸에서 비우고 출석률에서도 뺀다.
              const gone = (s: StudyMeeting) => Boolean(c.left && s.date > c.left.at);
              const goneIds = new Set(meetings.filter(gone).map((s) => s.id));
              const counted = row
                ? Object.fromEntries(Object.entries(row).filter(([id]) => !notCounted?.has(id) && !goneIds.has(id)))
                : row;
              const rate = attendanceRate(counted);
              const presented = presentersOf ? meetings.filter((s) => presentersOf(s.id).includes(c.id)).length : 0;
              return (
                <tr key={c.id}>
                  <td className='sticky left-0 z-[1] whitespace-nowrap border-t border-border bg-surface px-4 py-1.5 font-semibold'>
                    {/* 동명이인 구분(디스코드 닉네임)이 붙으면 길어진다 — 칸은 좁게 두고 전체 이름은 가리키면 보인다 */}
                    <span className='flex items-center gap-1.5'>
                      <span
                        className={`block max-w-[12rem] truncate ${c.left ? 'font-medium text-fg-muted' : ''}`}
                        title={c.name}
                      >
                        {c.name}
                      </span>
                      {c.left && <Badge tone='neutral'>{c.left.label}</Badge>}
                      {/* 사용자 사이트는 캡틴·네비게이터에 역할 칩을 붙인다. 크루는 칩 없음 */}
                      {c.role && <Badge tone={c.role}>{c.role === 'captain' ? '캡틴' : '네비게이터'}</Badge>}
                    </span>
                  </td>
                  {presentersOf && (
                    <td className='tnum border-t border-border px-2 py-1.5 text-center text-xs font-semibold text-fg-secondary'>
                      {presented || <span className='text-fg-muted'>0</span>}
                    </td>
                  )}
                  {meetings.map((s) =>
                    gone(s) ? (
                      <td key={s.id} className='border-t border-border px-1 py-1.5 text-center text-xs text-fg-muted'>
                        —
                      </td>
                    ) : (
                      <td key={s.id} data-anno='attendance:3-3' className='border-t border-border px-1 py-1.5'>
                        <Cell
                          status={row?.[s.id]}
                          changed={cellOf(draft, c.id, s.id) !== cellOf(attendance, c.id, s.id)}
                          onClick={() => toggle(c.id, s.id)}
                          disabled={saving}
                          readOnly={readOnly}
                          presenting={presentersOf?.(s.id).includes(c.id)}
                          dot={!minimal}
                        />
                      </td>
                    ),
                  )}
                  <td className='tnum w-[4.5rem] min-w-[4.5rem] max-w-[4.5rem] whitespace-nowrap border-t border-border px-3 py-1.5 text-right font-bold'>
                    {rate === undefined ? (
                      <span className='text-fg-muted'>—</span>
                    ) : (
                      <span
                        className={
                          // 참여를 끝낸 사람의 출석률은 회색 — 지금 관리할 대상이 아니다.
                          c.left
                            ? 'text-fg-muted'
                            : rate >= 80
                              ? 'text-success-700'
                              : rate >= 60
                                ? 'text-fg'
                                : 'text-error-700'
                        }
                      >
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

      {!minimal && (
        <>
          <p data-anno='attendance:6' className='mt-2 text-xs text-fg-secondary'>
            진행 기간 {classPeriod(cls) || '미정'}
          </p>
          <p data-anno='attendance:4' className='mt-1 text-xs text-fg-muted'>
            {readOnly
              ? '출석률은 출석 1, 지각 0.5로 셉니다.'
              : '칸을 누르면 출석 → 지각 → 결석 → 휴가 → 미체크 순으로 바뀝니다. 출석률은 출석 1, 지각 0.5로 셉니다. 저장을 눌러야 반영됩니다.'}
            {presentersOf && ' 마이크 표시는 그 회차 발표자입니다(일정의 발표자1·2).'}
            {notCounted && notCounted.size > 0 && ' 킥오프는 출석만 남기고 출석률에 넣지 않습니다.'}
          </p>
        </>
      )}
      <p className='sr-only' aria-live='polite'>
        {announce}
      </p>
      {!readOnly && (
        <div
          className={`mt-4 flex flex-wrap items-center gap-3 ${
            minimal ? 'sticky bottom-0 z-10 justify-end bg-bg py-2' : ''
          }`}
        >
          {dirty ? (
            minimal ? null : (
              <p data-anno='attendance:8' className='text-sm font-medium text-brand'>
                저장되지 않은 변경 {pending}칸. 저장을 눌러야 반영됩니다.
              </p>
            )
          ) : (
            saved && !minimal && <span className='text-sm font-medium text-success-700'>저장되었습니다.</span>
          )}
          <div className={`flex items-center gap-2 ${minimal ? '' : 'ml-auto'}`}>
            {dirty && (
              <Button
                variant={minimal ? 'ghost' : 'secondary'}
                size={minimal ? 'sm' : undefined}
                onClick={revert}
                disabled={saving}
              >
                변경 취소
              </Button>
            )}
            <span data-anno='attendance:7'>
              <Button size={minimal ? 'sm' : undefined} onClick={save} loading={saving} disabled={!dirty}>
                저장
              </Button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
