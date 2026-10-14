import type { ScreenStateDef } from '../../types';

export const joinedStudiesScreenStates: ScreenStateDef[] = [
  {
    id: 'my-joined--default',
    label: '내 스터디 — 기본 (참여중 탭 & 주간 일정)',
    pageId: 'my-joined',
    rationale:
      '로그인 회원이 내 스터디에 접근했을 때 기본 참여중 탭 목록과 상단 주간 일정이 올바르게 렌더링되는지 확인한다.',
    recipe: {
      storage: [
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
      ],
      render: { url: '/ko/my/joined' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['h1:has-text("내 스터디")', 'section', 'ul'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-joined--ended',
    label: '내 스터디 — 참여 종료 탭 (완주 카드 & 종료 카드)',
    pageId: 'my-joined',
    rationale:
      '참여 종료 탭 선택 시 완주 카드(완주 점수판, 앰버 스타일)와 참여 중단 카드가 올바르게 구분되어 렌더링되는지 확인한다.',
    recipe: {
      storage: [
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
      ],
      render: { url: '/ko/my/joined' },
      steps: [
        { action: 'click', selector: 'button:has-text("참여 종료")' },
        { action: 'wait', ms: 500 },
      ],
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['h1:has-text("내 스터디")', 'button:has-text("참여 종료")'],
    },
    screenshot: { fullPage: true },
  },
];
