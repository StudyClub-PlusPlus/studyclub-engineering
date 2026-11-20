/** 프로토의 명부 이력. 실제 앱에서는 서버가 같은 기준으로 dormant를 내려준다. */
export type RosterPeriod = {
  studyId: string;
  joinedAt: string | null;
  /** 스터디가 아직 끝나지 않은 ACTIVE·PAUSED 명부만 true. 출석 여부는 보지 않는다. */
  ongoing: boolean;
  /** 완주자는 스터디 종료일, 하차자는 하차일과 스터디 종료일 중 이른 시각. 모르면 null. */
  endedAt: string | null;
};

export type DormancyFacts = {
  joinedAt: string | null;
  /** 사용자 사이트·백오피스와 모든 로그인 수단을 합친 가장 최근 로그인 시각. 모르면 null. */
  lastLoginAt: string | null;
  /** null은 이력 미확인, 빈 배열은 참여 이력이 없음을 확인한 상태. */
  rosterPeriods: RosterPeriod[] | null;
};

export const DORMANCY_DAYS = 180;
export const DORMANCY_DESCRIPTION = '최근 180일간 스터디 참여 및 로그인 기록이 없는 회원';
const DAY_MS = 86_400_000;

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 역할과 무관하게 판정한다. 기록이 불완전하면 휴면 표시를 보류한다. */
export function isDormant(facts: DormancyFacts, now: Date): boolean {
  const cutoff = now.getTime() - DORMANCY_DAYS * DAY_MS;
  const joinedAt = timestamp(facts.joinedAt);
  const lastLoginAt = timestamp(facts.lastLoginAt);
  if (!Number.isFinite(cutoff) || joinedAt === null || lastLoginAt === null || facts.rosterPeriods === null)
    return false;
  if (joinedAt >= cutoff || lastLoginAt >= cutoff) return false;

  return facts.rosterPeriods.every((period) => {
    if (period.ongoing) return false;
    const start = timestamp(period.joinedAt);
    const end = timestamp(period.endedAt);
    // 편입일만 오래됐어도 최근까지 명부에 있었다면 최근 참여다. 날짜가 없거나 역전돼도 휴면으로 보지 않는다.
    return start !== null && end !== null && start <= end && end < cutoff;
  });
}
