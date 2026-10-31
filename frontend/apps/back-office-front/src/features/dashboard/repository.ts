import {
  apiAttendanceTrendSchema,
  apiCrewTimezonesSchema,
  apiDashboardSummarySchema,
  apiStudiesByCategorySchema,
  apiStudyBoardSchema,
} from '@/features/dashboard/response-schema';
import type { StudyBoardView } from '@/features/dashboard/types';
import { http, qs } from '@/lib/http';

export const BOARD_PREVIEW = 4;

export const TREND_WEEKS = 12;

export function dashboardSummary(timeZone: string | undefined) {
  return http(`/api/admin/stats/summary${qs({ timeZone })}`, apiDashboardSummarySchema);
}

export function studyBoard(view: StudyBoardView, timeZone: string | undefined) {
  return http(`/api/admin/stats/study-board${qs({ view, limit: BOARD_PREVIEW, timeZone })}`, apiStudyBoardSchema);
}

export function crewTimezones() {
  return http('/api/admin/stats/crew-timezones', apiCrewTimezonesSchema);
}

export function attendanceTrend(timeZone: string | undefined) {
  return http(`/api/admin/stats/attendance-trend${qs({ weeks: TREND_WEEKS, timeZone })}`, apiAttendanceTrendSchema);
}

export function studiesByCategory() {
  return http('/api/admin/stats/studies-by-category', apiStudiesByCategorySchema);
}
