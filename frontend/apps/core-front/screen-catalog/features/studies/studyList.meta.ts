import type { ScreenStateDef } from '../../types';

export const studyScreenStates: ScreenStateDef[] = [
  {
    id: 'study-list--default',
    label: '스터디 목록 — 기본',
    pageId: 'study-list',
    rationale: '스터디 카드 그리드가 올바르게 렌더되는지 확인한다.',
    recipe: {
      render: { url: '/ko/studies' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['main'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'study-detail--recruiting',
    label: '스터디 상세 — 모집 중 (ai-paper-study)',
    pageId: 'study-detail',
    rationale: '모집 중인 스터디의 상세 정보와 신청 UI가 올바른지 확인한다.',
    recipe: {
      render: { url: '/ko/studies/ai-paper-study' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'study-detail--ongoing',
    label: '스터디 상세 — 진행 중 (system-design-interview-ongoing)',
    pageId: 'study-detail',
    rationale: '진행 중인 스터디 상세에서 모집 마감 상태가 올바르게 표시되는지 확인한다.',
    recipe: {
      render: { url: '/ko/studies/system-design-interview-ongoing' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
    },
    screenshot: { fullPage: true },
  },
];
