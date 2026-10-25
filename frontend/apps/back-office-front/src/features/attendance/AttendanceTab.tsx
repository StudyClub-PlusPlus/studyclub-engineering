'use client';

import { useMemo, useState } from 'react';

import { Button, Segmented } from '@studyclub/ui';
import { CalendarPlus } from 'lucide-react';

import { AttendanceBook, type BookColumn, type BookRow } from './AttendanceBook';
import { useCrew } from '@/features/schedule/crew';
import { GroupPicker } from '@/features/schedule/GroupPicker';
import { useScheduleGroups } from '@/features/schedule/groups';
import { hasTime, isKickoff } from '@/features/schedule/meetings';
import { getAttendance, getWithdrawn, listMeetings, saveAttendance, withdrawPeople } from '@/features/schedule/store';
import { DISPLAY_ZONES, wallParts } from '@/features/schedule/time';
import type { ApiStudyDetail } from '@/features/studies/types';

/**
 * 출석 탭 — 반마다 누가 몇 번 나왔는지 보고 고친다. 명세: playground `console/studies/[id]/spec.ts` 의 `ATTENDANCE_SPEC`.
 *
 * 출석부는 **반마다 하나**다 — 반이 다르면 모이는 날이 다르다. 고른 반은 일정 탭과 같이 쓴다.
 * 열은 그 반의 회차다 — 일정 탭에서 더하고 고친 회차가 그대로 열이 된다. 회차는 여기서 만들지 않는다.
 * 반 칩으로 한 반씩 본다. 모든 반을 이어 보는 전체 보기는 두지 않는다 (2026-10-17 기획 결정).
 *
 * 저장은 일정 탭처럼 브라우저에만 남는다 — `features/schedule/store.ts` 참고.
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
  /** 저장소가 localStorage 라 렌더 트리거가 없다 — 바꿀 때마다 올려 다시 읽는다. */
  const [rev, setRev] = useState(0);

  // 신청자 탭에서 만든 서버 반 — 둘 이상이면 반 칩이 선다
  const groups = useScheduleGroups(studyId, rev);
  const group = groups.find((g) => g.id === groupId) ?? groups[0];
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rev 가 바뀌면 저장소를 다시 읽는다
  const meetings = useMemo(() => (group ? listMeetings(studyId, group) : []), [studyId, group, rev]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rev 가 바뀌면 저장소를 다시 읽는다
  const attendance = useMemo(() => (group ? getAttendance(studyId, group.id) : {}), [studyId, group, rev]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rev 가 바뀌면 저장소를 다시 읽는다
  const left = useMemo(() => (group ? getWithdrawn(studyId, group.id) : {}), [studyId, group, rev]);
  const crew = useCrew(studyId, group?.id);

  // 중단한 사람은 맨 아래로. 누구나 골라 출석을 바꿀 수 있고, 네비게이터는 참여 중단만 못 한다 (역할은 참여 명단의 LEADER).
  const rows = useMemo<BookRow[]>(
    () =>
      crew
        .map((c) => ({ id: c.id, name: c.name, discordNickname: c.discordNickname, role: c.role, leftAt: left[c.id] }))
        .sort((a, b) => Number(Boolean(a.leftAt)) - Number(Boolean(b.leftAt))),
    [crew, left],
  );

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

      {meetings.length === 0 ? (
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
            // 출석이 먼저, 이어 참여 중단 — 서버에서는 한 요청 · 한 트랜잭션이다
            saveAttendance(studyId, group.id, next);
            if (withdrawIds.length > 0) withdrawPeople(studyId, group.id, withdrawIds);
            setRev((n) => n + 1);
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
