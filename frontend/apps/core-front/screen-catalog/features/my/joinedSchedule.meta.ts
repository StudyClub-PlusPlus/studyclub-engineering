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
    prdScenarios: ['CORE-ST-015-V02', 'CORE-ST-011-V01', 'CORE-ST-011-S01'],
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
    prdScenarios: ['CORE-ST-015-V01', 'CORE-ST-015-S03'],
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
    prdScenarios: ['CORE-ST-015-V01'],
    label: '내 스터디 일정 — 캡틴 (회차 관리 & 일정 수정)',
    pageId: 'my-joined-schedule',
    rationale: '캡틴 권한으로 접속했을 때 회차 추가 버튼 및 일정 편집 표가 렌더링되는지 확인한다.',
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
    prdScenarios: [
      'CORE-ST-010-V01',
      'CORE-ST-010-S01',
      'CORE-ST-010-S02',
      'CORE-ST-010-S05',
      'CORE-ST-017-V07',
      'CORE-ST-018-V10',
      'CORE-ST-018-S10',
    ],
    label: '내 스터디 출석 — 크루 (읽기 전용 출석 격자)',
    pageId: 'my-joined-attendance',
    rationale:
      '일반 크루 권한으로 출석 탭 접속 시 백오피스 출석부 버튼과 작업 바가 노출되지 않고 읽기 전용 표(닉네임 · 디스코드 닉네임 열)가 렌더링되는지 확인한다.',
    recipe: {
      storage: CREW_STORAGE,
      render: { url: '/ko/my/joined/3/schedule/attendance' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['h2:has-text("출석")', 'button[aria-label="발표 표시 설명"]'],
      hidden: ['button:has-text("백오피스 출석부")', 'select[aria-label="바꿀 출석 상태"]'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-joined-attendance--navigator',
    prdScenarios: ['CORE-ST-017-V01', 'CORE-ST-017-S01', 'CORE-ST-018-V01', 'CORE-ST-018-V02'],
    label: '내 스터디 출석 — 네비게이터 (출석 격자 & 일괄 변경)',
    pageId: 'my-joined-attendance',
    rationale:
      '네비게이터 권한으로 출석 탭에 접속했을 때 출석 격자와 표 맨 위 작업 바(「적용」 버튼 없는 일괄 변경)가 렌더링되고, 백오피스 출석부 버튼은 없는지 확인한다.',
    recipe: {
      storage: CREW_STORAGE,
      render: { url: '/ko/my/joined/11/schedule/attendance' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['[role="region"]', 'select[aria-label="바꿀 출석 상태"]'],
      hidden: ['button:has-text("백오피스 출석부")', 'button:has-text("출석 적용")'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-joined-attendance--captain',
    prdScenarios: ['CORE-ST-017-V01', 'CORE-ST-017-S07'],
    label: '내 스터디 출석 — 캡틴 (출석 격자 & 백오피스 출석부)',
    pageId: 'my-joined-attendance',
    rationale:
      '캡틴 권한으로 출석 탭에 접속했을 때 정보 카드 바로가기 줄 맨 앞의 백오피스 출석부 버튼, 출석 격자, 표 맨 위 작업 바가 렌더링되는지 확인한다.',
    recipe: {
      storage: CREW_STORAGE,
      render: { url: '/ko/my/joined/1/schedule/attendance' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['button:has-text("백오피스 출석부")', '[role="region"]', 'select[aria-label="바꿀 출석 상태"]'],
      hidden: ['button:has-text("출석 적용")'],
    },
    screenshot: { fullPage: true },
  },

  // ─── 공지 탭 (Notice) ─────────────────────────────────────────────────────
  {
    id: 'my-joined-notice--captain',
    prdScenarios: ['CORE-ST-016-S01', 'CORE-ST-016-S02', 'CORE-ST-016-S04', 'CORE-ST-016-S07'],
    label: '내 스터디 공지 — 캡틴 (공지 쓰기 & 보낸 공지)',
    pageId: 'my-joined-notice',
    rationale:
      '캡틴이 공지 탭에 들어왔을 때 받는 사람 고르기 · 공지 쓰기 · 보낸 공지 기록이 일정 · 출석 탭과 같은 너비로 렌더링되는지 확인한다.',
    recipe: {
      storage: CREW_STORAGE,
      render: { url: '/ko/my/joined/1/schedule/notice' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['h1'],
    },
    screenshot: { fullPage: true },
  },
];
