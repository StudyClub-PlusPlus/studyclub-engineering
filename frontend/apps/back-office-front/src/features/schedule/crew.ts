'use client';

import { useMemo } from 'react';

import { useParticipants } from '@/features/participants/queries';
import type { Person } from '@/features/schedule/meetings';

/** 그 반 참가자 — 발표자 후보이자 출석부의 한 줄. ID 는 명부 행 ID(`participantId`) 문자열 — 회차 발표자 · 출석부와 같다. */
export type CrewMember = Person & {
  /** 디스코드 서버 별명. 없으면 null. */
  discordNickname: string | null;
  /** 이 스터디의 네비게이터(`PARTICIPANT_ROLE = LEADER`) — 출석부 역할 칩 · 참여 중단 잠금. */
  role?: 'navigator';
};

/**
 * 반 참가자 — 일정 탭(발표자)과 출석 탭(출석부 줄)이 같이 쓴다.
 *
 * 참여 명단의 활동 중 · 휴식 중인 그 반 사람이다 (회차 스펙 participants 와 같은 범위).
 * 이름은 닉네임 그대로다 — 출석부는 디스코드 닉네임 열이 따로 있다. 드롭다운처럼 이름만 보이는 곳은 `distinctNames`.
 */
export function useCrew(studyId: number, groupId?: string): CrewMember[] {
  const participants = useParticipants(studyId);
  return useMemo(
    () =>
      (participants.data?.participants ?? [])
        .filter((p) => p.status === 'ACTIVE' || p.status === 'PAUSED')
        .filter((p) => !groupId || String(p.groupId) === groupId)
        .map((p) => ({
          id: String(p.participantId),
          name: p.nickname,
          discordNickname: p.discordNickname,
          ...(p.participantRole === 'LEADER' && { role: 'navigator' as const }),
        })),
    [participants.data, groupId],
  );
}

/** 이름만 보이는 곳(발표자 드롭다운)용 — 닉네임이 겹치는 사람은 디스코드 닉네임을 붙여 가른다. */
export function distinctNames(crew: CrewMember[]): CrewMember[] {
  const count = new Map<string, number>();
  for (const c of crew) count.set(c.name, (count.get(c.name) ?? 0) + 1);
  return crew.map((c) =>
    (count.get(c.name) ?? 0) > 1 && c.discordNickname ? { ...c, name: `${c.name} (${c.discordNickname})` } : c,
  );
}
