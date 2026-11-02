// 운영 대시보드 집계 목 — specs/dashboard/spec.md 4절 응답 모양 그대로.
// 집계 자체는 서버 일이라 여기서 다시 세지 않는다. 화면이 그릴 수 있는 그럴듯한 값만 둔다.
// 날짜는 지금 시각 기준으로 만든다 — 고정 날짜면 마감 D-n·12주 추세가 시간이 지나며 어긋난다.
import { HttpResponse } from 'msw';

import { apiStudies } from '../data';
import { mockClient, type MockResolveContext } from '../utils';

type AggregateError = { errorCode: string; errorMessage: string };

export type ApiDashboardSummary = {
  asOf: string;
  timeZone: string;
  activeCrew?: number;
  activeEnrollments?: number;
  studiesPerCrew?: number | null;
  communityMembers?: number;
  attendanceRate?: number | null;
  attendanceComparison?: {
    currentWeekStart: string;
    previousWeekStart: string;
    currentRate: number | null;
    previousRate: number | null;
    deltaPercentagePoints: number | null;
  };
  errors: Partial<Record<'participation' | 'attendance' | 'communityMembers', AggregateError>>;
};

type BoardView = 'ONGOING' | 'RECRUITMENT';
type DeadlineBadge = 'DEADLINE_PASSED' | 'CAPACITY_FULL' | 'DEADLINE_MISSING' | 'CLOSING_SOON' | 'NORMAL';

export type ApiStudyBoardItem = {
  studyId: number;
  programId: number;
  title: string;
  recruitStatus?: 'RECRUITING' | 'RECRUIT_CLOSED' | null;
  recruitDeadlineAt?: string | null;
  deadlineBadge?: DeadlineBadge | null;
};

const DAY = 86_400_000;
const HOUR = 3_600_000;

const forbidden = { errorCode: 'FORBIDDEN', errorMessage: '권한이 없습니다.' };
const internalError = { errorCode: 'INTERNAL_ERROR', errorMessage: '집계 정보를 불러오지 못했습니다.' };

/** 조회자 시간대 — 명시한 Query는 검증하고, mock 회원의 프로필(Asia/Seoul)을 우선한다. */
function timeZoneOf(request: Request): string | Response {
  const raw = new URL(request.url).searchParams.get('timeZone');
  if (raw === null) return 'Asia/Seoul';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: raw });
    return 'Asia/Seoul';
  } catch {
    return HttpResponse.json(
      { errorCode: 'INVALID_INPUT', errorMessage: 'timeZone 이 올바르지 않습니다.' },
      { status: 400 },
    );
  }
}

/** 그 시간대의 달력 날짜 YYYY-MM-DD. */
function localDate(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
}

/** 그 시간대에서 이번 주 월요일 날짜. */
function mondayOf(at: Date, timeZone: string): string {
  const today = localDate(at, timeZone);
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDays(today, -((dow + 6) % 7));
}

function summary(timeZone: string, now = new Date()): ApiDashboardSummary {
  const currentWeekStart = mondayOf(now, timeZone);
  return {
    asOf: now.toISOString(),
    timeZone,
    activeCrew: 128,
    activeEnrollments: 173,
    studiesPerCrew: 173 / 128,
    communityMembers: 1462,
    attendanceRate: 78.43,
    attendanceComparison: {
      currentWeekStart,
      previousWeekStart: addDays(currentWeekStart, -7),
      currentRate: 74.5,
      previousRate: 81.25,
      deltaPercentagePoints: -6.75,
    },
    errors: {},
  };
}

function boardOf(view: BoardView, now = new Date()): ApiStudyBoardItem[] {
  if (view === 'ONGOING') {
    return apiStudies
      .filter((s) => s.phase === 'ONGOING')
      .map((s) => ({ studyId: s.studyId, programId: s.studyId, title: s.title }))
      .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : a.studyId - b.studyId));
  }
  // 모집 판정·표시 코드는 서버가 준다. 목은 다섯 경우를 한 번씩 보여 준다.
  const recruiting = apiStudies.filter((s) => s.phase === 'RECRUITING');
  const cases: { recruitStatus: 'RECRUITING' | 'RECRUIT_CLOSED'; deadline: number | null; badge: DeadlineBadge }[] = [
    { recruitStatus: 'RECRUITING', deadline: 50 * HOUR, badge: 'CLOSING_SOON' },
    { recruitStatus: 'RECRUITING', deadline: 9 * DAY, badge: 'NORMAL' },
    { recruitStatus: 'RECRUITING', deadline: null, badge: 'DEADLINE_MISSING' },
    { recruitStatus: 'RECRUIT_CLOSED', deadline: -2 * DAY, badge: 'DEADLINE_PASSED' },
    { recruitStatus: 'RECRUIT_CLOSED', deadline: 4 * DAY, badge: 'CAPACITY_FULL' },
  ];
  return recruiting.slice(0, cases.length).map((s, i) => {
    const c = cases[i]!;
    return {
      studyId: s.studyId,
      programId: s.studyId,
      title: s.title,
      recruitStatus: c.recruitStatus,
      recruitDeadlineAt: c.deadline === null ? null : new Date(now.getTime() + c.deadline).toISOString(),
      deadlineBadge: c.badge,
    };
  });
}

function studyBoard({ request }: MockResolveContext) {
  const timeZone = timeZoneOf(request);
  if (timeZone instanceof Response) return timeZone;
  const params = new URL(request.url).searchParams;
  const view = params.get('view');
  const limit = Number(params.get('limit') ?? '4');
  if ((view !== 'ONGOING' && view !== 'RECRUITMENT') || !Number.isInteger(limit) || limit < 1 || limit > 4) {
    return HttpResponse.json({ errorCode: 'INVALID_INPUT', errorMessage: '요청 값이 올바르지 않습니다.' }, { status: 400 });
  }
  const all = boardOf(view);
  return { asOf: new Date().toISOString(), timeZone, view, total: all.length, offset: 0, limit, items: all.slice(0, limit) };
}

/** 최근 12주. 쉬어 간 주(분모 0)는 null 이라 선이 끊긴다. */
const TREND_SHAPE: (readonly [number, number] | null)[] = [
  null,
  [52, 70],
  [55, 68],
  null,
  [60.5, 74],
  [63, 80],
  [58, 76],
  [66.5, 82],
  [70, 88],
  [72.5, 90],
  [78, 96],
  [41, 55],
];

function attendanceTrend({ request }: MockResolveContext) {
  const timeZone = timeZoneOf(request);
  if (timeZone instanceof Response) return timeZone;
  const weeks = new URL(request.url).searchParams.get('weeks');
  if (weeks !== null && weeks !== '12') {
    return HttpResponse.json({ errorCode: 'INVALID_INPUT', errorMessage: 'weeks 는 12만 허용합니다.' }, { status: 400 });
  }
  const now = new Date();
  const current = mondayOf(now, timeZone);
  const points = TREND_SHAPE.map((shape, i) => {
    const [weightedAttended, eligibleCount] = shape ?? [0, 0];
    return {
      weekStart: addDays(current, (i - (TREND_SHAPE.length - 1)) * 7),
      isCurrentWeek: i === TREND_SHAPE.length - 1,
      weightedAttended,
      eligibleCount,
      rate: eligibleCount === 0 ? null : (100 * weightedAttended) / eligibleCount,
    };
  });
  const rates = points.flatMap((p) => (p.rate === null ? [] : [p.rate]));
  return {
    asOf: now.toISOString(),
    timeZone,
    averageRate: rates.length === 0 ? null : rates.reduce((a, b) => a + b, 0) / rates.length,
    points,
  };
}

function studiesByCategory() {
  const counts = new Map<string, { ongoingCount: number; totalCount: number }>();
  for (const s of apiStudies) {
    const c = counts.get(s.category) ?? { ongoingCount: 0, totalCount: 0 };
    c.totalCount += 1;
    if (s.phase === 'ONGOING') c.ongoingCount += 1;
    counts.set(s.category, c);
  }
  return {
    asOf: new Date().toISOString(),
    categories: [...counts.entries()].map(([code, c]) => ({ code, ...c })),
  };
}

const crewTimezones = () => ({
  asOf: new Date().toISOString(),
  totalCrew: 128,
  timeZoneGroups: [
    { code: 'KST', count: 81, percentage: (81 / 128) * 100 },
    { code: 'ET', count: 26, percentage: (26 / 128) * 100 },
    { code: 'PT', count: 17, percentage: (17 / 128) * 100 },
    { code: 'UNKNOWN', count: 4, percentage: (4 / 128) * 100 },
  ],
});

export const adminStatsHandlers = mockClient.createHandlerGroup('/api/admin/stats', [
  {
    method: 'GET',
    path: '/summary',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ request }: MockResolveContext) => {
          const timeZone = timeZoneOf(request);
          return timeZone instanceof Response ? timeZone : summary(timeZone);
        },
      },
      {
        label: '출석 집계만 실패',
        status: 200,
        response: ({ request }: MockResolveContext) => {
          const timeZone = timeZoneOf(request);
          if (timeZone instanceof Response) return timeZone;
          // 실패한 묶음의 필드는 응답에서 빠진다 (4.2)
          const rest = summary(timeZone);
          delete rest.attendanceRate;
          delete rest.attendanceComparison;
          return {
            ...rest,
            errors: { attendance: { errorCode: 'INTERNAL_ERROR', errorMessage: '출석 정보를 불러오지 못했습니다.' } },
          };
        },
      },
      {
        label: '대상 없음',
        status: 200,
        response: ({ request }: MockResolveContext) => {
          const timeZone = timeZoneOf(request);
          if (timeZone instanceof Response) return timeZone;
          const base = summary(timeZone);
          return {
            ...base,
            activeCrew: 0,
            activeEnrollments: 0,
            studiesPerCrew: null,
            communityMembers: 0,
            attendanceRate: null,
            attendanceComparison: {
              ...base.attendanceComparison!,
              currentRate: null,
              previousRate: null,
              deltaPercentagePoints: null,
            },
          };
        },
      },
      { label: '서버 오류', status: 500, response: internalError },
      { label: '403 캡틴 아님', status: 403, response: forbidden },
    ],
  },
  {
    method: 'GET',
    path: '/study-board',
    presets: [
      { label: '정상', status: 200, response: studyBoard },
      {
        label: '빈 보드',
        status: 200,
        response: ({ request }: MockResolveContext) => {
          const timeZone = timeZoneOf(request);
          if (timeZone instanceof Response) return timeZone;
          const view = new URL(request.url).searchParams.get('view');
          return { asOf: new Date().toISOString(), timeZone, view, total: 0, offset: 0, limit: 4, items: [] };
        },
      },
      { label: '서버 오류', status: 500, response: internalError },
    ],
  },
  {
    method: 'GET',
    path: '/crew-timezones',
    presets: [
      { label: '정상', status: 200, response: crewTimezones },
      {
        label: '활성 크루 없음',
        status: 200,
        response: () => ({
          asOf: new Date().toISOString(),
          totalCrew: 0,
          timeZoneGroups: ['KST', 'ET', 'PT', 'UNKNOWN'].map((code) => ({ code, count: 0, percentage: null })),
        }),
      },
      { label: '서버 오류', status: 500, response: internalError },
    ],
  },
  {
    method: 'GET',
    path: '/attendance-trend',
    presets: [
      { label: '정상', status: 200, response: attendanceTrend },
      { label: '서버 오류', status: 500, response: internalError },
    ],
  },
  {
    method: 'GET',
    path: '/studies-by-category',
    presets: [
      { label: '정상', status: 200, response: studiesByCategory },
      { label: '빈 집계', status: 200, response: () => ({ asOf: new Date().toISOString(), categories: [] }) },
      { label: '서버 오류', status: 500, response: internalError },
    ],
  },
]);
