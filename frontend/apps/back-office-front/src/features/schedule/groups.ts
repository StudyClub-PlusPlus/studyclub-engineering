'use client';

import { useMemo } from 'react';

import type { ScheduleGroup } from './meetings';
import type { ApiGroupMeetings } from './repository';
import { groupsFromServer } from './store';
import type { StudyTz } from './time';
import { useParticipants } from '@/features/participants/queries';

/**
 * 일정 · 출석 탭의 반 — 신청자 탭에서 만든 서버 반(참여 명단 `groups[]`)이다. 반이 둘 이상이면 반 칩이 선다.
 * 서버 반을 아직 못 받았으면 빈 목록이다. 조회가 실패하면 `error` 가 선다 — 「반이 없다」와 구분해 알린다. 스터디 시간(요일 · 시각)은 브라우저 저장(`store.ts`)에서 얹고, `rev` 가 바뀌면 다시 읽는다.
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

/** 반 시간대는 서버 반의 `timezone` 이다 — 회차 일자 · 시각을 그 시간대로 저장 · 검증한다. */
export function withServerTz(group: ScheduleGroup, res: ApiGroupMeetings | undefined): ScheduleGroup {
  const tz = res?.studyGroup.timezone as StudyTz | undefined;
  return tz && tz !== group.time.tz ? { ...group, time: { ...group.time, tz } } : group;
}
