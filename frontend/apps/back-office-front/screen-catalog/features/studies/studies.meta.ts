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
    rationale: '신청자 탭으로 전환하면 크루 목록이 렌더되는지 확인한다. BO_DEV_BYPASS_AUTH=1 필요.',
    recipe: {
      render: { url: '/studies/1' },
      steps: [
        { action: 'click', selector: 'button:has-text("신청자")' },
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
    id: 'study-detail--application-form',
    label: '스터디 상세 — 신청 폼 탭',
    pageId: 'study-detail',
    rationale: '신청 폼의 기본 질문과 추가 질문이 데스크톱·모바일에서 올바르게 렌더되는지 확인한다.',
    recipe: {
      render: { url: '/studies/1?tab=form' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['form[aria-label="신청 폼 설계"]'],
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
