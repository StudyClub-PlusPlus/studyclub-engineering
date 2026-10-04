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
    id: 'study-detail--applicants',
    label: '스터디 상세 — 신청자 탭 (study_id:1 ai-paper-study)',
    pageId: 'study-detail',
    rationale: '신청자 탭이 기본으로 열리고 크루 목록이 렌더되는지 확인한다. BO_DEV_BYPASS_AUTH=1 필요.',
    recipe: {
      render: { url: '/studies/1' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'study-detail--attendance',
    label: '스터디 상세 — 출석 탭 (study_id:1 ai-paper-study)',
    pageId: 'study-detail',
    rationale: '출석 탭으로 전환 후 출석부 테이블이 렌더되는지 확인한다. BO_DEV_BYPASS_AUTH=1 필요.',
    recipe: {
      render: { url: '/studies/1' },
      steps: [
        { action: 'click', selector: 'button:has-text("출석")' },
        { action: 'wait', ms: 300 },
      ],
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'study-detail--info',
    label: '스터디 상세 — 정보 탭 (study_id:1 ai-paper-study)',
    pageId: 'study-detail',
    rationale: '정보 탭으로 전환 후 스터디 메타 정보가 렌더되는지 확인한다. BO_DEV_BYPASS_AUTH=1 필요.',
    recipe: {
      render: { url: '/studies/1' },
      steps: [
        { action: 'click', selector: 'button:has-text("정보")' },
        { action: 'wait', ms: 300 },
      ],
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
    },
    screenshot: { fullPage: true },
  },
];
