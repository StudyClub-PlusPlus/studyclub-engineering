'use client';

import { useMemo } from 'react';

import { useParticipants } from '@/features/participants/queries';
import type { ScheduleGroup } from '@/features/schedule/meetings';
import type { ApiGroupMeetings } from '@/features/schedule/repository';
import { groupsFromServer } from '@/features/schedule/store';
import type { StudyTz } from '@/features/schedule/time';

/**
 * 일정 · 출석 탭의 반 — 신청자 탭에서 만든 서버 반(참여 명단 `groups[]`)이다. 반이 둘 이상이면 반 칩이 선다.
 * 서버 반을 아직 못 받았으면 빈 목록이다. 조회가 실패하면 `error` 가 선다 — 「반이 없다」와 구분해 알린다.
 * 요일(weekdays)은 브라우저 저장(`store.ts`)에서 얹고, `rev` 가 바뀌면 다시 읽는다.
 * startTime · timezone 은 서버 반 응답(`withServerTz`)으로 덮는다.
 */
export function useScheduleGroups(
  studyId: number,
  rev = 0,
): { groups: ScheduleGroup[]; loading: boolean; error: Error | null } {
  const participants = useParticipants(studyId);
  const server = participants.data?.groups;
  const groups = useMemo(
    () => (server ? groupsFromServer(studyId, server) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rev 가 바뀌면 브라우저 저장을 다시 읽는다
    [studyId, server, rev],
  );
  return { groups, loading: participants.isPending, error: participants.isError ? participants.error : null };
}

/**
 * startTime · timezone 은 서버 반의 값으로 덮는다.
 * startTime 은 회차 추가 창의 기본값에, timezone 은 회차 일자·시각 저장·검증에 쓴다.
 */
export function withServerTz(group: ScheduleGroup, res: ApiGroupMeetings | undefined): ScheduleGroup {
  if (!res) return group;
  const tz = res.studyGroup.timezone as StudyTz | undefined;
  const time = res.studyGroup.startTime ?? '';
  return { ...group, time: { ...group.time, ...(tz ? { tz } : {}), time } };
}
