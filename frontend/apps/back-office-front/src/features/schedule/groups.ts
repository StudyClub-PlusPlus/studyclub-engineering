'use client';

import { useMemo } from 'react';

import type { ScheduleGroup } from './meetings';
import { groupsFromServer, listGroups } from './store';
import { useParticipants } from '@/features/participants/queries';

/**
 * 일정 · 출석 탭의 반 — 신청자 탭에서 만든 서버 반(참여 명단 `groups[]`)이다. 반이 둘 이상이면 반 칩이 선다.
 * 서버 반 목록을 못 받으면(참여 명단 GET 미구현 · 실패) 이 저장소의 「기본반」 하나로 그린다.
 * `rev` 가 바뀌면 저장소(스터디 시간)를 다시 읽는다.
 */
export function useScheduleGroups(studyId: number, rev: number): ScheduleGroup[] {
  const server = useParticipants(studyId).data?.groups;
  return useMemo(
    () => (server && server.length > 0 ? groupsFromServer(studyId, server) : listGroups(studyId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rev 가 바뀌면 저장소를 다시 읽는다
    [studyId, server, rev],
  );
}
