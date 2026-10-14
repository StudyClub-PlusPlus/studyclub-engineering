import type { ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Dashboard from '@/app/page';
import type {
  ApiAttendanceTrend,
  ApiCrewTimezones,
  ApiDashboardSummary,
  ApiStudiesByCategory,
  ApiStudyBoard,
} from '@/features/dashboard/types';
import { ApiError, http } from '@/lib/http';

// 서버는 http 한 곳으로 막는다 — 경로·Query 까지 함께 확인한다.
vi.mock('@/lib/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/http')>()),
  http: vi.fn(),
}));

const httpMock = vi.mocked(http);

const NY = 'America/New_York';
// spec 4.2~4.6 예시와 같은 기준 시각 — 뉴욕은 15일(화) 밤, 이번 주 월요일은 14일
const AS_OF = '2026-09-16T03:00:00Z';

// 브라우저 시간대는 Intl 에서 읽는다 — 테스트마다 정한다(undefined = 읽지 못함)
let viewerZone: string | undefined;
const realResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;

const SUMMARY: ApiDashboardSummary = {
  asOf: AS_OF,
  timeZone: NY,
  activeCrew: 128,
  activeEnrollments: 173,
  studiesPerCrew: 173 / 128,
  communityMembers: 1462,
  attendanceRate: 78.43,
  attendanceComparison: {
    currentWeekStart: '2026-09-14',
    previousWeekStart: '2026-09-07',
    currentRate: 74.5,
    previousRate: 81.25,
    deltaPercentagePoints: -6.75,
  },
  errors: {},
};

const ONGOING: ApiStudyBoard = {
  asOf: AS_OF,
  timeZone: NY,
  view: 'ONGOING',
  total: 6,
  offset: 0,
  limit: 4,
  items: [11, 12, 13, 14].map((id) => ({ studyId: id, programId: id, title: `진행 스터디 ${id}` })),
};

const RECRUITMENT: ApiStudyBoard = {
  asOf: AS_OF,
  timeZone: NY,
  view: 'RECRUITMENT',
  total: 5,
  offset: 0,
  limit: 4,
  items: [
    {
      studyId: 21,
      programId: 2,
      title: '시스템 디자인 3기',
      recruitStatus: 'RECRUITING',
      recruitDeadlineAt: '2026-09-18T14:59:00Z',
      deadlineBadge: 'CLOSING_SOON',
    },
    { studyId: 22, programId: 3, title: '상시 모집', recruitStatus: 'RECRUITING', recruitDeadlineAt: null, deadlineBadge: 'DEADLINE_MISSING' },
    {
      studyId: 23,
      programId: 4,
      title: '데이터 분석 1기',
      recruitStatus: 'RECRUIT_CLOSED',
      recruitDeadlineAt: '2026-09-15T00:00:00Z',
      deadlineBadge: 'DEADLINE_PASSED',
    },
    {
      studyId: 24,
      programId: 5,
      title: '정원 찬 스터디',
      recruitStatus: 'RECRUIT_CLOSED',
      recruitDeadlineAt: '2026-09-30T14:59:00Z',
      deadlineBadge: 'CAPACITY_FULL',
    },
  ],
};

const CREW: ApiCrewTimezones = {
  asOf: AS_OF,
  totalCrew: 3,
  timeZoneGroups: [
    { code: 'KST', count: 2, percentage: 66.666 },
    { code: 'ET', count: 1, percentage: 33.333 },
    { code: 'PT', count: 0, percentage: 0 },
    { code: 'UNKNOWN', count: 0, percentage: 0 },
  ],
};

function week(i: number) {
  return new Date(Date.parse('2026-06-29T00:00:00Z') + i * 7 * 86_400_000).toISOString().slice(0, 10);
}

const TREND: ApiAttendanceTrend = {
  asOf: AS_OF,
  timeZone: NY,
  averageRate: 75,
  points: Array.from({ length: 12 }, (_, i) => {
    const values: Record<number, [number, number]> = { 10: [8.5, 10], 11: [6.5, 10] };
    const [weightedAttended, eligibleCount] = values[i] ?? [0, 0];
    return {
      weekStart: week(i),
      isCurrentWeek: i === 11,
      weightedAttended,
      eligibleCount,
      rate: eligibleCount === 0 ? null : (100 * weightedAttended) / eligibleCount,
    };
  }),
};

const CATEGORIES: ApiStudiesByCategory = {
  asOf: AS_OF,
  categories: [
    { code: 'SOFTWARE', ongoingCount: 1, totalCount: 3 },
    { code: 'AI_ML', ongoingCount: 2, totalCount: 2 },
    { code: 'DATA', ongoingCount: 0, totalCount: 1 },
  ],
};

type Endpoint =
  | 'summary'
  | 'study-board:ONGOING'
  | 'study-board:RECRUITMENT'
  | 'crew-timezones'
  | 'attendance-trend'
  | 'studies-by-category';

const DEFAULTS: Record<Endpoint, unknown> = {
  summary: SUMMARY,
  'study-board:ONGOING': ONGOING,
  'study-board:RECRUITMENT': RECRUITMENT,
  'crew-timezones': CREW,
  'attendance-trend': TREND,
  'studies-by-category': CATEGORIES,
};

function endpointOf(path: unknown): Endpoint {
  const url = new URL(String(path), 'http://x');
  const name = url.pathname.replace('/api/admin/stats/', '');
  return (name === 'study-board' ? `${name}:${url.searchParams.get('view')}` : name) as Endpoint;
}

/** 경로마다 응답을 고른다. Error 를 넣으면 그 요청이 실패한다. */
function respond(overrides: Partial<Record<Endpoint, unknown>> = {}) {
  httpMock.mockImplementation(async (path) => {
    const value = { ...DEFAULTS, ...overrides }[endpointOf(path)];
    if (value instanceof Error) throw value;
    return value;
  });
}

/** 필드를 뺀 응답 — 서버는 실패한 묶음과 값이 없는 필드를 싣지 않는다. */
function without<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

const callsTo = (endpoint: Endpoint) => httpMock.mock.calls.filter(([path]) => endpointOf(path) === endpoint);
const serverError = () => new ApiError(500, '집계 정보를 불러오지 못했습니다.');

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...render(<Dashboard />, { wrapper }) };
}

const kpi = (anno: string) => document.querySelector<HTMLElement>(`[data-anno="${anno}"]`)!;
/** 보드 칸 — 제목의 칸 전체 */
const boardColumn = (title: string) => screen.getByRole('heading', { name: title }).parentElement!.parentElement!;
const LOAD_FAILED = '정보를 불러오지 못했습니다.';

beforeEach(() => {
  httpMock.mockReset();
  viewerZone = NY;
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(function (this: Intl.DateTimeFormat) {
    return { ...realResolvedOptions.call(this), timeZone: viewerZone as string };
  });
  respond();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('요청', () => {
  it('요약·보드·추세에는 브라우저 시간대를 같이 보내고, 분포·카테고리에는 보내지 않는다', async () => {
    renderDashboard();
    await screen.findByText('1,462');

    expect(httpMock.mock.calls.map(([path]) => path).sort()).toEqual(
      [
        '/api/admin/stats/attendance-trend?weeks=12&timeZone=America%2FNew_York',
        '/api/admin/stats/crew-timezones',
        '/api/admin/stats/studies-by-category',
        '/api/admin/stats/study-board?view=ONGOING&limit=4&timeZone=America%2FNew_York',
        '/api/admin/stats/study-board?view=RECRUITMENT&limit=4&timeZone=America%2FNew_York',
        '/api/admin/stats/summary?timeZone=America%2FNew_York',
      ].sort(),
    );
  });

  it('시간대를 읽지 못하면 Query 를 빼고 보낸다 — 서버가 회원 설정 → UTC 로 정한다', async () => {
    viewerZone = undefined;
    renderDashboard();
    await screen.findByText('1,462');

    expect(callsTo('summary')[0][0]).toBe('/api/admin/stats/summary');
    expect(callsTo('attendance-trend')[0][0]).toBe('/api/admin/stats/attendance-trend?weeks=12');
  });
});

describe('제목 줄 · KPI', () => {
  it('범위와 갱신 시각을 응답 시간대로 적고, KPI 넷을 형식대로 그린다', async () => {
    renderDashboard();

    expect(await screen.findByText('전기간 기준 · 2026-09-15 23:00 EDT 갱신')).toBeInTheDocument();
    expect(within(kpi('2-1')).getByText('128')).toBeInTheDocument();
    expect(within(kpi('2-2')).getByText('78%')).toBeInTheDocument();
    expect(within(kpi('2-2')).getByText('전주 대비 6.8%p 하락')).toBeInTheDocument();
    expect(within(kpi('2-3')).getByText('1.4개')).toBeInTheDocument();
    expect(within(kpi('2-4')).getByText('1,462')).toBeInTheDocument();
  });

  it('활성 크루는 누를 수 없고, 커뮤니티 멤버는 필터 없는 유저 목록으로 간다', async () => {
    renderDashboard();
    await screen.findByText('1,462');

    expect(kpi('2-1').closest('a')).toBeNull();
    expect(kpi('2-4').closest('a')).toHaveAttribute('href', '/users');
  });

  it('출석 묶음만 실패하면 출석률 카드만 실패로 그린다 — 다른 카드는 그대로', async () => {
    const rest = without(SUMMARY, 'attendanceRate', 'attendanceComparison');
    respond({
      summary: { ...rest, errors: { attendance: { errorCode: 'INTERNAL_ERROR', errorMessage: '출석 정보를 불러오지 못했습니다.' } } },
    });
    renderDashboard();

    expect(await within(kpi('2-1')).findByText('128')).toBeInTheDocument();
    expect(within(kpi('2-2')).getByText(LOAD_FAILED)).toBeInTheDocument();
    expect(within(kpi('2-2')).queryByText(/%p/)).toBeNull();
    expect(screen.getAllByText(LOAD_FAILED)).toHaveLength(1);
  });

  it('errors 에 묶음이 있으면 값이 와 있어도 쓰지 않는다', async () => {
    respond({
      summary: { ...SUMMARY, errors: { participation: { errorCode: 'INTERNAL_ERROR', errorMessage: '실패' } } },
    });
    renderDashboard();

    expect(await within(kpi('2-1')).findByText(LOAD_FAILED)).toBeInTheDocument();
    expect(within(kpi('2-3')).getByText(LOAD_FAILED)).toBeInTheDocument();
    expect(screen.queryByText('128')).toBeNull();
  });

  it('요약 요청 전체가 실패하면 KPI 넷 다 실패, 제목 줄은 범위만 — 보드·차트는 그대로 그린다', async () => {
    respond({ summary: serverError() });
    renderDashboard();

    await waitFor(() => expect(screen.getAllByText(LOAD_FAILED)).toHaveLength(4));
    expect(screen.getByText('전기간 기준')).toBeInTheDocument();
    expect(screen.queryByText(/갱신/)).toBeNull();
    expect(screen.getByText('진행 스터디 11')).toBeInTheDocument();
    expect(screen.getByText('평균 75%')).toBeInTheDocument();
  });

  it('커뮤니티 멤버 묶음만 실패하면 그 카드만 실패로 그린다', async () => {
    respond({
      summary: { ...without(SUMMARY, 'communityMembers'), errors: { communityMembers: { errorCode: 'INTERNAL_ERROR', errorMessage: '실패' } } },
    });
    renderDashboard();

    expect(await within(kpi('2-4')).findByText(LOAD_FAILED)).toBeInTheDocument();
    expect(screen.getAllByText(LOAD_FAILED)).toHaveLength(1);
    expect(within(kpi('2-2')).getByText('78%')).toBeInTheDocument();
  });

  it('다시 읽다 실패하면 받아 두었던 수를 남기지 않고 실패로 바꾼다 (spec 2.4)', async () => {
    const { client } = renderDashboard();
    expect(await within(kpi('2-1')).findByText('128')).toBeInTheDocument();

    respond({ summary: serverError() });
    await act(() => client.refetchQueries({ queryKey: ['dashboard', 'summary'] }));

    expect(within(kpi('2-1')).getByText(LOAD_FAILED)).toBeInTheDocument();
    expect(screen.queryByText('128')).toBeNull();
    expect(screen.getByText('전기간 기준')).toBeInTheDocument();
  });

  it('분모가 0 이라 값이 없으면(필드가 빠져도) 실패가 아니라 빈 상태 — 증감은 숨긴다', async () => {
    const rest = without(SUMMARY, 'attendanceRate', 'studiesPerCrew');
    respond({
      summary: {
        ...rest,
        activeCrew: 0,
        activeEnrollments: 0,
        attendanceComparison: { ...SUMMARY.attendanceComparison!, currentRate: null, deltaPercentagePoints: null },
      },
    });
    renderDashboard();

    expect(await within(kpi('2-1')).findByText('0')).toBeInTheDocument();
    expect(within(kpi('2-2')).getByText('—')).toBeInTheDocument();
    expect(within(kpi('2-2')).getByText('아직 출석 기록이 없습니다.')).toBeInTheDocument();
    expect(within(kpi('2-3')).getByText('활성 크루가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText(/%p/)).toBeNull();
    expect(screen.queryByText(LOAD_FAILED)).toBeNull();
  });
});

describe('현황 보드', () => {
  it('이름은 상세로, 남은 건수는 「외 N개」로 전체 보기와 같은 곳에 — 건수는 total', async () => {
    renderDashboard();
    const ongoing = boardColumn('진행중 스터디');

    expect(await within(ongoing).findByRole('link', { name: '진행 스터디 11' })).toHaveAttribute('href', '/studies/11');
    expect(within(ongoing).getByText('6')).toBeInTheDocument();
    expect(within(ongoing).getByRole('link', { name: '외 2개 스터디' })).toHaveAttribute('href', '/studies?view=ongoing');
    expect(within(ongoing).getByRole('link', { name: '전체 보기' })).toHaveAttribute('href', '/studies?view=ongoing');

    const recruitment = boardColumn('모집중 스터디');
    expect(within(recruitment).getByRole('link', { name: '외 1개 스터디' })).toHaveAttribute(
      'href',
      '/studies?view=recruitment',
    );
  });

  it('모집중 마감 칸 — 서버 코드로 문구를 고르고 D-N 은 응답 시간대로. 임박·오늘 마감은 쓰지 않는다', async () => {
    renderDashboard();
    const recruitment = boardColumn('모집중 스터디');

    expect(await within(recruitment).findByText('~09-18 (D-3)')).toBeInTheDocument();
    expect(within(recruitment).getByText('마감일 미등록')).toBeInTheDocument();
    expect(within(recruitment).getByText('~09-14 (마감 경과)')).toBeInTheDocument();
    expect(within(recruitment).getByText('~09-30 (정원 마감)')).toBeInTheDocument();
    expect(screen.queryByText(/임박|오늘 마감/)).toBeNull();
  });

  it('칸이 비면 그 칸에 안내, 한 칸이 실패해도 다른 칸은 그린다', async () => {
    respond({
      'study-board:ONGOING': { ...ONGOING, total: 0, items: [] },
      'study-board:RECRUITMENT': serverError(),
    });
    renderDashboard();

    expect(await screen.findByText('진행중 스터디가 없습니다.')).toBeInTheDocument();
    expect(await within(boardColumn('모집중 스터디')).findByText(LOAD_FAILED)).toBeInTheDocument();
    expect(within(boardColumn('진행중 스터디')).getByRole('link', { name: '전체 보기' })).toBeInTheDocument();
  });
});

describe('크루 지역 분포', () => {
  it('미분류가 0명이면 범례에서 숨기고, 비율은 그룹마다 반올림한다', async () => {
    renderDashboard();

    expect(await screen.findByText('한국')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText('북미 서부')).toBeInTheDocument();
    expect(screen.queryByText('미분류')).toBeNull();
  });

  it('미분류가 있으면 범례 끝에 보인다', async () => {
    respond({
      'crew-timezones': {
        ...CREW,
        totalCrew: 4,
        timeZoneGroups: [
          { code: 'KST', count: 2, percentage: 50 },
          { code: 'ET', count: 1, percentage: 25 },
          { code: 'PT', count: 0, percentage: 0 },
          { code: 'UNKNOWN', count: 1, percentage: 25 },
        ],
      },
    });
    renderDashboard();

    expect(await screen.findByText('미분류')).toBeInTheDocument();
    expect(screen.getAllByText('25%')).toHaveLength(2);
  });

  it('활성 크루가 없으면 차트 대신 안내', async () => {
    respond({
      'crew-timezones': {
        asOf: AS_OF,
        totalCrew: 0,
        timeZoneGroups: CREW.timeZoneGroups.map((g) => ({ ...g, count: 0, percentage: null })),
      },
    });
    renderDashboard();

    expect(await screen.findByText('활성 크루가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText('한국')).toBeNull();
  });
});

describe('평균 출석률 추세', () => {
  it('값 있는 주만 점을 찍고, 평균은 서버 값 — 점을 짚으면 그 주의 밑재료를 알린다', async () => {
    renderDashboard();

    expect(await screen.findByText('평균 75%')).toBeInTheDocument();
    const points = screen.getAllByRole('button', { name: /주.* · 출석률/ });
    expect(points).toHaveLength(2);

    act(() => points[0]!.focus());
    expect(screen.getByText('2026-09-07 주 · 출석률 85% (출석 8.5 / 대상 10) · America/New_York 기준')).toBeInTheDocument();
  });

  it('값이 한 주뿐이면 선 없이 점 하나만 찍는다', async () => {
    respond({
      'attendance-trend': {
        ...TREND,
        averageRate: 65,
        points: TREND.points.map((p, i) =>
          i === 11 ? p : { ...p, weightedAttended: 0, eligibleCount: 0, rate: null },
        ),
      },
    });
    renderDashboard();

    expect(await screen.findByText('평균 65%')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /주.* · 출석률/ })).toHaveLength(1);
    expect(document.querySelectorAll('polyline')).toHaveLength(0);
  });

  it('모든 주가 비면 차트 대신 안내', async () => {
    respond({
      'attendance-trend': {
        ...TREND,
        averageRate: null,
        points: TREND.points.map((p) => ({ ...p, weightedAttended: 0, eligibleCount: 0, rate: null })),
      },
    });
    renderDashboard();

    expect(await screen.findByText('아직 출석 기록이 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText(/평균 \d+%/)).toBeNull();
  });
});

describe('카테고리별 스터디 수', () => {
  const rowNames = () =>
    screen.getAllByRole('link', { name: /스터디 \d+개 — 목록 보기/ }).map((a) => [a.getAttribute('aria-label'), a.getAttribute('href')]);

  it('진행중이 기본 — 0개는 숨기고 많은 순, 행은 카테고리 코드로 목록에 간다', async () => {
    renderDashboard();
    await screen.findByText('AI · ML');

    expect(rowNames()).toEqual([
      ['AI · ML 진행중 스터디 2개 — 목록 보기', '/studies?view=ongoing&category=AI_ML'],
      ['소프트웨어 개발 진행중 스터디 1개 — 목록 보기', '/studies?view=ongoing&category=SOFTWARE'],
    ]);
  });

  it('누적으로 바꾸면 다시 부르지 않고 순서·링크만 바뀐다', async () => {
    renderDashboard();
    await screen.findByText('AI · ML');

    fireEvent.click(screen.getByRole('tab', { name: '누적' }));
    expect(rowNames()).toEqual([
      ['소프트웨어 개발 누적 스터디 3개 — 목록 보기', '/studies?view=cumulative&category=SOFTWARE'],
      ['AI · ML 누적 스터디 2개 — 목록 보기', '/studies?view=cumulative&category=AI_ML'],
      ['데이터 누적 스터디 1개 — 목록 보기', '/studies?view=cumulative&category=DATA'],
    ]);
    expect(callsTo('studies-by-category')).toHaveLength(1);
  });
});

describe('조회 중 기준이 바뀌면 (spec 2.3)', () => {
  it('요약과 추세의 이번 주가 다르면 둘만 한 번 더 부른다 — 또 달라도 거기서 멈춘다', async () => {
    respond({
      summary: {
        ...SUMMARY,
        attendanceComparison: { ...SUMMARY.attendanceComparison!, currentWeekStart: '2026-09-07' },
      },
    });
    renderDashboard();

    await waitFor(() => expect(callsTo('summary')).toHaveLength(2));
    await waitFor(() => expect(callsTo('attendance-trend')).toHaveLength(2));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(callsTo('summary')).toHaveLength(2);
    expect(callsTo('study-board:ONGOING')).toHaveLength(1);
    expect(callsTo('study-board:RECRUITMENT')).toHaveLength(1);
    expect(callsTo('crew-timezones')).toHaveLength(1);
  });

  it('응답 시간대가 서로 다르면 전체를 한 번 더 부른다', async () => {
    respond({ 'study-board:RECRUITMENT': { ...RECRUITMENT, timeZone: 'Asia/Seoul' } });
    renderDashboard();

    await waitFor(() => expect(callsTo('crew-timezones')).toHaveLength(2));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(callsTo('summary')).toHaveLength(2);
    expect(callsTo('studies-by-category')).toHaveLength(2);
  });
});
