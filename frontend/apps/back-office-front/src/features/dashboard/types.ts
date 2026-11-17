// 운영 대시보드 응답 타입 — specs/dashboard/spec.md 4절. 집계·판정은 서버가 끝내서 준다. 화면은 그리기만 한다.

export type AggregateKey = 'participation' | 'attendance' | 'communityMembers';

export type ApiAggregateError = { errorCode: string; errorMessage: string };

export type ApiAttendanceComparison = {
  /** 응답 timeZone 기준 이번 주 월요일 (YYYY-MM-DD). UTC 로 다시 해석하지 않는다. */
  currentWeekStart: string;
  previousWeekStart: string;
  currentRate: number | null;
  previousRate: number | null;
  /** currentRate − previousRate. 둘 중 하나라도 null 이면 null — 화면은 증감을 숨긴다. */
  deltaPercentagePoints: number | null;
};

/**
 * 4.2 요약. 묶음(`AggregateKey`)마다 따로 성공·실패한다.
 *
 * - 실패한 묶음의 필드는 **빠지고** `errors` 에 그 묶음이 들어온다.
 * - 성공했는데 분모가 0이라 값이 없는 필드도 null 대신 **빠질 수 있다**(서버가 null 을 싣지 않는다).
 *   그래서 실패는 필드가 있느냐가 아니라 `errors` 로만 가른다. `errors` 에 없는 묶음의 빠진 필드는 null 이다.
 */
export type ApiDashboardSummary = {
  asOf: string;
  timeZone: string;
  activeCrew?: number;
  activeEnrollments?: number;
  studiesPerCrew?: number | null;
  communityMembers?: number;
  attendanceRate?: number | null;
  attendanceComparison?: ApiAttendanceComparison;
  errors: Partial<Record<AggregateKey, ApiAggregateError>>;
};

/** 보드 구분 — DB 상태값이 아니라 화면 구분이다. */
export type StudyBoardView = 'ONGOING' | 'RECRUITMENT';

export type RecruitStatus = 'RECRUITING' | 'RECRUIT_CLOSED';

/** 4.3 마감 표시 코드. 서버가 같은 asOf 로 고른다. 화면은 이 코드로 문구를 고른다(날짜로 다시 판정하지 않는다). */
export type DeadlineBadge = 'DEADLINE_PASSED' | 'CAPACITY_FULL' | 'DEADLINE_MISSING' | 'CLOSING_SOON' | 'NORMAL';

/** 진행중 항목에는 모집 필드가 없다(null 이거나 빠진다). */
export type ApiStudyBoardItem = {
  studyId: number;
  programId: number;
  title: string;
  recruitStatus?: RecruitStatus | null;
  recruitDeadlineAt?: string | null;
  deadlineBadge?: DeadlineBadge | null;
};

export type ApiStudyBoard = {
  asOf: string;
  timeZone: string;
  view: StudyBoardView;
  /** 보드 대상 전체 수 — 미리보기로 자르기 전. */
  total: number;
  offset: number;
  limit: number;
  items: ApiStudyBoardItem[];
};

/** 차트 그룹 코드. 날짜 계산용 IANA 시간대와 다른 값이다. */
export type CrewTimeZoneGroupCode = 'KST' | 'ET' | 'PT' | 'UNKNOWN';

export type ApiCrewTimezones = {
  asOf: string;
  totalCrew: number;
  /** KST · ET · PT · UNKNOWN 네 개가 이 순서로 늘 온다. 인원 합 = totalCrew. */
  timeZoneGroups: { code: CrewTimeZoneGroupCode; count: number; percentage: number | null }[];
};

export type ApiTrendPoint = {
  weekStart: string;
  isCurrentWeek: boolean;
  /** 출석 + 휴가 + 0.5 × 지각. 0.5 단위가 남는다. */
  weightedAttended: number;
  eligibleCount: number;
  /** 분모 0 이면 null — 그 주를 가로질러 선을 잇지 않는다. */
  rate: number | null;
};

export type ApiAttendanceTrend = {
  asOf: string;
  timeZone: string;
  /** null 이 아닌 주별 출석률의 단순 평균. 값 있는 주가 없으면 null. */
  averageRate: number | null;
  /** 정확히 12개, 오래된 주부터. */
  points: ApiTrendPoint[];
};

export type ApiStudiesByCategory = {
  asOf: string;
  /** StudyCategory 코드별 진행중·누적 기수 수. 둘 다 0 인 카테고리는 빠질 수 있다. */
  categories: { code: string; ongoingCount: number; totalCount: number }[];
};

/** 카테고리 카드의 범위 — 저장하지 않는다. 새로고침하면 「진행중」으로 돌아간다. */
export type CategoryScope = 'ongoing' | 'cumulative';
