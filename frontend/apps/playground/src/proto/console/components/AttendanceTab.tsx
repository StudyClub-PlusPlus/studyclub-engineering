'use client';

import { useEffect, useState } from 'react';

import { ClassPicker } from '@console/components/ClassPicker';
import { type StudyClass } from '@console/lib/classes';
import { attendanceRate, type AttendanceStatus, type Crew, type Study, type StudyMeeting } from '@studyclub/mock';
import { Badge, Button, Modal } from '@studyclub/ui';
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
 * - `onWithdraw`: 사용자 사이트 네비게이터의 참여 중단. 주면 `manageable` 이고 활동 중인 줄 왼쪽에 체크박스가 붙고,
 *   고른 사람에게 출석을 한 번에 적용하거나 「중단 예정」으로 둔다. 저장이 성공한 뒤 중단 예정 ID 로 불린다. 되돌리기는 없다.
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
 * 줄 맨 왼쪽 체크박스로 크루를 골라 표 아래 선택 바에서 한 번에 처리한다 — 출석 일괄 적용 · 참여 중단.
 * 둘 다 저장 전 변경이다. 참여 중단은 줄에 「중단 예정」만 붙고, 「저장」을 누를 때 확인 창을 거쳐 출석과 함께 반영된다.
 */

/** 일괄 적용에서 고르는 상태. 빈 값은 미체크(칸 비우기). */
const BULK_OPTIONS: { value: AttendanceStatus | ''; label: string }[] = [
  { value: 'present', label: '출석' },
  { value: 'late', label: '지각' },
  { value: 'absent', label: '결석' },
  { value: 'excused', label: '휴가' },
  { value: '', label: '미체크' },
];

const CHECKBOX =
  'h-4 w-4 shrink-0 cursor-pointer rounded-xs border-border-strong accent-(--color-brand) focus-visible:outline-none focus-visible:shadow-(--ring)';

/** 머리 칸의 전체 선택 — 일부만 골랐으면 「일부 선택」(indeterminate). */
function SelectAll({ checked, partial, onChange }: { checked: boolean; partial: boolean; onChange: () => void }) {
  return (
    <input
      type='checkbox'
      aria-label='크루 전체 선택'
      className={CHECKBOX}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = partial;
      }}
      onChange={onChange}
    />
  );
}

const SELECT_CLASS =
  'h-8 rounded-control border border-border-strong bg-bg px-2 text-sm text-fg focus-visible:outline-none focus-visible:shadow-(--ring)';

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
    /** 체크박스로 고를 수 있는 줄 — 나 · 캡틴 · 네비게이터 줄은 비운다. */
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
  onWithdraw?: (crewIds: string[]) => void | Promise<void>;
  startAt?: string;
}) {
  const [draft, setDraft] = useState(() => cloneBook(attendance));
  const [saving, setSaving] = useState(false);
  /** 결과 문구는 화면에 두지 않는다. 스크린리더만 저장 결과를 듣는다. */
  const [announce, setAnnounce] = useState('');
  /** 「중단 예정」 — 저장할 때 출석과 함께 참여 중단으로 반영된다. */
  const [toWithdraw, setToWithdraw] = useState<Set<string>>(() => new Set());
  /** 중단 예정이 있을 때 저장을 누르면 뜨는 확인 창. */
  const [confirming, setConfirming] = useState(false);
  /** 체크박스로 고른 크루. 중단돼 목록에서 빠진 사람은 아래에서 걸러 낸다. */
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [bulkMeeting, setBulkMeeting] = useState('');
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus | ''>('present');

  useEffect(() => {
    setDraft(cloneBook(attendance));
  }, [attendance]);

  const pending = changedCount(draft, attendance);
  // 중단된 뒤 목록에서 빠진 사람은 예정에서도 뺀다.
  const withdrawIds = crew.filter((c) => !c.left && toWithdraw.has(c.id)).map((c) => c.id);
  const withdrawNames = crew.filter((c) => withdrawIds.includes(c.id)).map((c) => c.name);
  const dirty = pending > 0 || withdrawIds.length > 0;

  const selecting = !readOnly && Boolean(onWithdraw);
  const selectable = selecting ? crew.filter((c) => c.manageable && !c.left).map((c) => c.id) : [];
  const selected = selectable.filter((id) => picked.has(id));
  const allPicked = selectable.length > 0 && selected.length === selectable.length;
  // 일괄 적용 회차 — 고르지 않았으면 오늘 이전 마지막 회차(방금 끝난 회차)를 먼저 둔다.
  const today = new Date().toISOString().slice(0, 10);
  const defaultMeeting = [...meetings].reverse().find((s) => s.date <= today)?.id ?? meetings[0]?.id ?? '';
  const meetingId = bulkMeeting || defaultMeeting;

  function pick(id: string) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pickAll() {
    setPicked(allPicked ? new Set() : new Set(selectable));
  }

  /** 고른 사람들의 한 회차 칸을 같은 값으로 — 저장 전 변경이다(칸 테두리 강조 · 저장 바). */
  function applyBulk() {
    if (saving || !meetingId || selected.length === 0) return;
    setAnnounce('');
    setDraft((book) => {
      const next = { ...book };
      for (const id of selected) {
        const row = { ...(next[id] ?? {}) };
        if (bulkStatus) row[meetingId] = bulkStatus;
        else delete row[meetingId];
        next[id] = row;
      }
      return next;
    });
    const head = meetings.find((s) => s.id === meetingId);
    const label = BULK_OPTIONS.find((o) => o.value === bulkStatus)?.label ?? '';
    setAnnounce(`${selected.length}명의 ${head ? (headOf ? headOf(head) : `${head.no}회`) : ''} 칸을 ${label}(으)로 바꿨습니다. 저장해야 반영됩니다.`);
  }

  /** 고른 사람을 「중단 예정」으로 — 아직 반영하지 않는다. 저장할 때 확인 창을 거친다. */
  function markWithdraw() {
    if (saving || selected.length === 0) return;
    setToWithdraw((cur) => new Set([...cur, ...selected]));
    setAnnounce(`${selected.length}명을 중단 예정으로 표시했습니다. 저장해야 반영됩니다.`);
    setPicked(new Set());
  }

  function unmarkWithdraw(id: string) {
    setToWithdraw((cur) => {
      const next = new Set(cur);
      next.delete(id);
      return next;
    });
  }

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

  /** 중단 예정이 있으면 확인 창부터 — 되돌릴 수 없는 일이 저장에 섞여 있다. */
  function requestSave() {
    if (!dirty || saving) return;
    if (withdrawIds.length > 0) setConfirming(true);
    else void save();
  }

  /** 출석과 참여 중단을 한 번에. 출석이 먼저 — 실패하면 중단도 하지 않는다(서버는 한 트랜잭션). */
  async function save() {
    if (!dirty || saving) return;
    setConfirming(false);
    setSaving(true);
    // TODO(api): 출석 updates[] 와 참여 중단 withdraw[] 를 한 요청 · 한 트랜잭션으로.
    if (pending > 0) await onSave(cloneBook(draft));
    const ids = withdrawIds;
    if (ids.length > 0) await onWithdraw?.(ids);
    setToWithdraw(new Set());
    setSaving(false);
    const parts = [pending > 0 && `출석 ${pending}칸을 저장`, ids.length > 0 && `${ids.length}명의 참여를 중단`].filter(Boolean);
    setAnnounce(`${parts.join('하고 ')}했습니다.`);
  }

  function revert() {
    if (saving) return;
    setToWithdraw(new Set());
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
                    <span className='flex items-center gap-3'>
                      {selecting && (
                        <span data-anno='book:3-7' className='flex'>
                          <SelectAll checked={allPicked} partial={selected.length > 0 && !allPicked} onChange={pickAll} />
                        </span>
                      )}
                      크루
                    </span>
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
                          {selecting && (
                            // 고를 수 없는 줄(나 · 운영진 · 중단한 사람)도 자리를 비워 이름 열을 맞춘다.
                            <span className='mr-1.5 flex w-4 shrink-0'>
                              {c.manageable && !c.left && (
                                <input
                                  type='checkbox'
                                  aria-label={`${c.name} 선택`}
                                  className={CHECKBOX}
                                  checked={picked.has(c.id)}
                                  onChange={() => pick(c.id)}
                                  disabled={saving}
                                />
                              )}
                            </span>
                          )}
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
                          {withdrawIds.includes(c.id) && (
                            // 저장 전이라 아직 중단이 아니다 — 칩과 「취소」로 예정만 보인다.
                            <span data-anno='book:3-8' className='flex items-center gap-1'>
                              <Badge tone='absent'>중단 예정</Badge>
                              <button
                                type='button'
                                aria-label={`${c.name} 중단 예정 취소`}
                                onClick={() => unmarkWithdraw(c.id)}
                                disabled={saving}
                                className='rounded-sm px-1 text-xs font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline'
                              >
                                취소
                              </button>
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
          {selected.length > 0 && (
            // 고른 사람이 있을 때만 — 출석 일괄 적용 · 참여 중단 예정. 둘 다 저장 전 변경이다.
            <div
              data-anno='book:3-9'
              role='region'
              aria-label='선택한 크루 처리'
              className='sticky bottom-12 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-card border border-border bg-surface px-3 py-2 shadow-sm'
            >
              <span className='text-sm font-semibold text-fg'>선택한 {selected.length}명</span>
              <select
                aria-label='적용할 회차'
                className={SELECT_CLASS}
                value={meetingId}
                onChange={(e) => setBulkMeeting(e.target.value)}
              >
                {meetings.map((s) => (
                  <option key={s.id} value={s.id}>
                    {`${headOf ? headOf(s) : `${s.no}회`} · ${Number(s.date.slice(5, 7))}/${s.date.slice(8, 10)}`}
                  </option>
                ))}
              </select>
              <select
                aria-label='적용할 출석 상태'
                className={SELECT_CLASS}
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as AttendanceStatus | '')}
              >
                {BULK_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Button size='sm' variant='tonal' onClick={applyBulk} disabled={saving}>
                출석 적용
              </Button>
              <span aria-hidden className='mx-1 h-5 w-px bg-border' />
              <Button
                size='sm'
                variant='secondary'
                onClick={markWithdraw}
                disabled={saving}
                // 테두리·글씨만 빨강.
                className='border-error-600 bg-transparent text-error-700 hover:border-error-700 hover:bg-error-50'
              >
                참여 중단
              </Button>
              <Button size='sm' variant='ghost' className='ml-auto' onClick={() => setPicked(new Set())}>
                선택 해제
              </Button>
            </div>
          )}
          {!readOnly && (
            <div className='sticky bottom-0 z-10 mt-2 flex items-center justify-end gap-2 bg-bg py-2'>
              {dirty && (
                <Button variant='ghost' size='sm' onClick={revert} disabled={saving}>
                  변경 취소
                </Button>
              )}
              <span data-anno='attendance:7'>
                <Button size='sm' onClick={requestSave} loading={saving} disabled={!dirty}>
                  저장
                </Button>
              </span>
            </div>
          )}

          <Modal
            open={confirming}
            onClose={() => setConfirming(false)}
            title={
              withdrawIds.length === 1
                ? `${withdrawNames[0]} 님의 참여를 중단하고 저장할까요?`
                : `${withdrawIds.length}명의 참여를 중단하고 저장할까요?`
            }
            footer={
              <>
                <Button variant='secondary' onClick={() => setConfirming(false)}>
                  취소
                </Button>
                <span data-anno='book:5'>
                  <Button variant='destructive' onClick={() => void save()}>
                    참여 중단하고 저장
                  </Button>
                </span>
              </>
            }
          >
            <p className='mb-3 text-sm text-fg'>
              <span className='font-semibold'>참여 중단</span> {withdrawNames.join(', ')}
              {pending > 0 && (
                <>
                  <br />
                  <span className='font-semibold'>출석</span> {pending}칸
                </>
              )}
            </p>
            <ul className='list-disc space-y-1 pl-5 text-sm text-fg-secondary'>
              <li>지금까지의 출석 기록은 그대로 남습니다.</li>
              <li>지금 뒤에 시작하는 회차는 「—」로 비고 출석률에서 빠집니다.</li>
              <li>더는 스터디 디스코드 채널 · 드라이브 링크를 볼 수 없고, 발표자로 고를 수 없습니다.</li>
              <li>중단한 뒤에는 다시 참여시킬 수 없습니다.</li>
            </ul>
          </Modal>
        </>
      )}
    </div>
  );
}
