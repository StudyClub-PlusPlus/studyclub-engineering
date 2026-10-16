'use client';

import { useEffect, useRef, useState } from 'react';

import type { Study } from '@studyclub/mock';
import { Badge, Button, Modal, Select, SelectionCount } from '@studyclub/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Mic } from 'lucide-react';

import { STATUS_LABEL, STATUS_STYLE, type MyStatus } from '@/lib/attendance';
import { getUser } from '@/lib/auth';
import { saveStudyAttendance, type ApiAttendance, type ApiMeetingList } from '@/lib/joined-detail-api';
import { DISPLAY_ZONES, wallParts, type NavigatorGroup } from '@/lib/meetings';

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

function buildCells(data: ApiAttendance | undefined): Record<string, Record<string, MyStatus | undefined>> {
  return Object.fromEntries(
    (data?.participants ?? []).map((p) => [
      String(p.participantId),
      Object.fromEntries(p.attendances.map((a) => [String(a.meetingId), a.status.toLowerCase() as MyStatus])),
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

const BULK_OPTIONS: { value: MyStatus | ''; label: string }[] = [
  { value: 'present', label: '출석' },
  { value: 'late', label: '지각' },
  { value: 'absent', label: '결석' },
  { value: 'excused', label: '휴가' },
  { value: '', label: '미체크' },
];

type Person = {
  id: string;
  name: string;
  me?: boolean;
  role?: 'captain' | 'navigator';
  leftAt: string | null;
  manageable: boolean;
  withdrawable: boolean;
};

type Meeting = { id: string; no: number; scheduledAt: string; kickoff: boolean };

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
  const [zone, setZone] = useState<string>(
    DISPLAY_ZONES.some((z) => z.iana === group.timeZone) ? group.timeZone : DISPLAY_ZONES[0].iana,
  );

  // attendance API 와 meetings API 가 서로 다른 meeting ID를 쓸 수 있으므로,
  // 셀 조회 키(id)는 attendance API 기준으로 맞추고, 회차 번호·킥오프는 scheduledAt 으로 매칭한다.
  const meetings: Meeting[] = (attendanceData?.meetings ?? [])
    .slice()
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .map((am) => {
      const mm = meetingData?.meetings.find((m) => m.scheduledAt === am.scheduledAt);
      return {
        id: String(am.id),
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
  const [bulkStatus, setBulkStatus] = useState<MyStatus | ''>('present');
  const [announce, setAnnounce] = useState<string | null>(null);

  const headerMiddleRef = useRef<HTMLDivElement>(null);
  const rowMiddleRefs = useRef<(HTMLDivElement | null)[]>([]);
  const proxyRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const el = headerMiddleRef.current;
    if (!el) return;
    const check = () => setHasOverflow(el.scrollWidth > el.clientWidth);
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

  const presentersOf = (meetingId: string): string[] => {
    const m = meetingData?.meetings.find((x) => String(x.id) === meetingId);
    const ids: string[] = [];
    if (m?.presenter1?.participantId) ids.push(String(m.presenter1.participantId));
    if (m?.presenter2?.participantId) ids.push(String(m.presenter2.participantId));
    return ids;
  };

  const today = new Date().toISOString().slice(0, 10);
  const defaultMeeting =
    [...meetings].reverse().find((m) => m.scheduledAt.slice(0, 10) <= today)?.id ?? meetings[0]?.id ?? '';
  const activeMeeting = bulkMeeting || defaultMeeting;

  const dayOf = (m: Meeting) => {
    const date = wallParts(new Date(m.scheduledAt), zone).date;
    return `${Number(date.slice(5, 7))}/${date.slice(8, 10)}`;
  };
  const timeOf = (m: Meeting) => wallParts(new Date(m.scheduledAt), zone).time;
  const headOf = (m: Meeting) => (m.kickoff ? '킥오프' : `${m.no}회`);

  function pick(id: string) {
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyBulk() {
    if (saving || !activeMeeting || selected.length === 0) return;
    const meeting = meetings.find((m) => m.id === activeMeeting);
    const mLabel = meeting?.kickoff ? '킥오프' : `${meeting?.no}회`;
    const sLabel = bulkStatus ? STATUS_LABEL[bulkStatus] : '미체크';
    setCells((prev) => {
      const next = { ...prev };
      for (const id of selected) {
        const row = { ...(next[id] ?? {}) };
        if (bulkStatus) row[activeMeeting] = bulkStatus;
        else delete row[activeMeeting];
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
    const updates =
      pendingCount > 0
        ? Object.entries(cells).flatMap(([participantId, entries]) =>
            Object.entries(entries)
              .filter(([, status]) => status)
              .map(([meetingId, status]) => ({
                participantId: Number(participantId),
                meetingId: Number(meetingId),
                status: (status as string).toUpperCase(),
              })),
          )
        : [];

    await saveStudyAttendance(Number(attendanceData?.study.id ?? 0), {
      studyGroupId: groupId,
      updates,
      withdrawals: withdrawals.length > 0 ? withdrawals : undefined,
    });
    setToWithdraw(new Set());
    await refetchAttendance();
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
        <p className='text-sm font-semibold'>아직 회차가 없습니다.</p>
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
      {/* 제목 줄: 출석 · 전체 N · 선택 M + 오른쪽 KST/PDT 탭 */}
      <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-base font-bold'>
          출석
          <span className='tnum ml-2 text-sm font-medium text-fg-muted'>전체 {people.length}</span>
        </h2>

        <div role='tablist' aria-label='회차 표시 시간대' className='ml-auto inline-flex rounded-pill bg-surface-2 p-1'>
          {DISPLAY_ZONES.map((z) => {
            return (
              <Button
                key={z.iana}
                variant={zone === z.iana ? 'secondary' : 'ghost'}
                size='sm'
                type='button'
                onClick={() => setZone(z.iana)}
                className='rounded-pill px-3 py-1.5 text-xs font-bold'
              >
                {z.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* 출석 격자 */}
      <div className='card overflow-clip'>
        {/* 상태바 + 컬럼 헤더 — overflow-x-auto 밖에 위치해서 가로 스크롤 영향 없음 */}
        <div className='sticky top-[var(--table-action-bar-top,4rem)] z-20 rounded-t-card bg-surface'>
          {canEdit && (
            <div
              role='region'
              aria-label='표 작업'
              className='flex flex-wrap items-center gap-2 border-b border-border px-5 py-3'
            >
              <div className='flex flex-wrap items-center gap-2'>
                <SelectionCount count={selected.length} unit='명' />
                <Select
                  aria-label='적용할 회차'
                  size='sm'
                  disabled={selected.length === 0}
                  value={activeMeeting}
                  onChange={(e) => setBulkMeeting(e.target.value)}
                >
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {`${headOf(m)} · ${dayOf(m)} ${timeOf(m)}`}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label='적용할 출석 상태'
                  size='sm'
                  disabled={selected.length === 0}
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value as MyStatus | '')}
                >
                  {BULK_OPTIONS.map((o) => (
                    <option key={o.label} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                <Button size='sm' variant='secondary' disabled={saving || selected.length === 0} onClick={applyBulk}>
                  출석 적용
                </Button>
                <Button
                  size='sm'
                  variant='danger'
                  disabled={saving || selected.length === 0 || blockedNames.length > 0}
                  onClick={markWithdraw}
                >
                  참여 중단
                </Button>
                {selected.length > 0 && (
                  <Button size='sm' variant='ghost' onClick={() => setPicked(new Set())}>
                    선택 해제
                  </Button>
                )}
                {blockedNames.length > 0 && (
                  <span className='text-xs text-fg-muted'>
                    네비게이터는 참여 중단할 수 없습니다. 캡틴에게 문의하세요.
                  </span>
                )}
              </div>
              <div className='ml-auto flex items-center gap-2'>
                {dirty && (
                  <Button variant='ghost' size='sm' disabled={saving} onClick={revert}>
                    변경 취소
                  </Button>
                )}
                <Button size='sm' loading={saving} disabled={!dirty} onClick={requestSave}>
                  저장
                </Button>
              </div>
            </div>
          )}
          {/* 컬럼 헤더 행 */}
          <div className='flex text-sm'>
            <div className='flex shrink-0'>
              <div className='flex w-28 min-w-28 max-w-28 items-center border-b border-border px-2 py-3 text-left text-xs font-semibold text-fg-muted sm:w-48 sm:min-w-[12rem] sm:max-w-[12rem] sm:px-4'>
                <span className='flex items-center gap-2 sm:gap-3'>
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
                  크루
                </span>
              </div>
              <div
                className='flex w-10 min-w-10 max-w-10 items-center justify-center whitespace-nowrap border-b border-border px-1 py-2 text-[11px] font-semibold text-fg-muted sm:w-16 sm:min-w-[4rem] sm:max-w-[4rem] sm:px-2'
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
                    className='tnum flex w-13 min-w-10 shrink-0 flex-col items-center justify-center px-1 py-2 text-[11px] font-semibold text-fg-secondary sm:w-15'
                  >
                    {headOf(m)}
                    <span className='block text-[10px] font-medium text-fg-muted'>{dayOf(m)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className='flex w-14 min-w-14 max-w-14 shrink-0 items-center justify-end whitespace-nowrap border-b border-border px-2 py-2 text-xs font-semibold text-fg-muted sm:w-20 sm:min-w-[5rem] sm:max-w-[5rem] sm:px-3'>
              출석률
            </div>
          </div>
        </div>

        {/* 본문 행 */}
        {people.map((p, i) => {
          const row = cells[p.id];
          const gone = (m: Meeting) => Boolean(p.leftAt && `${m.scheduledAt.slice(0, 10)}T${group.startAt}` > p.leftAt);
          const goneIds = new Set(meetings.filter(gone).map((m) => m.id));
          const counted = row
            ? Object.fromEntries(Object.entries(row).filter(([id]) => !kickoffIds.has(id) && !goneIds.has(id)))
            : undefined;
          const rate = calcRate(counted, new Set());
          const pending = withdrawIds.includes(p.id);

          return (
            <div key={p.id} className='flex items-stretch border-b border-border bg-surface text-sm'>
              {/* 고정: 크루 + 발표횟수 */}
              <div className='flex shrink-0'>
                <div className='flex w-28 min-w-28 max-w-28 items-center whitespace-nowrap px-2 py-3 font-semibold sm:w-48 sm:min-w-[12rem] sm:max-w-[12rem] sm:px-4'>
                  <span className='flex items-center gap-1.5'>
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
                    <span
                      className={`min-w-0 max-w-[3.5rem] truncate sm:max-w-[7.5rem] ${p.leftAt ? 'font-medium text-fg-muted' : ''}`}
                      title={p.name}
                    >
                      {p.name}
                    </span>
                    {p.leftAt && <Badge tone='neutral'>참여 중단</Badge>}
                    {p.role && <Badge tone={p.role}>{p.role === 'captain' ? '캡틴' : '네비게이터'}</Badge>}
                    {pending && (
                      <span className='flex items-center gap-1'>
                        <Badge tone='absent'>중단 예정</Badge>
                        <button
                          type='button'
                          aria-label={`${p.name} 중단 예정 취소`}
                          onClick={() => unmarkWithdraw(p.id)}
                          disabled={saving}
                          className='rounded-sm px-1 text-xs font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline'
                        >
                          취소
                        </button>
                      </span>
                    )}
                  </span>
                </div>
                <div className='flex w-10 min-w-10 max-w-10 items-center justify-center whitespace-nowrap px-1 py-3 text-xs font-semibold text-fg-secondary sm:w-16 sm:min-w-[4rem] sm:max-w-[4rem] sm:px-2'>
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
                        className='flex w-8 min-w-8 shrink-0 items-center justify-center px-1 py-3 text-xs text-fg-muted'
                      >
                        —
                      </div>
                    ) : (
                      <div key={m.id} className='flex w-13 min-w-10 shrink-0 items-center px-1 py-3 sm:w-15'>
                        {(() => {
                          const status = row?.[m.id];
                          const changed = cells[p.id]?.[m.id] !== savedCells[p.id]?.[m.id];
                          const label = status ? STATUS_LABEL[status] : '';
                          const presenting = presentersOf(m.id).includes(p.id);
                          if (!canEdit) {
                            return (
                              <span
                                className={`relative grid h-8 w-full place-items-center rounded-sm text-[11px] font-bold ${
                                  status
                                    ? STATUS_STYLE[status]
                                    : 'border border-dashed border-border-strong bg-surface text-fg-muted'
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
                              className={`relative h-8 w-full rounded-sm text-[11px] font-bold transition-colors ${
                                status
                                  ? `${STATUS_STYLE[status]}${changed ? ` ring-2 ${STATUS_RING[status]}` : ''}`
                                  : changed
                                    ? 'ring-2 ring-brand bg-surface text-fg-muted hover:bg-surface-2'
                                    : 'border border-dashed border-border-strong bg-surface text-fg-muted hover:bg-surface-2'
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
              <div className='tnum flex w-14 min-w-14 max-w-14 shrink-0 items-center justify-end whitespace-nowrap px-2 py-3 font-bold sm:w-20 sm:min-w-[5rem] sm:max-w-[5rem] sm:px-3'>
                {rate === undefined ? (
                  <span className='text-fg-muted'>—</span>
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
          <div className='w-64 shrink-0' />
          <div
            ref={proxyRef}
            className='min-w-0 flex-1 overflow-x-auto'
            onScroll={(e) => updateScroll(e.currentTarget.scrollLeft, e.currentTarget)}
            aria-hidden
          >
            <div className='mx-auto' style={{ width: `${meetings.length * 2}rem`, height: '1px' }} />
          </div>
          <div className='w-20 shrink-0' />
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
        <p className='mb-3 text-sm text-fg'>
          <span className='font-semibold'>참여 중단</span> {withdrawNames.join(', ')}
          {pendingCount > 0 && (
            <>
              <br />
              <span className='font-semibold'>출석</span> {pendingCount}칸
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
    </div>
  );
}
