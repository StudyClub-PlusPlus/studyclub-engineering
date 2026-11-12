import type { ScreenStateDef } from '../../types';

const asOf = '2026-10-31T03:00:00Z';
const timeZone = 'Asia/Seoul';
export const prdDashboardStates: ScreenStateDef[] = [{
  id: 'dashboard--empty', label: '집계와 운영 대상 없는 대시보드', pageId: 'dashboard',
  prdScenarios: ['BO-ST-002-V01', 'BO-ST-002-V02', 'BO-ST-002-V03', 'BO-ST-002-V04'],
  rationale: '집계 0건, 전주 값·출석 기록 없음과 빈 보드를 고정 응답으로 재현한다.',
  recipe: { render: { url: '/' }, api: [
    { path: '/api/admin/stats/summary', json: { asOf, timeZone, activeCrew: 0, activeEnrollments: 0, studiesPerCrew: null,
      communityMembers: 0, attendanceRate: null, attendanceComparison: { currentWeekStart: '2026-10-26', previousWeekStart: '2026-10-19', currentRate: null, previousRate: null, deltaPercentagePoints: null }, errors: {} } },
    ...(['ONGOING', 'RECRUITMENT'] as const).map((view) => ({ path: '/api/admin/stats/study-board', query: { view }, json: { asOf, timeZone, view, total: 0, offset: 0, limit: 4, items: [] } })),
    { path: '/api/admin/stats/crew-timezones', json: { asOf, totalCrew: 0, timeZoneGroups: ['KST', 'ET', 'PT', 'UNKNOWN'].map((code) => ({ code, count: 0, percentage: null })) } },
    { path: '/api/admin/stats/attendance-trend', json: { asOf, timeZone, averageRate: null,
      points: Array.from({ length: 12 }, (_, i) => ({ weekStart: new Date(Date.UTC(2026, 7, 10 + i * 7)).toISOString().slice(0, 10), isCurrentWeek: i === 11, weightedAttended: 0, eligibleCount: 0, rate: null })) } },
    { path: '/api/admin/stats/studies-by-category', json: { asOf, categories: [] } },
  ] }, viewports: ['desktop', 'mobile'],
  assertions: { visible: ['text=모집중 스터디가 없습니다.', 'text=아직 출석 기록이 없습니다.', 'text=해당하는 스터디가 없습니다.'] },
  screenshot: { fullPage: true },
}];
