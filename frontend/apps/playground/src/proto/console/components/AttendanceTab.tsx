'use client';

import { useEffect, useState } from 'react';

import { ClassPicker } from '@console/components/ClassPicker';
import { type StudyClass } from '@console/lib/classes';
import { attendanceRate, type AttendanceStatus, type Crew, type Study, type StudyMeeting } from '@studyclub/mock';
import { Badge, Button } from '@studyclub/ui';
import { CalendarPlus, Mic } from 'lucide-react';

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
 * 사용자 사이트 출석부와 백오피스 출석 탭이 같은 화면이다. 다른 점은 범위뿐 — 백오피스는 반을 고른다.
 * 머리 줄 · 진행 기간 · 조작 안내 · 결과 문구는 두지 않는다 — 탭 이름과 표가 이미 말해 준다.
 * 고친 칸은 테두리로만 가른다. 저장은 화면 아래 오른쪽 「변경 취소 · 저장」 한 줄이다.
 *
 * - `readOnly`: 크루는 보기만 한다
 * - `presentersOf`: 그 회차 발표자. 칸에 발표 표시를 붙이고 이름 옆에 발표 횟수를 센다
 *   (발표 여부는 따로 입력하지 않는다 — 일정의 발표자1·2가 정본이다)
 * - `notCounted`: 출석률에 넣지 않는 회차(킥오프). 칸은 보이고 체크도 한다
 * - `onWithdraw`: 사용자 사이트 네비게이터의 참여 중단. `manageable` 이고 활동 중인 줄에만 버튼이 붙는다. 되돌리기는 없다.
 *   고친 칸이 남아 있으면 누를 수 없다 — 줄이 움직이면 어느 칸을 고쳤는지 놓친다
 * - `startAt`: 회차 시작 시각(HH:mm). 중단 시각과 견줘 그 뒤에 시작한 회차를 「—」로 비운다
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
}: {
  status: AttendanceStatus | undefined;
  changed?: boolean;
  onClick: () => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** 이 회차의 발표자 — 칸 왼쪽 위에 마이크 표시. */
  presenting?: boolean;
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
        {presenting && (
          <Mic
            size={10}
            strokeWidth={2.5}
            aria-hidden
            data-anno='book:3-3 attendance:3-6'
            className='absolute left-0.5 top-0.5 text-brand'
          />
        )}
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
      {presenting && (
        <Mic
          size={10}
          strokeWidth={2.5}
          aria-hidden
          data-anno='book:3-3 attendance:3-6'
          className='absolute left-0.5 top-0.5 text-brand'
        />
      )}
      {status ? CELL_LABEL[status] : ''}
    </button>
  );
}

/**
 * 이름 칸 끝의 작은 「참여 중단」 버튼 — 활동 중인 줄에만. 중단한 줄에는 버튼이 없다(되돌리지 않는다).
 * 바로 바꾸지 않는다. 누르면 확인 창이 뜬다(부모가 띄운다).
 * 고친 칸이 있으면 막는다. disabled 대신 aria-disabled — 눌러서 이유를 보고 키보드로도 닿는다.
 */
const BLOCKED_HINT_ID = 'participation-blocked-hint';
const BLOCKED_HINT = '출석을 먼저 저장해 주세요. 참여 중단은 저장한 뒤에 할 수 있습니다.';

function WithdrawButton({
  name,
  blocked,
  onClick,
  onBlocked,
}: {
  name: string;
  blocked: boolean;
  onClick: () => void;
  /** 막혔을 때 누르면 — 이유를 화면에 보인다(가리키기 툴팁은 터치·키보드에서 안 보인다). */
  onBlocked: () => void;
}) {
  return (
    <Button
      size='sm'
      variant='secondary'
      aria-label={`${name} 참여 중단`}
      aria-disabled={blocked || undefined}
      aria-describedby={blocked ? BLOCKED_HINT_ID : undefined}
      onClick={blocked ? onBlocked : onClick}
      // 배경은 채우지 않고 테두리·글씨만 빨강 — 줄마다 붙어 있어 채우면 표가 빨갛게 덮인다.
      // disabled 대신 흐리게만 — 눌러서 이유를 볼 수 있어야 한다. sm 은 높이 32px · 누르는 자리 44px.
      className={`border-error-600 bg-transparent text-error-700 ${
        blocked ? 'cursor-not-allowed opacity-40' : 'hover:border-error-700 hover:bg-error-50'
      }`}
    >
      참여 중단
    </Button>
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
  onWithdraw,
  startAt = '00:00',
}: {
  study: Study;
  /** 이름 칸에 쓰는 것만 받는다 — 사용자 사이트는 명부 밖의 「나」도 넣는다. */
  crew: (Pick<Crew, 'id' | 'name'> & {
    role?: 'captain' | 'navigator';
    /** 스터디를 중단한 사람 — 이름을 흐리게, 칩 문구, 중단 일자(이 날 뒤 회차는 「—」·출석률 제외). */
    left?: { label: string; at: string };
    /** 참여 중단 버튼을 붙일 줄 — 나 · 캡틴 · 네비게이터 줄은 비운다. */
    manageable?: boolean;
  })[];
  meetings: StudyMeeting[];
  attendance: AttendanceBook;
  classes: StudyClass[];
  classId: string;
  onClass: (id: string) => void;
  onSave: (next: AttendanceBook) => Promise<void>;
  onGoCrew: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  /** 회차가 없을 때 안내 버튼 — 회차는 일정 탭에서 만든다. 그리로 보낸다. */
  onAddMeeting?: () => void;
  readOnly?: boolean;
  presentersOf?: (meetingId: string) => string[];
  notCounted?: Set<string>;
  /** 열 머리 — 기본 「3회」. 킥오프는 「킥오프」. */
  headOf?: (meeting: StudyMeeting) => string;
  onWithdraw?: (crewId: string) => void;
  startAt?: string;
}) {
  const [draft, setDraft] = useState(() => cloneBook(attendance));
  const [saving, setSaving] = useState(false);
  /** 결과 문구는 화면에 두지 않는다. 스크린리더만 저장 결과를 듣는다. */
  const [announce, setAnnounce] = useState('');
  /** 막힌 중단 버튼을 눌렀을 때 저장 바에 이유를 보인다. 저장·취소로 고친 칸이 없어지면 사라진다. */
  const [blockedHint, setBlockedHint] = useState(false);

  useEffect(() => {
    setDraft(cloneBook(attendance));
  }, [attendance]);

  const pending = changedCount(draft, attendance);
  const dirty = pending > 0;
  const showBlockedHint = blockedHint && dirty;

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
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setBlockedHint(false);
    await onSave(cloneBook(draft));
    setSaving(false);
    setAnnounce(`출석 ${pending}칸을 저장했습니다.`);
  }

  function revert() {
    if (saving) return;
    setBlockedHint(false);
    setDraft(cloneBook(attendance));
  }

  const cls = classes.find((c) => c.id === classId);
  // 반이 없으면 출석부도 없다. 그 사실과 갈 곳을 같이 말한다 —
  // 「아직 회차가 없습니다」만 두면 운영자는 여기서 무엇을 눌러야 하는지 알 수 없다.
  if (!cls) {
    return (
      <div data-anno='attendance:5' className='card px-6 py-10 text-center'>
        <p className='text-sm font-semibold text-fg'>아직 반이 없습니다.</p>
        <p className='mt-1.5 text-sm text-fg-muted'>
          신청자 탭에서 가능한 시간을 보고 반을 만들면 그 반의 출석부가 만들어집니다.
        </p>
        <Button size='sm' className='mt-4' leadingIcon={<CalendarPlus size={15} />} onClick={onGoCrew}>
          반 만들기
        </Button>
      </div>
    );
  }

  return (
    <div>
      <ClassPicker classes={classes} classId={classId} onClass={onClass} anno='attendance:0' />

      {meetings.length === 0 ? (
        // 반은 있는데 회차가 없다 — 회차는 일정 탭에서 만든다. 반 고르기는 위에 남겨 다른 반으로 옮길 수 있게 한다.
        <div data-anno='attendance:5' className='card px-6 py-10 text-center'>
          <p className='text-sm font-semibold text-fg'>이 반에는 아직 회차가 없습니다.</p>
          <p className='mt-1.5 text-sm text-fg-muted'>일정 탭에서 회차를 추가하면 이 반의 출석부가 만들어집니다.</p>
          {onAddMeeting && (
            <Button size='sm' className='mt-4' leadingIcon={<CalendarPlus size={15} />} onClick={onAddMeeting}>
              회차 추가하러 가기
            </Button>
          )}
        </div>
      ) : (
        <>
          <div data-anno='attendance:3' className='card overflow-x-auto'>
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
                      data-anno='attendance:3-5 book:3-5'
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
                  // 시각으로 견준다 — 같은 날이라도 중단한 뒤에 시작한 회차는 비운다.
                  const gone = (s: StudyMeeting) => Boolean(c.left && `${s.date}T${startAt}` > c.left.at);
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
                          {c.left && (
                            <span data-anno='book:3-6'>
                              <Badge tone='neutral'>{c.left.label}</Badge>
                            </span>
                          )}
                          {/* 사용자 사이트는 캡틴·네비게이터에 역할 칩을 붙인다. 크루는 칩 없음 */}
                          {c.role && <Badge tone={c.role}>{c.role === 'captain' ? '캡틴' : '네비게이터'}</Badge>}
                          {!readOnly && c.manageable && !c.left && onWithdraw && (
                            <span data-anno='book:3-7' className='ml-auto pl-2'>
                              <WithdrawButton
                                name={c.name}
                                blocked={dirty || saving}
                                onClick={() => onWithdraw(c.id)}
                                onBlocked={() => {
                                  setBlockedHint(true);
                                  setAnnounce(BLOCKED_HINT);
                                }}
                              />
                            </span>
                          )}
                        </span>
                      </td>
                      {presentersOf && (
                        <td className='tnum border-t border-border px-2 py-1.5 text-center text-xs font-semibold text-fg-secondary'>
                          {presented || <span className='text-fg-muted'>0</span>}
                        </td>
                      )}
                      {meetings.map((s) =>
                        gone(s) ? (
                          <td
                            key={s.id}
                            className='border-t border-border px-1 py-1.5 text-center text-xs text-fg-muted'
                          >
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
                                ? 'font-normal text-fg-muted'
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

          <p className='sr-only' aria-live='polite'>
            {announce}
          </p>
          {!readOnly && (
            <div className='sticky bottom-0 z-10 mt-4 flex items-center justify-end gap-2 bg-bg py-2'>
              {/* 중단 버튼이 막힌 이유 — 늘 스크린리더 설명으로 두고, 막힌 버튼을 누르면 화면에도 보인다 */}
              {dirty && onWithdraw && (
                <p
                  id={BLOCKED_HINT_ID}
                  className={showBlockedHint ? 'mr-auto text-xs text-fg-secondary' : 'sr-only'}
                >
                  {BLOCKED_HINT}
                </p>
              )}
              {dirty && (
                <Button variant='ghost' size='sm' onClick={revert} disabled={saving}>
                  변경 취소
                </Button>
              )}
              <span data-anno='attendance:7'>
                <Button size='sm' onClick={save} loading={saving} disabled={!dirty}>
                  저장
                </Button>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
