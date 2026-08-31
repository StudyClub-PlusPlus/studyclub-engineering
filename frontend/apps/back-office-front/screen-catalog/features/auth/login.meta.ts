import type { ScreenStateDef } from '../../types';

export const authScreenStates: ScreenStateDef[] = [
  {
    id: 'login--default',
    label: '로그인 페이지 — 기본',
    pageId: 'login',
    rationale: '백오피스 로그인 진입점. 로그인 폼이 올바르게 렌더되는지 확인한다.',
    recipe: {
      render: { url: '/login' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
    },
  },
];
