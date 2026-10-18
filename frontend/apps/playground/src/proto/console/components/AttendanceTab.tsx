'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { ClassPicker } from '@console/components/ClassPicker';
import { hasSchedule, type StudyClass } from '@console/lib/classes';
import { attendanceRate, type AttendanceStatus, type Crew, type Study, type StudyMeeting } from '@studyclub/mock';
import { Badge, Button, Modal, SelectionCount, TableActionBar } from '@studyclub/ui';
import { CalendarPlus, CircleHelp, Mic, Undo2 } from 'lucide-react';

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
 * 사용자 사이트 출석부와 백오피스 출석 탭이 같은 화면이다. 다른 점은 범위뿐 — 백오피스는 반 칩으로 반을 고른다.
 * 머리 줄 · 진행 기간 · 조작 안내 · 결과 문구는 두지 않는다 — 탭 이름과 표가 이미 말해 준다.
 * 칸은 평소 테두리 없이 색만 — 고친 칸에만 테두리를 두른다. 작업 바(선택 · 저장)는 표 맨 위 한 줄이다.
 * 크루 · 발표 횟수(왼쪽)와 출석률(오른쪽)은 고정하고 회차 열만 가로로 스크롤한다. 회차 칸 너비는 모두 같다.
 *
 * - `readOnly`: 크루는 보기만 한다
 * - `presentersOf`: 그 회차 발표자. 칸에 발표 표시를 붙이고 이름 옆에 발표 횟수를 센다
 *   (발표 여부는 따로 입력하지 않는다 — 일정의 발표자1·2가 정본이다)
 * - `notCounted`: 출석률에 넣지 않는 회차(킥오프). 칸은 보이고 체크도 한다
 * - `onWithdraw`: 사용자 사이트 네비게이터의 참여 중단. 주면 `manageable` 이고 활동 중인 줄 왼쪽에 체크박스가 붙고,
 *   고른 사람에게 출석을 한 번에 적용하거나 「중단 예정」으로 둔다. 저장이 성공한 뒤 중단 예정 ID 로 불린다. 되돌리기는 없다.
 *   운영진(`withdrawable` 아님)도 고를 수 있지만, 섞여 있으면 「참여 중단」만 잠근다
 * - `startAt`: 회차 시작 시각(HH:mm). 중단 시각과 견줘 그 뒤에 시작한 회차를 「—」로 비운다
 * - `title` · `toolbar`: 표 위 제목 줄 — 제목 옆에 「전체 N」, 오른쪽에 `toolbar`(KST/PDT). 선택 개수는 작업 바에만
 * - `whenOf`: 회차 머리의 일자 — 고른 시간대의 벽시계. 없으면 저장된 일자. 머리에는 일자만 두고 시각은 넣지 않는다
 */

type AttendanceBook = Record<string, Record<string, AttendanceStatus>>;

const CELL_STYLE: Record<AttendanceStatus, string> = {
  present: 'border-transparent bg-success-100 text-success-700',
  late: 'border-transparent bg-warning-100 text-warning-700',
  absent: 'border-transparent bg-error-50 text-error-700',
  excused: 'border-transparent bg-surface-2 text-fg-secondary',
};

/** 고친 칸의 테두리 — 사이트 포인트 색이 아니라 그 칸의 상태 색. 미체크로 바꾼 칸은 회색. */
const CHANGED_RING: Record<AttendanceStatus, string> = {
  present: 'ring-success-700',
  late: 'ring-warning-700',
  absent: 'ring-error-700',
  excused: 'ring-fg-secondary',
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
        className={`relative grid h-8 w-full place-items-center rounded-sm text-[11px] font-bold ${
          status ? CELL_STYLE[status] : 'bg-surface-1 text-fg-muted'
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
      // 평소에는 테두리 없이 색만 — 고치고 저장하기 전인 칸에만 그 상태 색 테두리를 두른다.
      title={readOnly ? label : '눌러서 출석 → 지각 → 결석 → 휴가 → 미체크'}
      className={`relative h-8 w-full rounded-sm text-[11px] font-bold transition-colors ${
        status ? CELL_STYLE[status] : 'bg-surface-1 text-fg-muted hover:bg-surface-2'
      } ${changed ? `ring-2 ${status ? CHANGED_RING[status] : 'ring-border-strong'}` : ''}`}
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
 * 줄 맨 왼쪽 체크박스로 크루를 골라 표 위 작업 바에서 한 번에 처리한다 — 출석 일괄 변경 · 참여 중단.
 * 둘 다 저장 전 변경이다. 중단 예정인 줄은 줄 전체를 옅은 빨강으로 칠한다 — 칩을 붙이면 좁은 닉네임 칸이 가려진다.
 * 닉네임 옆에는 되돌리기 아이콘만, 「중단 예정 n명」은 작업 바에 한 번. 「저장」을 누를 때 확인 창을 거쳐 출석과 함께 반영된다.
 * 「적용」 버튼은 없다 — 상태를 고르는 순간 고른 사람의 그 회차 칸이 바뀐다(저장 전 변경이라 되돌릴 수 있다).
 */

/** 일괄 변경에서 고르는 상태. `clear` 는 미체크(칸 비우기). */
const BULK_OPTIONS: { value: AttendanceStatus | 'clear'; label: string }[] = [
  { value: 'present', label: '출석' },
  { value: 'late', label: '지각' },
  { value: 'absent', label: '결석' },
  { value: 'excused', label: '휴가' },
  { value: 'clear', label: '미체크' },
];

export const CHECKBOX =
  'h-4 w-4 shrink-0 cursor-pointer rounded-xs border-border-strong accent-(--color-brand) focus-visible:outline-none focus-visible:shadow-(--ring)';

/** 머리 칸의 전체 선택 — 일부만 골랐으면 「일부 선택」(indeterminate). */
export function SelectAll({
  checked,
  partial,
  onChange,
  label = '전체 선택',
}: {
  checked: boolean;
  partial: boolean;
  onChange: () => void;
  label?: string;
}) {
  return (
    <input
      type='checkbox'
      aria-label={label}
      className={CHECKBOX}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = partial;
      }}
      onChange={onChange}
    />
  );
}

/**
 * 열 너비 — table-fixed 라 머리 줄 너비가 곧 열 너비다. 고정 열(sticky)의 left 는 앞 열 너비와 같아야 한다.
 * 휴대폰에서는 고정 열을 좁혀 회차 칸이 두세 개는 보이게 한다.
 */
const NAME_COL = 'w-28 sm:w-44';
/** 디스코드 닉네임 — 휴대폰에서는 숨긴다(고정 열이 화면을 다 차지한다). 길면 말줄임, 가리키면 전체. */
const DISCORD_COL = 'hidden sm:table-cell sm:left-44 sm:w-44';
const PRESENT_COL = 'left-28 w-12 sm:left-88 sm:w-16';
/** 회차 칸 — 상태와 상관없이 모두 같은 너비(중단 뒤 「—」 칸 포함). */
const MEETING_COL = 'w-[3.6rem]';
const RATE_COL = 'w-14 sm:w-20';

/**
 * 작업 바 드롭다운. 고른 사람이 없으면 잠기고 버튼과 같은 비활성 회색(`disabled-bg` · `disabled-fg`)이 된다 —
 * 고르기 전에는 바 전체가 옅은 회색, 한 명이라도 고르면 살아난다 (출석부 · 참여 크루 공통).
 */
export const SELECT_CLASS =
  'h-8 rounded-control border border-border-strong bg-bg px-2 text-sm text-fg focus-visible:outline-none focus-visible:shadow-(--ring) disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-fg';

/**
 * 출석부 제목 옆 「?」 — 칸 왼쪽 위 마이크가 무엇인지 알려 준다. 누르면 열고, 바깥 · Esc 로 닫는다.
 * 늘 펼쳐 두는 안내문은 두지 않는다(조작 안내 문구 없음) — 궁금한 사람만 연다.
 */
function PresenterHelp() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <span ref={ref} className='relative inline-flex align-middle'>
      <button
        type='button'
        aria-label='발표 표시 설명'
        aria-expanded={open}
        aria-controls='presenter-help'
        onClick={() => setOpen((v) => !v)}
        className='grid h-6 w-6 place-items-center rounded-full text-fg-muted hover:bg-surface-2 hover:text-fg'
      >
        <CircleHelp size={15} aria-hidden />
      </button>
      {open && (
        <div
          id='presenter-help'
          role='dialog'
          aria-label='발표 표시 설명'
          className='absolute left-0 top-full z-30 mt-1.5 w-72 rounded-card border border-border bg-surface-raised p-3 text-left text-xs font-normal leading-relaxed text-fg-secondary shadow-md'
        >
          <p className='flex items-center gap-1.5 font-semibold text-fg'>
            <span className='relative grid h-8 w-[3.6rem] shrink-0 place-items-center rounded-sm bg-success-100 text-xs font-bold text-success-700'>
              <Mic size={10} strokeWidth={2.5} aria-hidden className='absolute left-0.5 top-0.5 text-brand' />
              출석
            </span>
            칸 왼쪽 위 마이크 = 그 회차 발표자
          </p>
          <ul className='mt-2 list-disc space-y-1 pl-4'>
            <li>일정 탭의 발표자1 · 발표자2에서 가져옵니다. 여기서 따로 입력하지 않습니다.</li>
            <li>발표자를 바꾸면 마이크도 따라 바뀝니다.</li>
            <li>「발표 횟수」는 발표자로 맡은 회차 수입니다. 아직 오지 않은 회차의 배정도 셉니다.</li>
          </ul>
        </div>
      )}
    </span>
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
  title,
  toolbar,
  whenOf,
}: {
  study: Study;
  /** 이름 칸에 쓰는 것만 받는다 — 사용자 사이트는 명부 밖의 「나」도 넣는다. */
  crew: (Pick<Crew, 'id' | 'name'> & {
    role?: 'captain' | 'navigator';
    /** 스터디를 중단한 사람 — 이름을 흐리게, 칩 문구, 중단 일자(이 날 뒤 회차는 「—」·출석률 제외). */
    left?: { label: string; at: string };
    /** 디스코드 서버 별명 — 닉네임 오른쪽 열. 없으면 「—」. */
    discordNickname?: string;
    /** 체크박스로 고를 수 있는 줄 — 출석 일괄 적용 대상. 중단한 줄은 늘 빠진다. */
    manageable?: boolean;
    /** 참여 중단할 수 있는 줄 — 나 · 캡틴 · 네비게이터는 아니다. 고른 사람 중 하나라도 아니면 「참여 중단」이 잠긴다. */
    withdrawable?: boolean;
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
  title?: string;
  toolbar?: ReactNode;
  whenOf?: (meeting: StudyMeeting) => { date: string; time: string };
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
  // 운영진이 섞이면 참여 중단만 막는다 — 출석 일괄 변경은 그대로 된다.
  const blockedNames = crew.filter((c) => selected.includes(c.id) && !c.withdrawable).map((c) => c.name);
  /** 회차 머리 일자 `9/30` — 고른 시간대가 있으면 그 벽시계로. */
  const dayOf = (s: StudyMeeting) => {
    const ymd = whenOf ? whenOf(s).date : s.date;
    return `${Number(ymd.slice(5, 7))}/${ymd.slice(8, 10)}`;
  };
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

  /** 고른 사람들의 한 회차 칸을 같은 값으로 — 상태를 고르는 즉시. 저장 전 변경이다(칸 테두리 강조 · 저장 바). */
  function applyBulk(status: AttendanceStatus | 'clear') {
    if (saving || !meetingId || selected.length === 0) return;
    setAnnounce('');
    setDraft((book) => {
      const next = { ...book };
      for (const id of selected) {
        const row = { ...(next[id] ?? {}) };
        if (status === 'clear') delete row[meetingId];
        else row[meetingId] = status;
        next[id] = row;
      }
      return next;
    });
    const head = meetings.find((s) => s.id === meetingId);
    const label = BULK_OPTIONS.find((o) => o.value === status)?.label ?? '';
    setAnnounce(
      `${selected.length}명의 ${head ? (headOf ? headOf(head) : `${head.no}회`) : ''} 칸을 ${label}(으)로 바꿨습니다. 저장해야 반영됩니다.`,
    );
  }

  /** 고른 사람을 「중단 예정」으로 — 아직 반영하지 않는다. 저장할 때 확인 창을 거친다. */
  function markWithdraw() {
    if (saving || selected.length === 0 || blockedNames.length > 0) return;
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
    const parts = [pending > 0 && `출석 ${pending}칸을 저장`, ids.length > 0 && `${ids.length}명의 참여를 중단`].filter(
      Boolean,
    );
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
          신청자 탭에서 반을 만들고 일정 탭에서 일정을 정하면 그 반의 출석부가 만들어집니다.
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
          <p className='text-sm font-semibold text-fg'>
            {hasSchedule(cls) ? '이 반에는 아직 회차가 없습니다.' : '이 반은 아직 스터디 시간이 없습니다.'}
          </p>
          <p className='mt-1.5 text-sm text-fg-muted'>
            {hasSchedule(cls)
              ? '일정 탭에서 회차를 추가하면 이 반의 출석부가 만들어집니다.'
              : '일정 탭에서 스터디 시간을 정하고 회차를 추가하면 출석부가 만들어집니다.'}
          </p>
          {onAddMeeting && (
            <Button size='sm' className='mt-4' leadingIcon={<CalendarPlus size={15} />} onClick={onAddMeeting}>
              {hasSchedule(cls) ? '회차 추가하러 가기' : '스터디 시간 정하러 가기'}
            </Button>
          )}
        </div>
      ) : (
        <>
          {title && (
            <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
              {/* 제목 옆은 전체 인원만 — 고른 수는 작업 바의 「n명 선택」이 말한다 */}
              <h2 data-anno='book:3-10' className='text-base font-bold'>
                {title}
                <span className='tnum ml-2 text-sm font-medium text-fg-muted'>전체 {crew.length}</span>
                {/* 발표가 표에 섞여 있을 때만 — 마이크 표시가 무엇인지 */}
                {presentersOf && (
                  <span data-anno='book:3-3 attendance:3-6' className='ml-1'>
                    <PresenterHelp />
                  </span>
                )}
              </h2>
              {toolbar}
            </div>
          )}
          {/* overflow-clip — 카드 모서리는 자르되 스크롤 상자는 만들지 않는다. 그래야 작업 바가 화면 위에 붙는다 */}
          <div data-anno='attendance:3' className='card overflow-clip'>
            {/* 표 맨 위 작업 바 — 한 줄. 왼쪽은 고른 크루에 하는 일(출석 일괄 변경 · 참여 중단), 오른쪽은 저장 (POL-0008) */}
            {(selecting || !readOnly) && (
              <TableActionBar
                className='top-[var(--table-action-bar-top,4rem)] bottom-auto border-b border-border bg-surface-raised px-4'
                data-anno='book:3-9'
                selection={
                  selecting ? (
                    <>
                      <SelectionCount count={selected.length} unit='명' />
                      <select
                        aria-label='바꿀 회차'
                        className={SELECT_CLASS}
                        disabled={selected.length === 0}
                        value={meetingId}
                        onChange={(e) => setBulkMeeting(e.target.value)}
                      >
                        {meetings.map((s) => (
                          <option key={s.id} value={s.id}>
                            {`${headOf ? headOf(s) : `${s.no}회`} · ${dayOf(s)}`}
                          </option>
                        ))}
                      </select>
                      {/* 「적용」 버튼 없이 고르는 즉시 바뀐다 — 늘 「출석 상태」로 돌아와 같은 값을 또 고를 수 있다 */}
                      <select
                        aria-label='바꿀 출석 상태'
                        className={SELECT_CLASS}
                        disabled={saving || selected.length === 0}
                        value=''
                        onChange={(e) => e.target.value && applyBulk(e.target.value as AttendanceStatus | 'clear')}
                      >
                        <option value=''>출석 상태</option>
                        {BULK_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        size='sm'
                        variant='danger'
                        onClick={markWithdraw}
                        disabled={saving || selected.length === 0 || blockedNames.length > 0}
                        aria-describedby={blockedNames.length > 0 ? 'withdraw-blocked' : undefined}
                      >
                        참여 중단
                      </Button>
                      {selected.length > 0 && (
                        <Button size='sm' variant='ghost' onClick={() => setPicked(new Set())}>
                          선택 해제
                        </Button>
                      )}
                      {withdrawIds.length > 0 && (
                        // 몇 명이 중단 예정인지는 여기 한 번만 — 줄마다 칩을 붙이지 않는다
                        <span data-anno='book:3-8' className='tnum text-xs font-semibold text-error-700'>
                          중단 예정 {withdrawIds.length}명
                        </span>
                      )}
                      {blockedNames.length > 0 && (
                        // 왜 잠겼는지 버튼 줄 끝에 — 운영진의 역할은 백오피스에서 캡틴이 바꾼다.
                        <span id='withdraw-blocked' data-anno='book:3-12' className='text-xs text-fg-muted'>
                          네비게이터는 참여 중단할 수 없습니다. 캡틴에게 문의하세요.
                        </span>
                      )}
                    </>
                  ) : undefined
                }
                save={
                  readOnly ? undefined : (
                    <>
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
                    </>
                  )
                }
              />
            )}
            {/*
              가로 스크롤은 회차 열만 — 크루 · 발표 횟수는 왼쪽, 출석률은 오른쪽에 고정(sticky)한다.
              table-fixed: 열 너비를 머리 줄이 정한다. 너비가 없는 빈 열(마지막 회차 뒤)이 남는 폭을 다 가져가
              크루와 킥오프 사이는 붙고, 마지막 회차와 출석률 사이가 벌어진다.
            */}
            <div className='overflow-x-auto'>
              <table className='w-full table-fixed border-separate border-spacing-0 text-sm'>
                <thead>
                  <tr>
                    <th
                      data-anno='attendance:3-1'
                      className={`sticky left-0 z-[1] ${NAME_COL} bg-surface-raised px-4 py-3 text-left text-xs font-semibold text-fg-muted`}
                    >
                      <span className='flex items-center gap-3'>
                        {selecting && (
                          <span data-anno='book:3-7' className='flex'>
                            <SelectAll
                              checked={allPicked}
                              partial={selected.length > 0 && !allPicked}
                              onChange={pickAll}
                            />
                          </span>
                        )}
                        닉네임
                      </span>
                    </th>
                    <th
                      className={`sticky ${DISCORD_COL} z-[1] whitespace-nowrap bg-surface-raised px-3 py-3 text-left text-xs font-semibold text-fg-muted`}
                    >
                      디스코드 닉네임
                    </th>
                    {presentersOf && (
                      <th
                        data-anno='attendance:3-5 book:3-5'
                        className={`sticky ${PRESENT_COL} z-[1] whitespace-nowrap bg-surface-raised px-2 py-2 text-center text-[11px] font-semibold text-fg-muted`}
                        title='일정의 발표자1·2로 맡은 횟수'
                      >
                        <span className='sm:hidden'>발표</span>
                        <span className='hidden sm:inline'>발표 횟수</span>
                      </th>
                    )}
                    {meetings.map((s) => (
                      <th
                        key={s.id}
                        data-anno='attendance:3-2'
                        className={`tnum ${MEETING_COL} px-1 py-2 text-center text-[11px] font-semibold text-fg-secondary`}
                      >
                        {headOf ? headOf(s) : `${s.no}회`}
                        {/* 일자만 — 시각은 일정 탭에 있다. 고른 시간대(KST/PDT)의 날짜다 */}
                        <span className='block text-[10px] font-medium text-fg-muted'>{dayOf(s)}</span>
                      </th>
                    ))}
                    <th aria-hidden />
                    <th
                      data-anno='attendance:3-4'
                      className={`sticky right-0 z-[1] ${RATE_COL} whitespace-nowrap bg-surface-raised px-3 py-2 text-center text-xs font-semibold text-fg-muted`}
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
                      ? Object.fromEntries(
                          Object.entries(row).filter(([id]) => !notCounted?.has(id) && !goneIds.has(id)),
                        )
                      : row;
                    const rate = attendanceRate(counted);
                    const presented = presentersOf
                      ? meetings.filter((s) => presentersOf(s.id).includes(c.id)).length
                      : 0;
                    // 중단 예정 — 줄 전체를 옅은 빨강으로. 고정 열도 같은 바탕이어야 줄이 끊겨 보이지 않는다
                    const pendingLeave = withdrawIds.includes(c.id);
                    const rowBg = pendingLeave ? 'bg-error-50' : 'bg-surface-raised';
                    return (
                      <tr key={c.id} className={pendingLeave ? 'bg-error-50' : undefined}>
                        <td
                          // 되돌리기 말풍선이 옆 고정 열(디스코드 닉네임)에 가리지 않게 — 가리키거나 포커스한 동안 이 칸을 위로
                          className={`sticky left-0 z-[1] ${NAME_COL} whitespace-nowrap border-t border-border ${rowBg} px-4 py-1.5 font-semibold ${
                            pendingLeave ? 'focus-within:z-[3] hover:z-[3]' : ''
                          }`}
                        >
                          {/* 동명이인 구분(디스코드 닉네임)이 붙으면 길어진다 — 칸은 고정 폭이고 전체 이름은 가리키면 보인다 */}
                          <span className='flex min-w-0 items-center gap-1.5'>
                            {selecting && (
                              // 고를 수 없는 줄(중단한 사람)도 자리를 비워 이름 열을 맞춘다.
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
                              className={`block min-w-0 truncate ${c.left ? 'font-medium text-fg-muted' : ''}`}
                              title={c.name}
                            >
                              {c.name}
                            </span>
                            {c.left && (
                              <span data-anno='book:3-6' className='shrink-0'>
                                <Badge tone='neutral'>{c.left.label}</Badge>
                              </span>
                            )}
                            {/* 사용자 사이트는 캡틴·네비게이터에 역할 칩을 붙인다. 크루는 칩 없음 */}
                            {c.role && (
                              <Badge tone={c.role} className='shrink-0'>
                                {c.role === 'captain' ? '캡틴' : '네비게이터'}
                              </Badge>
                            )}
                            {pendingLeave && (
                              // 저장 전이라 아직 중단이 아니다 — 칩 없이 되돌리기 아이콘만. 줄 색이 예정임을 말한다.
                              // 가리키면(키보드 포커스도) 바탕 · 아이콘이 진해지고 오른쪽에 「중단 예정 취소」 말풍선 — 브라우저 title 은 늦게 떠서 쓰지 않는다
                              <button
                                type='button'
                                aria-label={`${c.name} 중단 예정 취소`}
                                onClick={() => unmarkWithdraw(c.id)}
                                disabled={saving}
                                className='group relative grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-sm text-error-600 transition-colors hover:bg-error-100 hover:text-error-700 focus-visible:bg-error-100 focus-visible:text-error-700 focus-visible:outline-none focus-visible:shadow-(--ring) active:scale-95 disabled:cursor-default disabled:opacity-50'
                              >
                                <Undo2
                                  size={14}
                                  aria-hidden
                                  className='transition-transform group-hover:-rotate-12 group-focus-visible:-rotate-12'
                                />
                                <span
                                  aria-hidden
                                  className='pointer-events-none absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded-sm bg-fg px-2 py-1 text-xs font-semibold text-bg opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'
                                >
                                  중단 예정 취소
                                </span>
                              </button>
                            )}
                          </span>
                        </td>
                        <td
                          className={`sticky ${DISCORD_COL} z-[1] whitespace-nowrap border-t border-border ${rowBg} px-3 py-1.5 text-fg-secondary`}
                        >
                          {c.discordNickname ? (
                            <span className='block truncate' title={c.discordNickname}>
                              {c.discordNickname}
                            </span>
                          ) : (
                            <span className='block text-center text-fg-muted'>-</span>
                          )}
                        </td>
                        {presentersOf && (
                          <td
                            className={`tnum sticky ${PRESENT_COL} z-[1] border-t border-border ${rowBg} px-2 py-1.5 text-center text-xs font-semibold text-fg-secondary`}
                          >
                            {presented || <span className='text-fg-muted'>0</span>}
                          </td>
                        )}
                        {meetings.map((s) =>
                          gone(s) ? (
                            <td
                              key={s.id}
                              className={`${MEETING_COL} border-t border-border px-1 py-1.5 text-center text-xs text-fg-muted`}
                            >
                              -
                            </td>
                          ) : (
                            <td
                              key={s.id}
                              data-anno='attendance:3-3'
                              className={`${MEETING_COL} border-t border-border px-1 py-1.5`}
                            >
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
                        <td aria-hidden className='border-t border-border' />
                        <td
                          className={`tnum sticky right-0 z-[1] ${RATE_COL} whitespace-nowrap border-t border-border ${rowBg} px-3 py-1.5 text-center font-bold`}
                        >
                          {rate === undefined ? (
                            <span className='text-fg-muted'>-</span>
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
          </div>

          <p className='sr-only' aria-live='polite'>
            {announce}
          </p>

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
                    저장
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
              <li>지금 뒤에 시작하는 회차는 「-」로 비고 출석률에서 빠집니다.</li>
              <li>더는 스터디 디스코드 채널 · 드라이브 링크를 볼 수 없고, 앞으로 맡은 회차의 발표자에서 빠집니다.</li>
              <li>중단한 뒤에는 다시 참여시킬 수 없습니다.</li>
            </ul>
          </Modal>
        </>
      )}
    </div>
  );
}
