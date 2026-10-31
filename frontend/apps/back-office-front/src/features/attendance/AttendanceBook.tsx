'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Badge, Button, Checkbox, Modal, Select, SelectionCount, TableActionBar } from '@studyclub/ui';
import { CircleHelp, Mic, Undo2 } from 'lucide-react';

import { attendanceRateOf, changedCount, cloneBook, nextStatus, STATUS_LABEL } from './book';
import type { AttendanceBook as Book, AttendanceStatus } from '@/features/schedule/store';

/**
 * 출석부 — 크루 × 회차 격자. 명세: playground `console/studies/[id]/spec.ts` 의 `ATTENDANCE_SPEC`.
 * playground `proto/console/components/AttendanceTab.tsx` 를 옮긴 것이다 — 사용자 사이트 출석부와 같은 화면이다.
 *
 * 지금까지 구글시트로 하던 일이라 **시트와 같은 모양**을 유지한다. 화면은 이 격자 하나뿐 —
 * 회차별 화면을 따로 두면 한 사람이 몇 번 빠졌는지 보려면 회차를 하나씩 열어야 한다.
 *
 * 칸을 눌러도 저장하지 않는다. 여러 칸을 고친 뒤 **저장**을 눌러 한 번에 반영한다.
 * 출석률은 서버 값(`attendanceRate`)을 보인다. 칸을 고친 줄만 화면에서 다시 계산한다 — 저장 전 미리보기다.
 * 미리보기의 분모는 **체크된 정규 회차만**이고, 시작 전 회차는 빠진다 (서버 산식과 같게).
 * 머리 줄 · 진행 기간 · 조작 안내 · 결과 문구는 두지 않는다 — 탭 이름과 표가 이미 말해 준다.
 * 크루 · 발표 횟수(왼쪽)와 출석률(오른쪽)은 고정하고 회차 열만 가로로 스크롤한다. 회차 칸 너비는 모두 같다.
 */

/** 출석부 한 줄. */
export type BookRow = {
  id: string;
  name: string;
  /** 디스코드 서버 별명 — 닉네임 오른쪽 열. 없으면 「-」. */
  discordNickname: string | null;
  role?: 'navigator';
  /** 참여 중단 시각(UTC ISO). 이 뒤에 시작하는 회차는 「-」 · 출석률 제외. */
  leftAt?: string;
  /** 서버 출석률(0 ~ 1). null 은 분모 0 — 「-」. 고친 칸이 없는 줄은 이 값을 보인다. */
  serverRate?: number | null;
};

/** 출석부 한 열. */
export type BookColumn = {
  id: string;
  /** 「킥오프」 · 「3회」. */
  head: string;
  /** 머리 아래 일자 「9/30」 — 고른 시간대의 날짜. */
  day: string;
  /** UTC ISO — 중단 시각과 견준다. */
  scheduledAt: string;
  /** 출석률에 넣지 않는 회차(킥오프). 칸은 보이고 체크도 한다. */
  notCounted?: boolean;
  /** 그 회차 발표자 — 칸에 마이크, 이름 옆 발표 횟수. 일정 탭의 발표자1·2가 정본이다. */
  presenters: string[];
};

const CELL_STYLE: Record<AttendanceStatus, string> = {
  present: 'bg-success-100 text-success-700',
  late: 'bg-warning-100 text-warning-700',
  absent: 'bg-error-50 text-error-700',
  excused: 'bg-surface-2 text-fg-secondary',
};

/** 고친 칸의 테두리 — 사이트 포인트 색이 아니라 그 칸의 상태 색. 미체크로 바꾼 칸은 회색. */
const CHANGED_RING: Record<AttendanceStatus, string> = {
  present: 'ring-success-700',
  late: 'ring-warning-700',
  absent: 'ring-error-700',
  excused: 'ring-fg-secondary',
};

/** 일괄 변경에서 고르는 상태. `clear` 는 미체크(칸 비우기). */
const BULK_OPTIONS: { value: AttendanceStatus | 'clear'; label: string }[] = [
  { value: 'present', label: '출석' },
  { value: 'late', label: '지각' },
  { value: 'absent', label: '결석' },
  { value: 'excused', label: '휴가' },
  { value: 'clear', label: '미체크' },
];

/**
 * 열 너비 — table-fixed 라 머리 줄 너비가 곧 열 너비다. 고정 열(sticky)의 left 는 앞 열 너비와 같아야 한다.
 * 휴대폰에서는 고정 열을 좁혀 회차 칸이 두세 개는 보이게 하고, 디스코드 닉네임 열은 숨긴다.
 */
const NAME_COL = 'w-28 sm:w-44';
const DISCORD_COL = 'hidden sm:table-cell sm:left-44 sm:w-44';
const PRESENT_COL = 'left-28 w-12 sm:left-88 sm:w-16';
const MEETING_COL = 'w-[3.6rem]';
const RATE_COL = 'w-14 sm:w-20';
/**
 * 「디스코드 닉네임」 머리글 글자의 너비 — 닉네임이 없는 줄의 「-」를 이 너비 안 가운데에 둬 머리글 가운데 아래에 오게 한다.
 * 열 전체로 가운데에 두면 왼쪽 정렬된 닉네임들과 떨어져 머리글 오른쪽 끝 아래로 보인다.
 */
const DISCORD_LABEL = 'inline-block w-[5.5rem]';

function Cell({
  status,
  changed,
  onClick,
  presenting,
}: {
  status: AttendanceStatus | undefined;
  changed: boolean;
  onClick: () => void;
  presenting: boolean;
}) {
  const label = `${status ? STATUS_LABEL[status] : '미체크'}${presenting ? ' · 발표' : ''}`;
  return (
    <button
      type='button'
      onClick={onClick}
      aria-label={changed ? `${label} · 저장되지 않음` : label}
      // 가리킬 때는 조작 방법만 — 저장 상태는 테두리가 보여 준다(스크린리더는 aria-label 로 듣는다)
      title='눌러서 출석 → 지각 → 결석 → 휴가 → 미체크'
      className={`relative h-8 w-full rounded-sm type-label-lg transition-colors ${
        status ? CELL_STYLE[status] : 'bg-surface-1 text-fg-muted hover:bg-surface-2'
      } ${changed ? `ring-2 ${status ? CHANGED_RING[status] : 'ring-border-strong'}` : ''}`}
    >
      {presenting && <Mic size={10} strokeWidth={2.5} aria-hidden className='absolute left-0.5 top-0.5 text-brand' />}
      {status ? STATUS_LABEL[status] : ''}
    </button>
  );
}

/** 제목 옆 「?」 — 칸 왼쪽 위 마이크가 무엇인지. 누르면 열고, 바깥 · Esc 로 닫는다. */
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
          className='absolute -left-24 top-full z-30 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface-raised p-3 text-left type-label-sm text-fg-secondary shadow-md sm:left-0'
        >
          <p className='flex items-center gap-1.5 font-semibold text-fg'>
            <span className='relative grid h-8 w-[3.6rem] shrink-0 place-items-center rounded-sm bg-success-100 type-label-lg text-success-700'>
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

/**
 * 작업 바의 일괄 변경 드롭다운 — 「적용」 버튼 없이 고르면 반영한다 (POL-0008).
 *
 * 접힌 네이티브 select 는 화살표 키를 누를 때마다 change 를 낸다(Windows). 그때마다 반영하면
 * 키보드로 목록을 훑기만 해도 첫 항목이 고른 사람 전원에게 얹힌다. 그래서 마우스로 고르면 바로,
 * 키보드로 옮기는 동안은 보이기만 하고 Enter 를 누르거나 칸을 떠날 때 반영한다.
 * 반영하면 처음 글로 돌아온다 — 같은 값을 또 고를 수 있다.
 */
function BulkSelect({
  label,
  placeholder,
  options,
  disabled,
  onPick,
}: {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled: boolean;
  onPick: (value: string) => void;
}) {
  const [pending, setPending] = useState('');
  const keyboard = useRef(false);
  function commit(v: string) {
    setPending('');
    if (v) onPick(v);
  }
  return (
    <Select
      size='sm'
      aria-label={label}
      disabled={disabled}
      value={pending}
      onPointerDown={() => {
        keyboard.current = false;
      }}
      onKeyDown={(e) => {
        keyboard.current = true;
        if (e.key === 'Enter') {
          e.preventDefault();
          commit(pending);
        }
        // Esc 는 미리 본 값을 버린다 — 떠날 때 확정되지 않게
        if (e.key === 'Escape') setPending('');
      }}
      onChange={(e) => (keyboard.current ? setPending(e.target.value) : commit(e.target.value))}
      onBlur={() => pending && commit(pending)}
    >
      <option value=''>{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

export function AttendanceBook({
  rows,
  columns,
  attendance,
  onSave,
  onDirtyChange,
  toolbar,
}: {
  /** 참여 중인 사람이 먼저, 중단한 사람은 맨 아래. */
  rows: BookRow[];
  /** 킥오프가 맨 앞, 정규 회차는 일정순. */
  columns: BookColumn[];
  /** 저장된 출석. */
  attendance: Book;
  /** 출석과 참여 중단을 한 번에 — 서버는 한 트랜잭션이다. */
  onSave: (next: Book, withdrawIds: string[]) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** 제목 줄 오른쪽 — KST/PDT. */
  toolbar: ReactNode;
}) {
  const [draft, setDraft] = useState(() => cloneBook(attendance));
  /** 결과 문구는 화면에 두지 않는다. 스크린리더만 저장 결과를 듣는다. */
  const [announce, setAnnounce] = useState('');
  /** 「중단 예정」 — 저장할 때 출석과 함께 참여 중단으로 반영된다. */
  const [toWithdraw, setToWithdraw] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [bulkColumn, setBulkColumn] = useState('');

  useEffect(() => {
    setDraft(cloneBook(attendance));
  }, [attendance]);

  const columnIds = columns.map((c) => c.id);
  const pending = changedCount(draft, attendance, columnIds);
  // 중단된 뒤 목록에서 빠진 사람은 예정에서도 뺀다
  const withdrawIds = rows.filter((r) => !r.leftAt && toWithdraw.has(r.id)).map((r) => r.id);
  const withdrawNames = rows.filter((r) => withdrawIds.includes(r.id)).map((r) => r.name);
  const dirty = pending > 0 || withdrawIds.length > 0;

  const selectable = rows.filter((r) => !r.leftAt).map((r) => r.id);
  const selected = selectable.filter((id) => picked.has(id));
  const allPicked = selectable.length > 0 && selected.length === selectable.length;
  // 네비게이터가 섞이면 참여 중단만 막는다 — 출석 일괄 변경은 그대로 된다
  const blocked = rows.some((r) => selected.includes(r.id) && r.role === 'navigator');
  // 일괄 적용 회차 — 고르지 않았으면 이미 시작한 마지막 회차(방금 끝난 회차)를 먼저 둔다
  const nowIso = new Date().toISOString();
  const defaultColumn = [...columns].reverse().find((c) => c.scheduledAt <= nowIso)?.id ?? columns[0]?.id ?? '';
  const columnId = columnIds.includes(bulkColumn) ? bulkColumn : defaultColumn;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  function pick(id: string) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggle(rowId: string, colId: string) {
    setAnnounce('');
    setDraft((book) => {
      const row = { ...(book[rowId] ?? {}) };
      const next = nextStatus(row[colId]);
      if (next === undefined) delete row[colId];
      else row[colId] = next;
      return { ...book, [rowId]: row };
    });
  }

  /** 고른 사람들의 한 회차 칸을 같은 값으로 — 상태를 고르는 즉시. 저장 전 변경이다. */
  function applyBulk(status: AttendanceStatus | 'clear') {
    if (!columnId || selected.length === 0) return;
    setDraft((book) => {
      const next = { ...book };
      for (const id of selected) {
        const row = { ...(next[id] ?? {}) };
        if (status === 'clear') delete row[columnId];
        else row[columnId] = status;
        next[id] = row;
      }
      return next;
    });
    const head = columns.find((c) => c.id === columnId)?.head ?? '';
    const label = BULK_OPTIONS.find((o) => o.value === status)?.label ?? '';
    setAnnounce(`${selected.length}명의 ${head} 칸을 ${label}(으)로 바꿨습니다. 저장해야 반영됩니다.`);
  }

  /** 고른 사람을 「중단 예정」으로 — 아직 반영하지 않는다. 저장할 때 확인 창을 거친다. */
  function markWithdraw() {
    if (selected.length === 0 || blocked) return;
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

  /** 중단 예정이 있으면 확인 창부터 — 되돌릴 수 없는 일이 저장에 섞여 있다. */
  function requestSave() {
    if (!dirty) return;
    if (withdrawIds.length > 0) setConfirming(true);
    else save();
  }

  function save() {
    setConfirming(false);
    onSave(cloneBook(draft), withdrawIds);
    setToWithdraw(new Set());
    const parts = [
      pending > 0 && `출석 ${pending}칸을 저장`,
      withdrawIds.length > 0 && `${withdrawIds.length}명의 참여를 중단`,
    ].filter(Boolean);
    setAnnounce(`${parts.join('하고 ')}했습니다.`);
  }

  function revert() {
    setToWithdraw(new Set());
    setDraft(cloneBook(attendance));
  }

  return (
    <>
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        {/* 제목 옆은 전체 인원만 — 고른 수는 작업 바의 「n명 선택」이 말한다 */}
        <h2 className='type-title-md'>
          출석
          <span className='tnum ml-2 type-label-lg text-fg-muted'>전체 {rows.length}</span>
          <span className='ml-1'>
            <PresenterHelp />
          </span>
        </h2>
        {toolbar}
      </div>

      {/* overflow-clip — 카드 모서리는 자르되 스크롤 상자는 만들지 않는다. 그래야 작업 바가 화면 위에 붙는다 */}
      <div className='card overflow-clip'>
        {/* 표 맨 위 작업 바 — 왼쪽은 고른 크루에 하는 일(출석 일괄 변경 · 참여 중단), 오른쪽은 저장 (POL-0008) */}
        <TableActionBar
          className='top-[var(--table-action-bar-top,4rem)] bottom-auto border-b border-border bg-surface-raised px-4'
          selection={
            <>
              <SelectionCount count={selected.length} unit='명' />
              <Select
                size='sm'
                aria-label='바꿀 회차'
                disabled={selected.length === 0}
                value={columnId}
                onChange={(e) => setBulkColumn(e.target.value)}
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {`${c.head} · ${c.day}`}
                  </option>
                ))}
              </Select>
              <BulkSelect
                label='바꿀 출석 상태'
                placeholder='출석 상태'
                options={BULK_OPTIONS}
                disabled={selected.length === 0}
                onPick={(v) => applyBulk(v as AttendanceStatus | 'clear')}
              />
              <Button
                size='sm'
                variant='danger'
                onClick={markWithdraw}
                disabled={selected.length === 0 || blocked}
                aria-describedby={blocked ? 'withdraw-blocked' : undefined}
              >
                참여 중단
              </Button>
              {selected.length > 0 && (
                <Button size='sm' variant='tertiary' onClick={() => setPicked(new Set())}>
                  선택 해제
                </Button>
              )}
              {withdrawIds.length > 0 && (
                // 몇 명이 중단 예정인지는 여기 한 번만 — 줄마다 칩을 붙이지 않는다
                <span className='tnum type-label-sm text-error-700'>중단 예정 {withdrawIds.length}명</span>
              )}
              {blocked && (
                <span id='withdraw-blocked' className='type-label-sm text-fg-muted'>
                  네비게이터는 참여 중단할 수 없습니다. 캡틴에게 문의하세요.
                </span>
              )}
            </>
          }
          save={
            <>
              {dirty && (
                <Button variant='tertiary' size='sm' onClick={revert}>
                  변경 취소
                </Button>
              )}
              <Button size='sm' onClick={requestSave} disabled={!dirty}>
                저장
              </Button>
            </>
          }
        />
        {/*
          가로 스크롤은 회차 열만 — 크루 · 발표 횟수는 왼쪽, 출석률은 오른쪽에 고정(sticky)한다.
          table-fixed: 열 너비를 머리 줄이 정한다. 너비가 없는 빈 열(마지막 회차 뒤)이 남는 폭을 다 가져가
          크루와 킥오프 사이는 붙고, 마지막 회차와 출석률 사이가 벌어진다.
        */}
        <div className='overflow-x-auto'>
          <table className='w-full table-fixed border-separate border-spacing-0 type-body-sm'>
            <thead>
              <tr>
                <th
                  className={`sticky left-0 z-[1] ${NAME_COL} bg-surface-raised px-4 py-3 text-left type-label-sm text-fg-muted`}
                >
                  <span className='flex items-center gap-3'>
                    <Checkbox
                      label=''
                      aria-label='전체 선택'
                      checked={allPicked}
                      disabled={selectable.length === 0}
                      indeterminate={selected.length > 0 && !allPicked}
                      onChange={() => setPicked(allPicked ? new Set() : new Set(selectable))}
                    />
                    닉네임
                  </span>
                </th>
                <th
                  className={`sticky ${DISCORD_COL} z-[1] whitespace-nowrap bg-surface-raised px-3 py-3 text-left type-label-sm text-fg-muted`}
                >
                  <span className={DISCORD_LABEL}>디스코드 닉네임</span>
                </th>
                <th
                  className={`sticky ${PRESENT_COL} z-[1] whitespace-nowrap bg-surface-raised px-2 py-2 text-center type-label-sm text-fg-muted`}
                  title='일정의 발표자1·2로 맡은 횟수'
                >
                  <span className='sm:hidden'>발표</span>
                  <span className='hidden sm:inline'>발표 횟수</span>
                </th>
                {columns.map((c) => (
                  <th
                    key={c.id}
                    className={`tnum ${MEETING_COL} px-1 py-2 text-center type-label-sm text-fg-secondary`}
                  >
                    {c.head}
                    {/* 일자만 — 시각은 일정 탭에 있다. 고른 시간대(KST/PDT)의 날짜다 */}
                    <span className='block type-label-sm text-fg-muted'>{c.day}</span>
                  </th>
                ))}
                <th aria-hidden />
                <th
                  className={`sticky right-0 z-[1] ${RATE_COL} whitespace-nowrap bg-surface-raised px-3 py-2 text-center type-label-sm text-fg-muted`}
                >
                  출석률
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                // 중단한 사람은 중단 시각 뒤에 시작한 회차를 칸에서 비우고 출석률에서도 뺀다
                const gone = (c: BookColumn) => Boolean(r.leftAt && c.scheduledAt > r.leftAt);
                // 고친 칸이 없으면 서버 값 — 산식은 서버가 정본이다. 고쳤으면 시작한 회차만으로 미리 계산한다
                const edited = columnIds.some((id) => draft[r.id]?.[id] !== attendance[r.id]?.[id]);
                const rate =
                  !edited && r.serverRate !== undefined
                    ? r.serverRate === null
                      ? undefined
                      : Math.round(r.serverRate * 100)
                    : attendanceRateOf(
                        draft[r.id],
                        columns.filter((c) => !c.notCounted && !gone(c) && c.scheduledAt <= nowIso).map((c) => c.id),
                      );
                const presented = columns.filter((c) => c.presenters.includes(r.id)).length;
                // 중단 예정 — 줄 전체를 옅은 빨강으로. 고정 열도 같은 바탕이어야 줄이 끊겨 보이지 않는다
                const pendingLeave = withdrawIds.includes(r.id);
                const rowBg = pendingLeave ? 'bg-error-50' : 'bg-surface-raised';
                return (
                  <tr key={r.id} className={pendingLeave ? 'bg-error-50' : undefined}>
                    <td
                      // 되돌리기 말풍선이 옆 고정 열에 가리지 않게 — 가리키거나 포커스한 동안 이 칸을 위로
                      className={`sticky left-0 z-[1] ${NAME_COL} whitespace-nowrap border-t border-border ${rowBg} px-4 py-1.5 font-semibold ${
                        pendingLeave ? 'focus-within:z-[3] hover:z-[3]' : ''
                      }`}
                    >
                      <span className='flex min-w-0 items-center gap-1.5'>
                        {/* 고를 수 없는 줄(중단한 사람)도 자리를 비워 이름 열을 맞춘다 */}
                        <span className='mr-1.5 flex w-4 shrink-0'>
                          {!r.leftAt && (
                            <Checkbox
                              label=''
                              aria-label={`${r.name} 선택`}
                              checked={picked.has(r.id)}
                              onChange={() => pick(r.id)}
                            />
                          )}
                        </span>
                        {/* 휴대폰 폭에서는 디스코드 닉네임 열을 숨기는 대신 닉네임 아래에 작게 둔다 — 동명이인을 가른다 */}
                        <span className={`min-w-0 ${r.leftAt ? 'font-medium text-fg-muted' : ''}`}>
                          <span className='block truncate' title={r.name}>
                            {r.name}
                          </span>
                          {r.discordNickname && (
                            <span className='block truncate type-label-sm text-fg-muted sm:hidden'>
                              {r.discordNickname}
                            </span>
                          )}
                        </span>
                        {/* 칩은 휴대폰 폭에서 화면에서만 숨긴다 — 스크린리더는 역할 · 참여 중단을 그대로 듣는다 */}
                        {r.leftAt && (
                          <span className='sr-only shrink-0 sm:not-sr-only sm:inline-flex'>
                            <Badge tone='neutral'>참여 중단</Badge>
                          </span>
                        )}
                        {r.role === 'navigator' && (
                          <span className='sr-only shrink-0 sm:not-sr-only sm:inline-flex'>
                            <Badge tone='navigator'>네비게이터</Badge>
                          </span>
                        )}
                        {pendingLeave && (
                          // 저장 전이라 아직 중단이 아니다 — 칩 없이 되돌리기 아이콘만. 줄 색이 예정임을 말한다
                          <button
                            type='button'
                            aria-label={`${r.name} 중단 예정 취소`}
                            onClick={() => unmarkWithdraw(r.id)}
                            className='group relative grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-sm text-error-600 transition-colors hover:bg-error-100 hover:text-error-700 focus-visible:bg-error-100 focus-visible:text-error-700 focus-visible:outline-none focus-visible:shadow-(--ring) active:scale-95'
                          >
                            <Undo2
                              size={14}
                              aria-hidden
                              className='transition-transform group-hover:-rotate-12 group-focus-visible:-rotate-12'
                            />
                            <span
                              aria-hidden
                              className='pointer-events-none absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded-sm bg-fg px-2 py-1 type-label-sm text-bg opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'
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
                      {r.discordNickname ? (
                        <span className='block truncate' title={r.discordNickname}>
                          {r.discordNickname}
                        </span>
                      ) : (
                        <span className={`${DISCORD_LABEL} text-center text-fg-muted`}>-</span>
                      )}
                    </td>
                    <td
                      className={`tnum sticky ${PRESENT_COL} z-[1] border-t border-border ${rowBg} px-2 py-1.5 text-center type-label-sm text-fg-secondary`}
                    >
                      {presented || <span className='text-fg-muted'>0</span>}
                    </td>
                    {columns.map((c) =>
                      gone(c) ? (
                        <td
                          key={c.id}
                          className={`${MEETING_COL} border-t border-border px-1 py-1.5 text-center type-label-sm text-fg-muted`}
                        >
                          {/* 출석 칸(h-8)과 같은 높이 — 중단한 줄만 낮아지지 않게 */}
                          <span className='grid h-8 place-items-center'>-</span>
                        </td>
                      ) : (
                        <td key={c.id} className={`${MEETING_COL} border-t border-border px-1 py-1.5`}>
                          <Cell
                            status={draft[r.id]?.[c.id]}
                            changed={draft[r.id]?.[c.id] !== attendance[r.id]?.[c.id]}
                            onClick={() => toggle(r.id, c.id)}
                            presenting={c.presenters.includes(r.id)}
                          />
                        </td>
                      ),
                    )}
                    <td aria-hidden className='border-t border-border' />
                    <td
                      className={`tnum sticky right-0 z-[1] ${RATE_COL} whitespace-nowrap border-t border-border ${rowBg} px-3 py-1.5 text-center font-semibold`}
                    >
                      {rate === undefined ? (
                        <span className='text-fg-muted'>-</span>
                      ) : (
                        <span
                          className={
                            // 참여를 끝낸 사람의 출석률은 회색 — 지금 관리할 대상이 아니다
                            r.leftAt
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

      {/* 결정을 묻는 모달 — 취소가 기본 포커스 (POL-0008) */}
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
            <Button variant='secondary' data-autofocus onClick={() => setConfirming(false)}>
              취소
            </Button>
            <Button variant='destructive' onClick={save}>
              저장
            </Button>
          </>
        }
      >
        <p className='mb-3 type-body-sm text-fg'>
          <span className='font-semibold'>참여 중단</span> {withdrawNames.join(', ')}
          {pending > 0 && (
            <>
              <br />
              <span className='font-semibold'>출석</span> {pending}칸
            </>
          )}
        </p>
        <ul className='list-disc space-y-1 pl-5 type-body-sm text-fg-secondary'>
          <li>지금까지의 출석 기록은 그대로 남습니다.</li>
          <li>지금 뒤에 시작하는 회차는 「-」로 비고 출석률에서 빠집니다.</li>
          <li>더는 스터디 디스코드 채널 · 드라이브 링크를 볼 수 없고, 앞으로 맡은 회차의 발표자에서 빠집니다.</li>
          <li>중단한 뒤에는 다시 참여시킬 수 없습니다.</li>
        </ul>
      </Modal>
    </>
  );
}
