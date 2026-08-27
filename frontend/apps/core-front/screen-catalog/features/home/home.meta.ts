import type { ScreenStateDef } from '../../types';

export const homeScreenStates: ScreenStateDef[] = [
  {
    id: 'home--default',
    label: '홈 — 기본 (비로그인, 데스크톱)',
    pageId: 'home',
    rationale: '랜딩 최초 진입 상태. 스터디 카드·이벤트·통계가 올바르게 렌더되는지 확인한다.',
    recipe: {
      render: { url: '/ko' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'home--mobile',
    label: '홈 — 모바일',
    pageId: 'home',
    rationale: '모바일 뷰포트에서 레이아웃 깨짐이 없는지 확인한다.',
    recipe: {
      render: { url: '/ko' },
    },
    viewports: ['mobile'],
    assertions: {
      visible: ['main'],
    },
    screenshot: { fullPage: true },
  },
];
