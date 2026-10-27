'use client';

import { useMemo } from 'react';

import { Button, Segmented, toast } from '@studyclub/ui';
import { CalendarPlus } from 'lucide-react';

import { toBook, toUpdates, useGroupAttendance, useSaveAttendance } from './api';
import { AttendanceBook, type BookColumn, type BookRow } from './AttendanceBook';
import { toMeetings, useGroupMeetings } from '@/features/schedule/api';
import { useCrew } from '@/features/schedule/crew';
import { GroupPicker } from '@/features/schedule/GroupPicker';
import { useScheduleGroups } from '@/features/schedule/groups';
import { hasTime, isKickoff } from '@/features/schedule/meetings';
import { DISPLAY_ZONES, wallParts } from '@/features/schedule/time';
import type { ApiStudyDetail } from '@/features/studies/types';

/**
 * 출석 탭 — 반마다 누가 몇 번 나왔는지 보고 고친다. 명세: playground `console/studies/[id]/spec.ts` 의 `ATTENDANCE_SPEC`.
 *
 * 출석부는 **반마다 하나**다 — 반이 다르면 모이는 날이 다르다. 고른 반은 일정 탭과 같이 쓴다.
 * 열은 그 반의 회차다 — 일정 탭에서 더하고 고친 회차가 그대로 열이 된다. 회차는 여기서 만들지 않는다.
 * 반 칩으로 한 반씩 본다. 모든 반을 이어 보는 전체 보기는 두지 않는다 (2026-10-17 기획 결정).
 *
 * 줄(참가자) · 칸(출석)은 출석 명부 API, 열(회차)은 일정 탭과 같은 반 회차 목록이다 — `./api.ts` · `features/schedule/api.ts`.
 * 저장은 바뀐 칸만 `updates[]` 로, 참여 중단은 `withdrawals[]` 로 한 요청에 보낸다.
 */
export function AttendanceTab({
  detail,
  groupId,
  onGroup,
  onDirtyChange,
  guard,
  zone,
  onZone,
  onGoCrew,
  onAddMeeting,
}: {
  detail: ApiStudyDetail;
  /** 고른 반. 비었거나 없는 반이면 첫 반. */
  groupId: string;
  onGroup: (id: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  /** 저장하지 않은 고침이 있으면 먼저 묻고, 나가기로 하면 `go` 를 부른다. */
  guard: (go: () => void) => void;
  /** 회차 머리의 시간대 — 반을 바꿔도 남는다. */
  zone: string;
  onZone: (zone: string) => void;
  onGoCrew: () => void;
  /** 회차가 없는 반 — 일정 탭으로 가서 회차 추가(스터디 시간이 없으면 스터디 시간 정하기) 창을 연다. */
  onAddMeeting: () => void;
}) {
  const studyId = detail.id;

  // 신청자 탭에서 만든 서버 반 — 둘 이상이면 반 칩이 선다
  const { groups, loading, error: groupsError } = useScheduleGroups(studyId);
  const group = groups.find((g) => g.id === groupId) ?? groups[0];
  const serverGroupId = group ? Number(group.id) : undefined;
  const meetingsQuery = useGroupMeetings(studyId, serverGroupId);
  const attendanceQuery = useGroupAttendance(studyId, serverGroupId);
  const meetings = useMemo(() => (meetingsQuery.data ? toMeetings(meetingsQuery.data) : []), [meetingsQuery.data]);
  const attendance = useMemo(() => (attendanceQuery.data ? toBook(attendanceQuery.data) : {}), [attendanceQuery.data]);
  const crew = useCrew(studyId, group?.id);
  const save = useSaveAttendance(studyId, serverGroupId ?? 0);

  // 줄은 출석 명부(중단한 사람 포함). 디스코드 닉네임은 참여 명단에서 붙인다 — 명부 응답에는 없다.
  // 중단한 사람은 맨 아래로. 누구나 골라 출석을 바꿀 수 있고, 네비게이터는 참여 중단이 잠긴다 —
  // 신청자 탭에서 네비게이터 권한을 회수(크루로)한 뒤 중단한다. 역할은 명부의 LEADER.
  const rows = useMemo<BookRow[]>(() => {
    const nick = new Map(crew.map((c) => [c.id, c.discordNickname]));
    return (attendanceQuery.data?.participants ?? [])
      .map((p) => ({
        id: String(p.participantId),
        name: p.displayName,
        discordNickname: nick.get(String(p.participantId)) ?? null,
        ...(p.participantRole === 'LEADER' && { role: 'navigator' as const }),
        leftAt: p.leftAt ?? undefined,
        serverRate: p.attendanceRate,
      }))
      .sort((a, b) => Number(Boolean(a.leftAt)) - Number(Boolean(b.leftAt)));
  }, [attendanceQuery.data, crew]);

  const columns = useMemo<BookColumn[]>(
    () =>
      meetings.map((m) => {
        const ymd = wallParts(new Date(m.scheduledAt), zone).date;
        return {
          id: m.id,
          head: isKickoff(m) ? '킥오프' : `${m.no}회`,
          day: `${Number(ymd.slice(5, 7))}/${ymd.slice(8, 10)}`,
          scheduledAt: m.scheduledAt,
          notCounted: isKickoff(m),
          presenters: [m.presenter1, m.presenter2].filter(Boolean),
        };
      }),
    [meetings, zone],
  );

  if (loading) return null;

  // 반 목록(참여 명단)을 못 읽었다 — 「아직 반이 없습니다」와 반 만들기를 보이면 반이 사라진 것처럼 보인다
  if (!group && groupsError) {
    return (
      <p role='alert' className='card px-6 py-10 text-center text-sm text-fg-muted'>
        {groupsError.message || '반 목록을 불러오지 못했습니다.'}
      </p>
    );
  }

  // 반이 없으면 출석부도 없다. 그 사실과 갈 곳을 같이 말한다
  if (!group) {
    return (
      <div className='card px-6 py-10 text-center'>
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
      <GroupPicker groups={groups} groupId={group.id} onPick={(id) => guard(() => onGroup(id))} />

      {!meetingsQuery.data || !attendanceQuery.data ? (
        <p
          role={meetingsQuery.isError || attendanceQuery.isError ? 'alert' : 'status'}
          className='card px-6 py-10 text-center text-sm text-fg-muted'
        >
          {(meetingsQuery.error ?? attendanceQuery.error)?.message ?? '출석부를 불러오는 중입니다.'}
        </p>
      ) : meetings.length === 0 ? (
        // 반은 있는데 회차가 없다 — 회차는 일정 탭에서 만든다. 반 칩은 위에 남겨 다른 반으로 옮길 수 있게 한다
        <div className='card px-6 py-10 text-center'>
          <p className='text-sm font-semibold text-fg'>
            {hasTime(group) ? '이 반에는 아직 회차가 없습니다.' : '이 반은 아직 스터디 시간이 없습니다.'}
          </p>
          <p className='mt-1.5 text-sm text-fg-muted'>
            {hasTime(group)
              ? '일정 탭에서 회차를 추가하면 이 반의 출석부가 만들어집니다.'
              : '일정 탭에서 스터디 시간을 정하고 회차를 추가하면 출석부가 만들어집니다.'}
          </p>
          <Button size='sm' className='mt-4' leadingIcon={<CalendarPlus size={15} />} onClick={onAddMeeting}>
            {hasTime(group) ? '회차 추가하러 가기' : '스터디 시간 정하러 가기'}
          </Button>
        </div>
      ) : (
        // 반을 바꾸면 출석부를 새로 연다 — 고치던 칸은 그 반의 것이다
        <AttendanceBook
          key={group.id}
          rows={rows}
          columns={columns}
          attendance={attendance}
          onDirtyChange={onDirtyChange}
          onSave={(next, withdrawIds) => {
            const { updates, cleared } = toUpdates(
              attendance,
              next,
              columns.map((c) => c.id),
            );
            // 서버는 칸을 비우지 못한다 — 미체크로 되돌린 칸은 저장하지 않고 알린다
            if (cleared > 0) toast.error(`미체크로 되돌린 ${cleared}칸은 저장할 수 없어 그대로 둡니다.`);
            if (updates.length === 0 && withdrawIds.length === 0) return;
            save.mutate(
              { updates, withdrawals: withdrawIds.map(Number) },
              { onError: (err) => toast.error(err.message || '출석부를 저장하지 못했습니다.') },
            );
          }}
          toolbar={
            <Segmented
              aria-label='회차 표시 시간대'
              shape='pill'
              size='sm'
              value={zone}
              options={DISPLAY_ZONES.map((z) => ({ value: z.iana as string, label: z.label }))}
              onChange={onZone}
            />
          }
        />
      )}
    </div>
  );
}
