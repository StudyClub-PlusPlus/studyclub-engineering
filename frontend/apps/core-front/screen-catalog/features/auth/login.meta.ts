import type { ScreenStateDef } from '../../types';

export const authScreenStates: ScreenStateDef[] = [
  {
    id: 'login--default',
    label: '로그인 페이지 — 기본',
    pageId: 'login',
    rationale: '로그인 진입점. Google OAuth 버튼이 올바르게 렌더되는지 확인한다.',
    recipe: {
      render: { url: '/ko/login' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['main'],
    },
  },
  {
    id: 'my--with-bookmarks',
    label: '마이페이지 — 북마크 있음',
    pageId: 'my',
    rationale: '로컬스토리지에 북마크가 있을 때 마이페이지 목록이 올바르게 렌더되는지 확인한다.',
    recipe: {
      storage: [
        { key: 'sc_bookmarks', value: ['ai-paper-study', 'daily-leetcode'] },
        { key: 'sc_display_name', value: '테스트 유저' },
        { key: 'sc_region', value: 'KR' },
      ],
      render: { url: '/ko/my' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'my--empty',
    label: '마이페이지 — 빈 상태',
    pageId: 'my',
    rationale: '북마크·신청 이력이 없을 때 빈 상태 UI가 올바르게 표시되는지 확인한다.',
    recipe: {
      render: { url: '/ko/my' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
    },
  },
];
