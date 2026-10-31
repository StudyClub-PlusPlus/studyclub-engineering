'use client';

import { useEffect, useRef, useState } from 'react';

import type { Study } from '@studyclub/mock';
import { Badge, Button, Modal, Select, SelectionCount, TableActionBar } from '@studyclub/ui';
import { useQueryClient } from '@tanstack/react-query';
import { CircleHelp, Mic, Undo2 } from 'lucide-react';

import { BulkSelect } from '@/components/BulkSelect';
import { STATUS_LABEL, STATUS_STYLE, type MyStatus } from '@/lib/attendance';
import { getUser } from '@/lib/auth';
import { saveStudyAttendance, type ApiAttendance, type ApiMeetingList } from '@/lib/joined-detail-api';
import { wallParts, type NavigatorGroup } from '@/lib/meetings';
import { scheduleZoneTitle } from '@/lib/schedule-timezone';
import { useDisplayTimeZone } from '@/lib/use-display-timezone';

const STATUS_RING: Record<MyStatus, string> = {
  present: 'ring-success-700',
  late: 'ring-warning-700',
  absent: 'ring-error-700',
  excused: 'ring-fg-secondary',
};

function nextStatus(cur: MyStatus | undefined): MyStatus | undefined {
  if (cur === undefined) return 'present';
  if (cur === 'present') return 'late';
  if (cur === 'late') return 'absent';
  if (cur === 'absent') return 'excused';
  return undefined;
}

function calcRate(row: Record<string, MyStatus | undefined> | undefined, skipIds: Set<string>): number | undefined {
  if (!row) return undefined;
  let scored = 0;
  let total = 0;
  for (const [id, st] of Object.entries(row)) {
    if (!st || skipIds.has(id) || st === 'excused') continue;
    total += 1;
    if (st === 'present') scored += 1;
    else if (st === 'late') scored += 0.5;
  }
  return total === 0 ? undefined : Math.round((scored / total) * 100);
}

/**
 * 응답 → 출석 칸. 미입력(null) 칸과 **시작 전 회차의 결석** 칸은 비운다 — 서버는 회차를 추가할 때 시작 전 회차에도
 * 결석(`ABSENT`)을 미리 만든다. 비운 칸은 키를 두지 않아 미체크로 그려지고 출석률에서도 빠진다.
 * 백오피스 출석부(`back-office-front/src/features/attendance/api.ts` toBook)와 같은 규칙.
 */
function buildCells(
  data: ApiAttendance | undefined,
  now: Date = new Date(),
): Record<string, Record<string, MyStatus | undefined>> {
  const upcoming = new Set(
    (data?.meetings ?? []).filter((m) => Date.parse(m.scheduledAt) > now.getTime()).map((m) => m.id),
  );
  return Object.fromEntries(
    (data?.participants ?? []).map((p) => [
      String(p.participantId),
      Object.fromEntries(
        p.attendances.flatMap((a) =>
          a.status && !(a.status === 'ABSENT' && upcoming.has(a.meetingId))
            ? [[String(a.meetingId), a.status.toLowerCase() as MyStatus]]
            : [],
        ),
      ),
    ]),
  );
}

function countChangedCells(
  a: Record<string, Record<string, MyStatus | undefined>>,
  b: Record<string, Record<string, MyStatus | undefined>>,
): number {
  let n = 0;
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const id of ids) {
    const left = a[id] ?? {};
    const right = b[id] ?? {};
    const mids = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const mid of mids) {
      if (left[mid] !== right[mid]) n++;
    }
  }
  return n;
}

const CHECKBOX =
  'h-4 w-4 shrink-0 cursor-pointer rounded-xs border-border-strong accent-(--color-brand) focus-visible:outline-none focus-visible:shadow-(--ring)';

/**
 * 열 너비 — 머리 줄과 본문 줄이 같은 값을 써야 열이 맞는다.
 * 닉네임 · 디스코드 닉네임 · 발표 횟수(왼쪽)와 출석률(오른쪽)은 고정, 회차 열만 가로로 스크롤한다 (10-18 D5).
 * 휴대폰에서는 디스코드 닉네임 열을 숨기고 닉네임 아래에 작게 둔다 — 고정 열이 화면을 다 차지하지 않게.
 */
// 넓은 화면 닉네임 열은 「네비게이터」 칩이 붙어도 닉네임 다섯 글자가 보이는 폭
const NAME_COL = 'w-[110px] min-w-[110px] max-w-[110px] sm:w-52 sm:min-w-52 sm:max-w-52';
const DISCORD_COL = 'hidden sm:flex sm:w-44 sm:min-w-44 sm:max-w-44';
const PRESENT_COL = 'w-9 min-w-9 max-w-9 sm:w-16 sm:min-w-16 sm:max-w-16';
/** 회차 칸 — 상태와 상관없이 모두 같은 너비(중단 뒤 「-」 칸 포함). */
const MEETING_COL = 'w-11 min-w-11 shrink-0 px-0.5 sm:w-15 sm:min-w-15 sm:px-1';
const RATE_COL = 'w-12 min-w-12 max-w-12 sm:w-20 sm:min-w-20 sm:max-w-20';

/** 일괄 변경에서 고르는 상태. `clear` 는 미체크(칸 비우기). */
const BULK_OPTIONS: { value: MyStatus | 'clear'; label: string }[] = [
  { value: 'present', label: '출석' },
  { value: 'late', label: '지각' },
  { value: 'absent', label: '결석' },
  { value: 'excused', label: '휴가' },
  { value: 'clear', label: '미체크' },
];

/**
 * 출석 제목 옆 「?」 — 칸 왼쪽 위 마이크가 무엇인지 알려 준다 (10-18 D9). 누르면 열고, 바깥 · Esc 로 닫는다.
 * 늘 펼쳐 두는 안내문은 두지 않는다 — 궁금한 사람만 연다. 휴대폰 폭에서 화면 밖으로 나가지 않게 폭 상한을 둔다.
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
          className='absolute -left-24 top-full z-30 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-card border border-border bg-surface-raised p-3 text-left type-label-sm text-fg-secondary shadow-md sm:left-0'
        >
          <p className='flex items-center gap-1.5 font-semibold text-fg'>
            <span className='relative grid h-8 w-14 shrink-0 place-items-center rounded-sm bg-success-100 type-label-sm text-success-700'>
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

type Person = {
  id: string;
  name: string;
  /** 디스코드 서버 별명 — 닉네임 오른쪽 열(휴대폰은 닉네임 아래). 없으면 「-」. */
  discordNickname: string | null;
  me?: boolean;
  role?: 'captain' | 'navigator';
  leftAt: string | null;
  manageable: boolean;
  withdrawable: boolean;
};

type Meeting = {
  /** 출석 API 의 회차 ID — 칸 조회 · 저장 키. */
  id: string;
  /** 일정 API 의 같은 회차 ID — 발표자를 찾을 때 쓴다. 두 API 의 ID 가 다를 수 있다. */
  scheduleId?: string;
  no: number;
  scheduledAt: string;
  kickoff: boolean;
};

/** 두 API 가 같은 시각을 다른 표기(`Z` · `+09:00`)로 줄 수 있어 시각 값으로 견준다. */
const sameInstant = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

export function AttendanceTabContent({
  groupId,
  group,
  meetingData,
  attendanceData,
  refetchAttendance,
  canEdit,
}: {
  study: Study;
  groupId: number;
  group: NavigatorGroup;
  meetingData?: ApiMeetingList;
  attendanceData?: ApiAttendance;
  refetchAttendance: () => Promise<unknown>;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const zone = useDisplayTimeZone();

  // attendance API 와 meetings API 가 서로 다른 meeting ID를 쓸 수 있으므로,
  // 셀 조회 키(id)는 attendance API 기준으로 맞추고, 회차 번호·킥오프는 scheduledAt 으로 매칭한다.
  const meetings: Meeting[] = (attendanceData?.meetings ?? [])
    .slice()
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    .map((am) => {
      const mm = meetingData?.meetings.find((m) => sameInstant(m.scheduledAt, am.scheduledAt));
      return {
        id: String(am.id),
        scheduleId: mm ? String(mm.id) : undefined,
        no: mm?.number ?? 0,
        scheduledAt: am.scheduledAt,
        kickoff: mm?.type === 'KICKOFF' || mm?.number === 0,
      };
    });

  const myParticipantId = meetingData?.me.participantId;
  const sessionUser = getUser();
  const myName = sessionUser?.nickname;

  const isMe = (p: { participantId: number; displayName: string }) =>
    (myParticipantId != null && p.participantId === myParticipantId) || (myName ? p.displayName === myName : false);

  const people: Person[] = (attendanceData?.participants ?? [])
    .map((p) => {
      const me = Boolean(isMe(p));
      return {
        id: String(p.participantId),
        name: p.displayName,
        discordNickname: p.discordNickname ?? null,
        me,
        role: p.captain
          ? ('captain' as const)
          : p.participantRole?.toLowerCase() === 'leader'
            ? ('navigator' as const)
            : undefined,
        leftAt: p.leftAt,
        manageable: p.participantStatus === 'ACTIVE',
        withdrawable: !me && !p.captain && p.participantRole?.toLowerCase() !== 'leader',
      };
    })
    .sort((a, b) => {
      if (a.me && !b.me) return -1;
      if (!a.me && b.me) return 1;
      return (a.leftAt ? 1 : 0) - (b.leftAt ? 1 : 0);
    });

  const kickoffIds = new Set(meetings.filter((m) => m.kickoff).map((m) => m.id));

  const [cells, setCells] = useState(() => buildCells(attendanceData));
  const [savedCells, setSavedCells] = useState(cells);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [toWithdraw, setToWithdraw] = useState<Set<string>>(() => new Set());
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkMeeting, setBulkMeeting] = useState('');
  const [announce, setAnnounce] = useState<string | null>(null);

  const headerMiddleRef = useRef<HTMLDivElement>(null);
  const rowMiddleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const proxyRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  /** 회차 열 전체 너비 — 아래 가로 스크롤바의 내용 폭을 여기에 맞춰야 끝까지 스크롤된다. */
  const [stripWidth, setStripWidth] = useState(0);

  useEffect(() => {
    const el = headerMiddleRef.current;
    if (!el) return;
    const check = () => {
      setHasOverflow(el.scrollWidth > el.clientWidth);
      setStripWidth(el.scrollWidth);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [meetings.length]);

  function updateScroll(scrollLeft: number, source: HTMLDivElement) {
    [headerMiddleRef.current, ...rowMiddleRefs.current, proxyRef.current]
      .filter((el): el is HTMLDivElement => !!el && el !== source)
      .forEach((el) => {
        el.scrollLeft = scrollLeft;
      });
  }

  useEffect(() => {
    if (!attendanceData) return;
    const next = buildCells(attendanceData);
    setCells(next);
    setSavedCells(next);
  }, [attendanceData]);

  const selectable = canEdit ? people.filter((p) => p.manageable && !p.leftAt).map((p) => p.id) : [];
  const selected = selectable.filter((id) => picked.has(id));
  const allPicked = selectable.length > 0 && selected.length === selectable.length;
  const blockedNames = people.filter((p) => selected.includes(p.id) && !p.withdrawable).map((p) => p.name);

  const withdrawIds = people.filter((p) => !p.leftAt && toWithdraw.has(p.id)).map((p) => p.id);
  const withdrawNames = people.filter((p) => withdrawIds.includes(p.id)).map((p) => p.name);

  const pendingCount = countChangedCells(cells, savedCells);
  const dirty = pendingCount > 0 || withdrawIds.length > 0;

  /** 그 회차 발표자 — 칸 키는 출석 API ID 라서 일정 API 의 같은 회차(scheduleId)로 찾아간다. */
  const presentersOf = (meetingId: string): string[] => {
    const scheduleId = meetings.find((x) => x.id === meetingId)?.scheduleId;
    const m = scheduleId ? meetingData?.meetings.find((x) => String(x.id) === scheduleId) : undefined;
    const ids: string[] = [];
    if (m?.presenter1?.participantId) ids.push(String(m.presenter1.participantId));
    if (m?.presenter2?.participantId) ids.push(String(m.presenter2.participantId));
    return ids;
  };

  // 일괄 변경 기본 회차: 오늘(반 시간대) 이전의 마지막 회차. toISOString 은 UTC 라 KST 오전에는 하루 전이 된다
  const today = wallParts(new Date(), group.timeZone).date;
  const defaultMeeting =
    [...meetings].reverse().find((m) => wallParts(new Date(m.scheduledAt), group.timeZone).date <= today)?.id ??
    meetings[0]?.id ??
    '';
  const activeMeeting = bulkMeeting || defaultMeeting;

  const dayOf = (m: Meeting) => {
    const date = wallParts(new Date(m.scheduledAt), zone).date;
    return `${Number(date.slice(5, 7))}/${date.slice(8, 10)}`;
  };
  const headOf = (m: Meeting) => (m.kickoff ? '킥오프' : `${m.no}회`);

  function pick(id: string) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** 고른 사람들의 한 회차 칸을 같은 값으로 — 상태를 고르는 즉시(「적용」 버튼 없음, 10-18 D2). 저장 전 변경이다. */
  function applyBulk(status: MyStatus | 'clear') {
    if (saving || !activeMeeting || selected.length === 0) return;
    const meeting = meetings.find((m) => m.id === activeMeeting);
    const mLabel = meeting?.kickoff ? '킥오프' : `${meeting?.no}회`;
    const sLabel = status === 'clear' ? '미체크' : STATUS_LABEL[status];
    setCells((prev) => {
      const next = { ...prev };
      for (const id of selected) {
        const row = { ...(next[id] ?? {}) };
        if (status === 'clear') delete row[activeMeeting];
        else row[activeMeeting] = status;
        next[id] = row;
      }
      return next;
    });
    setAnnounce(`${selected.length}명의 ${mLabel} 칸을 ${sLabel}(으)로 바꿨습니다. 저장해야 반영됩니다.`);
  }

  function markWithdraw() {
    if (saving || selected.length === 0 || blockedNames.length > 0) return;
    setAnnounce(`${selected.length}명을 중단 예정으로 표시했습니다. 저장해야 반영됩니다.`);
    setToWithdraw((cur) => new Set([...cur, ...selected]));
    setPicked(new Set());
  }

  function unmarkWithdraw(id: string) {
    setToWithdraw((cur) => {
      const next = new Set(cur);
      next.delete(id);
      return next;
    });
  }

  function requestSave() {
    if (!dirty || saving) return;
    if (withdrawIds.length > 0) setConfirming(true);
    else void doSave();
  }

  async function doSave() {
    if (!dirty || saving) return;
    setConfirming(false);
    setSaving(true);
    const withdrawals = Array.from(toWithdraw).map(Number);
    // 고친 칸만 보낸다 — 격자 전체를 보내면 그 사이 다른 경로(디스코드 출석 등)로 바뀐 칸을 덮어쓴다.
    // 미체크로 되돌린 칸은 아직 보낼 수 없다(API 가 status 로 네 상태만 받는다). 다시 불러오면 서버 값으로 돌아온다
    const updates = Object.entries(cells).flatMap(([participantId, entries]) =>
      Object.entries(entries)
        .filter(([meetingId, status]) => status && status !== savedCells[participantId]?.[meetingId])
        .map(([meetingId, status]) => ({
          participantId: Number(participantId),
          meetingId: Number(meetingId),
          status: (status as string).toUpperCase(),
        })),
    );
    if (updates.length === 0 && withdrawals.length === 0) {
      setAnnounce('미체크로 되돌린 칸은 아직 저장할 수 없습니다.');
      setSaving(false);
      return;
    }

    try {
      await saveStudyAttendance(Number(attendanceData?.study.id ?? 0), {
        studyGroupId: groupId,
        updates,
        withdrawals: withdrawals.length > 0 ? withdrawals : undefined,
      });
    } catch {
      // 실패하면 고친 칸 · 중단 예정을 그대로 두어 다시 저장할 수 있게 한다
      setAnnounce('저장하지 못했습니다. 잠시 뒤 다시 저장해 주세요.');
      setSaving(false);
      return;
    }
    setToWithdraw(new Set());
    await refetchAttendance();
    // 일정(회차) 쿼리도 다시 불러온다 — 참여 중단한 사람은 서버에서 앞으로 맡은 회차의 발표자에서 빠진다 (10-18 D7)
    await queryClient.invalidateQueries({ queryKey: ['studies'] });
    setSavedCells(cells);
    if (withdrawals.length > 0 && updates.length > 0) {
      setAnnounce(`출석 ${updates.length}칸을 저장하고 ${withdrawals.length}명의 참여를 중단했습니다.`);
    } else if (withdrawals.length > 0) {
      setAnnounce(`${withdrawals.length}명의 참여를 중단했습니다.`);
    } else {
      setAnnounce(`출석 ${updates.length}칸을 저장했습니다.`);
    }
    setSaving(false);
  }

  function revert() {
    if (saving) return;
    setCells(savedCells);
    setToWithdraw(new Set());
    setPicked(new Set());
  }

  if (meetings.length === 0) {
    return (
      <div className='card px-6 py-10 text-center'>
        <p className='type-label-lg'>아직 회차가 없습니다.</p>
        {canEdit && (
          <Button size='sm' className='mt-4' variant='secondary' onClick={() => history.back()}>
            일정으로 가기
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* 제목 줄: 출석 · 전체 N · 「?」 + 오른쪽 프로필 시간대. 고른 수는 작업 바에만 */}
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        {/* 「?」는 제목 밖에 둔다 — 제목 안에 두면 설명 글이 제목 이름에 섞인다 */}
        <div className='flex items-center gap-1'>
          <h2 className='type-title-md'>
            출석
            <span className='tnum ml-2 type-label-lg text-fg-muted'>전체 {people.length}</span>
          </h2>
          <PresenterHelp />
        </div>

        <span className='ml-auto type-label-sm text-fg-muted'>내 시간대: {scheduleZoneTitle(zone)}</span>
      </div>

      {/* 출석 격자 */}
      <div className='card overflow-clip'>
        {/* 상태바 + 컬럼 헤더 — overflow-x-auto 밖에 위치해서 가로 스크롤 영향 없음 */}
        <div className='sticky top-[var(--table-action-bar-top,4rem)] z-20 rounded-t-card bg-surface-raised'>
          {canEdit && (
            // 일정 표와 같은 공용 작업 바 — 왼쪽은 고른 크루에 하는 일, 오른쪽은 저장 (POL-0008)
            <TableActionBar
              className='border-b border-border px-4'
              selection={
                <>
                  <SelectionCount count={selected.length} unit='명' />
                  <Select
                    aria-label='바꿀 회차'
                    size='sm'
                    disabled={selected.length === 0}
                    value={activeMeeting}
                    onChange={(e) => setBulkMeeting(e.target.value)}
                  >
                    {meetings.map((m) => (
                      <option key={m.id} value={m.id}>
                        {`${headOf(m)} · ${dayOf(m)}`}
                      </option>
                    ))}
                  </Select>
                  {/* 「적용」 버튼 없이 고르면 바뀐다(키보드는 Enter 로 확정) — 늘 「출석 상태」로 돌아와 같은 값을 또 고를 수 있다 */}
                  <BulkSelect
                    label='바꿀 출석 상태'
                    placeholder='출석 상태'
                    options={BULK_OPTIONS}
                    disabled={saving || selected.length === 0}
                    onPick={(v) => applyBulk(v as MyStatus | 'clear')}
                  />
                  <Button
                    size='sm'
                    variant='danger'
                    disabled={saving || selected.length === 0 || blockedNames.length > 0}
                    onClick={markWithdraw}
                  >
                    참여 중단
                  </Button>
                  {withdrawIds.length > 0 && (
                    // 몇 명이 중단 예정인지는 여기 한 번만 — 줄마다 칩을 붙이지 않는다 (10-18 D8)
                    <span className='tnum type-label-sm text-error-700'>중단 예정 {withdrawIds.length}명</span>
                  )}
                  {blockedNames.length > 0 && (
                    <span className='w-full type-label-sm text-fg-muted sm:w-auto'>
                      네비게이터는 참여 중단할 수 없습니다. 캡틴에게 문의하세요.
                    </span>
                  )}
                </>
              }
              save={
                <>
                  {selected.length > 0 && (
                    <Button size='sm' variant='tertiary' onClick={() => setPicked(new Set())}>
                      선택 해제
                    </Button>
                  )}
                  {dirty && (
                    <Button variant='tertiary' size='sm' disabled={saving} onClick={revert}>
                      변경 취소
                    </Button>
                  )}
                  <Button size='sm' loading={saving} disabled={!dirty} onClick={requestSave}>
                    저장
                  </Button>
                </>
              }
            />
          )}
          {/* 컬럼 헤더 행 */}
          <div className='flex type-body-sm'>
            <div className='flex shrink-0'>
              <div
                className={`flex ${NAME_COL} items-center border-b border-border px-1.5 py-3 text-left type-label-sm text-fg-muted sm:px-4`}
              >
                <span className='flex items-center gap-1.5 sm:gap-3'>
                  {canEdit && (
                    <input
                      type='checkbox'
                      aria-label='크루 전체 선택'
                      className={CHECKBOX}
                      checked={allPicked}
                      ref={(el) => {
                        if (el) el.indeterminate = selected.length > 0 && !allPicked;
                      }}
                      onChange={() => setPicked(allPicked ? new Set() : new Set(selectable))}
                    />
                  )}
                  닉네임
                </span>
              </div>
              <div
                className={`${DISCORD_COL} items-center whitespace-nowrap border-b border-border px-3 py-3 text-left type-label-sm text-fg-muted`}
              >
                디스코드 닉네임
              </div>
              <div
                className={`flex ${PRESENT_COL} items-center justify-center whitespace-nowrap border-b border-border px-1 py-2 type-label-sm text-fg-muted sm:px-2`}
                title='일정의 발표자1·2로 맡은 횟수'
              >
                <span className='sm:hidden'>발표</span>
                <span className='hidden sm:inline'>발표 횟수</span>
              </div>
            </div>
            <div
              ref={headerMiddleRef}
              className='min-w-0 flex-1 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              onScroll={(e) => updateScroll(e.currentTarget.scrollLeft, e.currentTarget)}
            >
              <div className='mx-auto flex w-max'>
                {meetings.map((m) => (
                  <div
                    key={m.id}
                    className={`tnum flex ${MEETING_COL} flex-col items-center justify-center py-2 type-label-sm text-fg-secondary`}
                  >
                    {headOf(m)}
                    <span className='block type-label-sm text-fg-muted'>{dayOf(m)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div
              className={`flex ${RATE_COL} shrink-0 items-center justify-center whitespace-nowrap border-b border-border px-1 py-2 type-label-sm text-fg-muted sm:px-3`}
            >
              출석률
            </div>
          </div>
        </div>

        {/* 본문 행 */}
        {people.map((p, i) => {
          const row = cells[p.id];
          // 중단한 뒤에 시작한 회차는 비운다 — 시각 값으로 견준다(문자열로 견주면 표기 · 시간대가 섞인다)
          const gone = (m: Meeting) => Boolean(p.leftAt && new Date(m.scheduledAt) > new Date(p.leftAt));
          const goneIds = new Set(meetings.filter(gone).map((m) => m.id));
          const counted = row
            ? Object.fromEntries(Object.entries(row).filter(([id]) => !kickoffIds.has(id) && !goneIds.has(id)))
            : undefined;
          const rate = calcRate(counted, new Set());
          const pending = withdrawIds.includes(p.id);

          return (
            // 중단 예정 — 줄 전체를 옅은 빨강으로 (10-18 D8). 칩을 붙이면 좁은 닉네임 칸이 가려진다
            <div
              key={p.id}
              className={`flex items-stretch border-b border-border type-body-sm ${pending ? 'bg-error-50' : 'bg-surface-raised'}`}
            >
              {/* 고정: 닉네임 + 디스코드 닉네임 + 발표 횟수 */}
              <div className='flex shrink-0'>
                <div
                  // 되돌리기 말풍선이 옆 칸에 가리지 않게 — 중단 예정 줄의 닉네임 칸은 overflow 를 열어 둔다
                  className={`relative flex ${NAME_COL} items-center whitespace-nowrap px-1.5 py-1.5 font-semibold sm:px-4 ${
                    pending ? 'z-[1]' : 'overflow-hidden'
                  }`}
                >
                  <span className='flex min-w-0 items-center gap-1 sm:gap-1.5'>
                    {canEdit && (
                      <span className='mr-1 flex w-4 shrink-0 sm:mr-1.5'>
                        {p.manageable && !p.leftAt && (
                          <input
                            type='checkbox'
                            aria-label={`${p.name} 선택`}
                            className={CHECKBOX}
                            checked={picked.has(p.id)}
                            disabled={saving}
                            onChange={() => pick(p.id)}
                          />
                        )}
                      </span>
                    )}
                    {/* 닉네임만 — 디스코드 닉네임은 옆 열(휴대폰은 아래 줄)이 따로 보인다 (10-18 D6). 길면 말줄임, 가리키면 전체 */}
                    <span className={`min-w-0 ${p.leftAt ? 'font-medium text-fg-muted' : ''}`}>
                      <span className='block truncate' title={p.name}>
                        {p.name}
                      </span>
                      {p.discordNickname && (
                        <span className='block truncate type-label-sm text-fg-muted sm:hidden'>
                          {p.discordNickname}
                        </span>
                      )}
                    </span>
                    {/* 칩은 휴대폰 폭에서 화면에서만 숨긴다(sr-only) — 좁은 닉네임 칸을 밀어낸다. 스크린리더는 그대로 듣는다 */}
                    {p.leftAt && (
                      <span className='sr-only shrink-0 sm:not-sr-only sm:inline-flex'>
                        <Badge tone='neutral'>참여 중단</Badge>
                      </span>
                    )}
                    {p.role && (
                      <span className='sr-only shrink-0 sm:not-sr-only sm:inline-flex'>
                        <Badge tone={p.role}>{p.role === 'captain' ? '캡틴' : '네비게이터'}</Badge>
                      </span>
                    )}
                    {pending && (
                      // 저장 전이라 아직 중단이 아니다 — 칩 없이 되돌리기 아이콘만. 줄 색이 예정임을 말한다.
                      // 가리키면(키보드 포커스도) 오른쪽에 「중단 예정 취소」 말풍선 — 브라우저 title 은 늦게 떠서 쓰지 않는다
                      <button
                        type='button'
                        aria-label={`${p.name} 중단 예정 취소`}
                        onClick={() => unmarkWithdraw(p.id)}
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
                          className='pointer-events-none absolute left-full top-1/2 z-10 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded-sm bg-fg px-2 py-1 type-label-sm text-bg opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'
                        >
                          중단 예정 취소
                        </span>
                      </button>
                    )}
                  </span>
                </div>
                <div className={`${DISCORD_COL} items-center whitespace-nowrap px-3 py-1.5 text-fg-secondary`}>
                  {/* 본인이 넣는 글자 — 글자로만 그린다 */}
                  {p.discordNickname ? (
                    <span className='block truncate' title={p.discordNickname}>
                      {p.discordNickname}
                    </span>
                  ) : (
                    <span className='block w-full text-center text-fg-muted'>-</span>
                  )}
                </div>
                <div
                  className={`flex ${PRESENT_COL} items-center justify-center whitespace-nowrap px-1 py-1.5 type-label-sm text-fg-secondary sm:px-2`}
                >
                  {(() => {
                    const n = meetings.filter((m) => !gone(m) && presentersOf(m.id).includes(p.id)).length;
                    return n > 0 ? n : <span className='text-fg-muted'>0</span>;
                  })()}
                </div>
              </div>
              {/* 가로 스크롤: 회차 셀 */}
              <div
                ref={(el) => {
                  rowMiddleRefs.current[i] = el;
                }}
                className='min-w-0 flex-1 overflow-x-auto overflow-y-clip [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                onScroll={(e) => updateScroll(e.currentTarget.scrollLeft, e.currentTarget)}
              >
                <div className='mx-auto flex w-max'>
                  {meetings.map((m) =>
                    gone(m) ? (
                      <div
                        key={m.id}
                        className={`flex ${MEETING_COL} items-center justify-center py-1.5 type-label-sm text-fg-muted`}
                      >
                        -
                      </div>
                    ) : (
                      <div key={m.id} className={`flex ${MEETING_COL} items-center py-1.5`}>
                        {(() => {
                          const status = row?.[m.id];
                          const changed = cells[p.id]?.[m.id] !== savedCells[p.id]?.[m.id];
                          const label = status ? STATUS_LABEL[status] : '';
                          const presenting = presentersOf(m.id).includes(p.id);
                          if (!canEdit) {
                            return (
                              <span
                                className={`relative grid h-8 w-full place-items-center rounded-sm type-label-sm ${
                                  status ? STATUS_STYLE[status] : 'bg-surface-1 text-fg-muted'
                                }`}
                              >
                                {presenting && (
                                  <Mic
                                    size={10}
                                    strokeWidth={2.5}
                                    aria-hidden
                                    className='absolute left-0.5 top-0.5 text-brand'
                                  />
                                )}
                                {label || ''}
                              </span>
                            );
                          }
                          return (
                            <button
                              type='button'
                              disabled={saving}
                              onClick={() => {
                                const next = nextStatus(status);
                                setCells((prev) => {
                                  const r = { ...(prev[p.id] ?? {}) };
                                  if (next === undefined) delete r[m.id];
                                  else r[m.id] = next;
                                  return { ...prev, [p.id]: r };
                                });
                              }}
                              title='눌러서 출석 → 지각 → 결석 → 휴가 → 미체크'
                              className={`relative h-8 w-full rounded-sm type-label-lg transition-colors ${
                                status
                                  ? // 중단 예정 줄은 바탕이 옅은 빨강이라 결석 칸이 묻힌다 — 한 단계 진하게
                                    `${pending && status === 'absent' ? 'bg-error-100 text-error-700' : STATUS_STYLE[status]}${
                                      changed ? ` ring-2 ${STATUS_RING[status]}` : ''
                                    }`
                                  : // 평소에는 테두리 없이 — 미체크로 고친 칸만 중립 테두리 (10-18 D5)
                                    `bg-surface-1 text-fg-muted hover:bg-surface-2${changed ? ' ring-2 ring-border-strong' : ''}`
                              }`}
                            >
                              {presenting && (
                                <Mic
                                  size={10}
                                  strokeWidth={2.5}
                                  aria-hidden
                                  className='absolute left-0.5 top-0.5 text-brand'
                                />
                              )}
                              {label}
                            </button>
                          );
                        })()}
                      </div>
                    ),
                  )}
                </div>
              </div>
              {/* 고정: 출석률 */}
              <div
                className={`tnum flex ${RATE_COL} shrink-0 items-center justify-center whitespace-nowrap px-1 py-1.5 font-semibold sm:px-3`}
              >
                {rate === undefined ? (
                  <span className='text-fg-muted'>-</span>
                ) : (
                  <span
                    className={
                      p.leftAt
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
              </div>
            </div>
          );
        })}

        {/* 가로 스크롤바 — 회차 열 너비만큼만 노출, 오버플로우 없으면 숨김 */}
        <div className={hasOverflow ? 'flex bg-transparent' : 'hidden'}>
          {/* 왼쪽 고정 열(닉네임 · 디스코드 닉네임 · 발표 횟수) · 오른쪽 출석률 폭만큼 비운다 */}
          <div className='w-[calc(110px+2.25rem)] shrink-0 sm:w-112' />
          <div
            ref={proxyRef}
            className='min-w-0 flex-1 overflow-x-auto'
            onScroll={(e) => updateScroll(e.currentTarget.scrollLeft, e.currentTarget)}
            aria-hidden
          >
            <div style={{ width: stripWidth, height: '1px' }} />
          </div>
          <div className='w-12 shrink-0 sm:w-20' />
        </div>
      </div>

      <p className='sr-only' aria-live='polite'>
        {announce}
      </p>

      {/* 참여 중단 확인 모달 */}
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
            <Button variant='destructive' onClick={() => void doSave()}>
              저장
            </Button>
          </>
        }
      >
        <p className='mb-3 type-body-sm text-fg'>
          <span className='font-semibold'>참여 중단</span> {withdrawNames.join(', ')}
          {pendingCount > 0 && (
            <>
              <br />
              <span className='font-semibold'>출석</span> {pendingCount}칸
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
    </div>
  );
}
