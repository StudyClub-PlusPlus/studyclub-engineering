import type { ScreenStateDef } from '../../types';

export const studyScreenStates: ScreenStateDef[] = [
  {
    id: 'study-list--default',
    label: '스터디 목록 — 관리자',
    pageId: 'study-list',
    rationale: '스터디 목록 페이지가 올바르게 렌더되는지 확인한다. BO_DEV_BYPASS_AUTH=1 필요.',
    recipe: {
      render: { url: '/studies' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'study-detail--crew',
    label: '스터디 상세 — 크루 관리 (ai-paper-study)',
    pageId: 'study-detail',
    rationale: '크루 목록·출석부 UI가 올바르게 렌더되는지 확인한다. BO_DEV_BYPASS_AUTH=1 필요.',
    recipe: {
      render: { url: '/studies/ai-paper-study' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
    },
    screenshot: { fullPage: true },
  },
];
