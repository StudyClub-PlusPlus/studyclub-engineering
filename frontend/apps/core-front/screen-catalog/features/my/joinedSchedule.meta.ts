import type { ScreenStateDef } from '../../types';

const CREW_STORAGE = [
  {
    key: 'sc_user',
    value: {
      id: 1,
      email: 'crew@test.com',
      nickname: '테스트크루',
      picture: null,
      role: 'MEMBER',
      onboardingCompletedAt: '2026-08-01T00:00:00Z',
    },
  },
];

export const joinedScheduleScreenStates: ScreenStateDef[] = [
  // ─── 일정 탭 (Schedule) ───────────────────────────────────────────────────
  {
    id: 'my-joined-schedule--crew',
    label: '내 스터디 일정 — 크루 (조회 & 발표 신청)',
    pageId: 'my-joined-schedule',
    rationale:
      '일반 크루 권한으로 접속했을 때 회차 추가 버튼이 없고, 발표자 신청 칩과 읽기 전용 표가 렌더링되는지 확인한다.',
    recipe: {
      storage: CREW_STORAGE,
      render: { url: '/ko/my/joined/3/schedule' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['h1', 'table'],
      hidden: ['button:has-text("회차 추가")'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-joined-schedule--navigator',
    label: '내 스터디 일정 — 네비게이터 (회차 관리 & 회차 추가)',
    pageId: 'my-joined-schedule',
    rationale:
      '네비게이터 권한으로 접속했을 때 스터디 정보 카드, 규칙 에디터, 회차 추가 버튼, 일정 수정 표가 올바르게 렌더링되는지 확인한다.',
    recipe: {
      storage: CREW_STORAGE,
      render: { url: '/ko/my/joined/11/schedule' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['h1', 'button:has-text("회차 추가")', 'table'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-joined-schedule--captain',
    label: '내 스터디 일정 — 캡틴 (회차 관리 & 일정 수정)',
    pageId: 'my-joined-schedule',
    rationale:
      '캡틴 권한으로 접속했을 때 회차 추가 버튼 및 일정 편집 표가 렌더링되는지 확인한다.',
    recipe: {
      storage: CREW_STORAGE,
      render: { url: '/ko/my/joined/1/schedule' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['h1', 'button:has-text("회차 추가")', 'table'],
    },
    screenshot: { fullPage: true },
  },

  // ─── 출석 탭 (Attendance) ─────────────────────────────────────────────────
  {
    id: 'my-joined-attendance--crew',
    label: '내 스터디 출석 — 크루 (읽기 전용 출석 격자)',
    pageId: 'my-joined-attendance',
    rationale:
      '일반 크루 권한으로 출석 탭 접속 시 백오피스 출석 링크와 하단 작업 바가 노출되지 않고 읽기 전용 표가 렌더링되는지 확인한다.',
    recipe: {
      storage: CREW_STORAGE,
      render: { url: '/ko/my/joined/3/schedule/attendance' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['h2:has-text("출석")'],
      hidden: ['button:has-text("백오피스 출석 (전체 참여자)")', 'button:has-text("출석 적용")'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-joined-attendance--navigator',
    label: '내 스터디 출석 — 네비게이터 (출석 격자 & 일괄 적용)',
    pageId: 'my-joined-attendance',
    rationale:
      '네비게이터 권한으로 출석 탭에 접속했을 때 출석 격자 및 일괄 출석 적용 바가 렌더링되고, 백오피스 링크는 없는지 확인한다.',
    recipe: {
      storage: CREW_STORAGE,
      render: { url: '/ko/my/joined/11/schedule/attendance' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['[role="region"]', 'button:has-text("출석 적용")'],
      hidden: ['button:has-text("백오피스 출석 (전체 참여자)")'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-joined-attendance--captain',
    label: '내 스터디 출석 — 캡틴 (출석 격자 & 백오피스 출석 링크)',
    pageId: 'my-joined-attendance',
    rationale:
      '캡틴 권한으로 출석 탭에 접속했을 때 백오피스 출석 이동 버튼, 전체 출석 격자, 일괄 출석 적용 바가 렌더링되는지 확인한다.',
    recipe: {
      storage: CREW_STORAGE,
      render: { url: '/ko/my/joined/1/schedule/attendance' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['button:has-text("백오피스 출석 (전체 참여자)")', '[role="region"]', 'button:has-text("출석 적용")'],
    },
    screenshot: { fullPage: true },
  },
];
