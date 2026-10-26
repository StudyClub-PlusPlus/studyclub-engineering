// 운영 대시보드 — 키·fetcher·훅을 한 파일에 둔다.
// 영역마다 따로 부른다. 하나가 실패해도 나머지는 그린다 (PRD §3 API · spec 2.4).
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import type {
  ApiAttendanceTrend,
  ApiCrewTimezones,
  ApiDashboardSummary,
  ApiStudiesByCategory,
  ApiStudyBoard,
  StudyBoardView,
} from '@/features/dashboard/types';
import { http, qs } from '@/lib/http';

/** 보드 칸마다 보여 주는 최대 행 수. 나머지는 「외 N개」로 접는다. */
export const BOARD_PREVIEW = 4;
/** 추세 구간. 서버는 12만 받는다. */
export const TREND_WEEKS = 12;

/**
 * 시간대를 받는 API 는 시간대를 키에 넣는다 — 시간대가 다르면 주간 집계·날짜가 다른 응답이다 (spec 4.1).
 * `['dashboard']` 를 무효화하면 전부 다시 부른다.
 */
export const dashboardKeys = {
  all: ['dashboard'] as const,
  summaryAll: () => [...dashboardKeys.all, 'summary'] as const,
  summary: (timeZone: string | undefined) => [...dashboardKeys.summaryAll(), timeZone ?? null] as const,
  board: (view: StudyBoardView, timeZone: string | undefined) =>
    [...dashboardKeys.all, 'study-board', view, timeZone ?? null] as const,
  crewTimezones: () => [...dashboardKeys.all, 'crew-timezones'] as const,
  trendAll: () => [...dashboardKeys.all, 'attendance-trend'] as const,
  trend: (timeZone: string | undefined) => [...dashboardKeys.trendAll(), timeZone ?? null] as const,
  categories: () => [...dashboardKeys.all, 'studies-by-category'] as const,
};

/**
 * 들어올 때마다 다시 읽는다 (spec 2.1). 앱 기본값(1분)이면 1분 안에 돌아왔을 때 옛 수가 그대로 남는다.
 * 다시 읽는 동안에는 받아 둔 값을 그대로 보인다 — 실패하면 그 카드만 실패로 바꾼다(이전 값을 남기지 않는다).
 */
const ON_ENTRY = { staleTime: 0 } as const;

/** 서버 렌더 — 브라우저 시간대를 아직 못 읽었다. */
const NOT_READ = null;

function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}

const noSubscription = () => () => {};

/**
 * 조회자 시간대 (spec 2.2). 페이지에 들어올 때 브라우저에서 읽는다.
 *
 * - `ready` 가 false 면 서버 렌더다 — 시간대를 쓰는 요청을 아직 보내지 않는다.
 * - 읽지 못하면 `timeZone` 이 undefined 다 — Query 를 빼고 보내면 서버가 회원 설정 → UTC 로 정한다.
 * 이 조회는 회원 설정(ACCOUNT.TIME_ZONE)을 바꾸지 않는다.
 */
export function useViewerTimeZone(): { ready: boolean; timeZone: string | undefined } {
  const value = useSyncExternalStore(noSubscription, detectTimeZone, () => NOT_READ);
  return { ready: value !== NOT_READ, timeZone: value || undefined };
}

export function useDashboardSummary(timeZone: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.summary(timeZone),
    queryFn: () => http<ApiDashboardSummary>(`/api/admin/stats/summary${qs({ timeZone })}`),
    enabled,
    ...ON_ENTRY,
  });
}

export function useStudyBoard(view: StudyBoardView, timeZone: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.board(view, timeZone),
    queryFn: () =>
      http<ApiStudyBoard>(`/api/admin/stats/study-board${qs({ view, limit: BOARD_PREVIEW, timeZone })}`),
    enabled,
    ...ON_ENTRY,
  });
}

/** 회원 설정 시간대로 분류한다 — 조회자 시간대와 상관없어 Query 가 없다. */
export function useCrewTimezones() {
  return useQuery({
    queryKey: dashboardKeys.crewTimezones(),
    queryFn: () => http<ApiCrewTimezones>('/api/admin/stats/crew-timezones'),
    ...ON_ENTRY,
  });
}

export function useAttendanceTrend(timeZone: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.trend(timeZone),
    queryFn: () =>
      http<ApiAttendanceTrend>(`/api/admin/stats/attendance-trend${qs({ weeks: TREND_WEEKS, timeZone })}`),
    enabled,
    ...ON_ENTRY,
  });
}

/** 진행중·누적을 한 번에 받는다 — 범위를 바꿀 때 다시 부르지 않는다 (spec 4.7). */
export function useStudiesByCategory() {
  return useQuery({
    queryKey: dashboardKeys.categories(),
    queryFn: () => http<ApiStudiesByCategory>('/api/admin/stats/studies-by-category'),
    ...ON_ENTRY,
  });
}

/**
 * 영역마다 따로 부르므로 그 사이에 기준이 바뀔 수 있다 (spec 2.3). 어긋나면 **한 번만** 다시 부른다.
 *
 * - 요약·보드·추세의 `timeZone` 이 서로 다르면 — 전체를 다시 부른다
 *   (Query 를 뺐을 때 그 사이 회원 설정이 바뀐 경우다)
 * - 요약의 이번 주와 추세의 이번 주가 다르면 — 조회 중에 주가 바뀐 것이다. 요약·추세를 함께 다시 부른다
 *
 * 다시 불러도 어긋나면 그대로 둔다 — 경계 시각에 걸리면 계속 부르다 끝나지 않을 수 있다.
 * 다시 읽는 중인 응답이 있으면 비교하지 않는다 — 지난 방문의 캐시와 새 응답이 잠깐 섞인 것을 어긋남으로 보지 않게.
 */
export function useDashboardConsistency({
  summary: summaryQuery,
  boards: boardQueries,
  trend: trendQuery,
}: {
  summary: Pick<UseQueryResult<ApiDashboardSummary>, 'data' | 'isFetching'>;
  boards: Pick<UseQueryResult<ApiStudyBoard>, 'data' | 'isFetching'>[];
  trend: Pick<UseQueryResult<ApiAttendanceTrend>, 'data' | 'isFetching'>;
}) {
  const queryClient = useQueryClient();
  const retried = useRef(false);

  const settled = ![summaryQuery, ...boardQueries, trendQuery].some((q) => q.isFetching);
  const summary = settled ? summaryQuery.data : undefined;
  const boards = settled ? boardQueries.map((q) => q.data) : [];
  const trend = settled ? trendQuery.data : undefined;

  const zones = new Set(
    [summary?.timeZone, ...boards.map((b) => b?.timeZone), trend?.timeZone].filter((z) => z !== undefined),
  );
  const zoneMismatch = zones.size > 1;
  const summaryWeek = summary?.attendanceComparison?.currentWeekStart;
  const trendWeek = trend?.points.find((p) => p.isCurrentWeek)?.weekStart;
  const weekMismatch = summaryWeek !== undefined && trendWeek !== undefined && summaryWeek !== trendWeek;

  useEffect(() => {
    if (retried.current || (!zoneMismatch && !weekMismatch)) return;
    retried.current = true;
    if (zoneMismatch) {
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.summaryAll() });
    void queryClient.invalidateQueries({ queryKey: dashboardKeys.trendAll() });
  }, [zoneMismatch, weekMismatch, queryClient]);
}
