import type { Page } from '@playwright/test';

import type { ApiGroupMeetings } from '../../src/features/schedule/repository';

/** 관리자 회차 API는 브라우저 MSW에 없어 카탈로그에서 고정 응답을 제공한다. */
export async function stubSchedule(page: Page, stateId: string) {
  const empty = stateId === 'study-detail--schedule-empty';
  const meetings: ApiGroupMeetings['meetings'] = empty ? [] : [
    { id: 1, type: 'KICKOFF', number: 0, scheduledAt: '2026-09-02T11:00:00Z', title: '킥오프', presenter1: null, presenter2: null, started: true },
    ...['오리엔테이션', '1장 신뢰성', null].map((title, i) => ({
      id: i + 2, type: 'REGULAR' as const, number: i + 1,
      scheduledAt: `2026-09-${String(9 + i * 7).padStart(2, '0')}T11:00:00Z`,
      title, presenter1: null, presenter2: null, started: true,
    })),
  ];
  await page.context().route(/\/api\/admin\/studies\/1\/groups\/\d+\/meetings(?:\?|$)/, (route) => {
    const groupId = Number(new URL(route.request().url()).pathname.split('/')[6]);
    const response: ApiGroupMeetings = {
      studyGroup: { id: groupId, name: '기본반', timezone: 'Asia/Seoul', startTime: null, navigatorName: null, rules: null },
      me: { participantId: null, canEdit: true }, participants: [], meetings,
    };
    return route.fulfill({ json: response });
  });
  await page.context().route(/\/api\/admin\/studies\/1\/attendances(?:\?|$)/, (route) => route.fulfill({ json: {
    study: { id: 1, title: 'AI 논문 스터디', participantCount: 2, totalMeetings: 3, avgAttendanceRate: 0.75 },
    meetings: meetings.filter((m) => m.type === 'REGULAR').map(({ id, scheduledAt }) => ({ id, scheduledAt })),
    participants: ['테스트크루', '테스트네비'].map((displayName, i) => ({
      participantId: i + 1, displayName, participantRole: i === 0 ? 'MEMBER' : 'LEADER',
      captain: false, participantStatus: 'ACTIVE', leftAt: null, attendanceRate: i === 0 ? 0.5 : 1,
      attendances: meetings.filter((m) => m.type === 'REGULAR').map((m, j) => ({
        meetingId: m.id, status: i === 0 ? ['PRESENT', 'LATE', 'ABSENT'][j] : 'PRESENT',
      })),
    })),
  } }));
}
