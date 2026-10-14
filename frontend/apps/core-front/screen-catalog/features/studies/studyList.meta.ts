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
    label: '스터디 상세 — 모집 중 (study_id=1, ai-paper-study, status=OPEN, recruitStatus=RECRUITING)',
    pageId: 'study-detail',
    // spec: study/spec — status=OPEN + study-recruit-status — recruitStatus=RECRUITING → 신청하기 버튼 표시
    rationale: '모집 중인 스터디의 상세 정보와 신청 UI가 올바른지 확인한다.',
    recipe: {
      render: { url: '/ko/studies/1' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'study-detail--ongoing',
    label: '스터디 상세 — 진행 중 (study_id=19, system-design-interview-ongoing, status=ONGOING, recruitStatus=null)',
    pageId: 'study-detail',
    // spec: study-recruit-status — status != OPEN 이면 recruitStatus=null → 신청 불가 상태 표시
    rationale: '진행 중인 스터디 상세에서 신청 마감 상태(신청하기 버튼 없음)가 올바르게 표시되는지 확인한다.',
    recipe: {
      render: { url: '/ko/studies/19' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'study-detail--not-found',
    label: '스터디 상세 — 존재하지 않는 ID (study_id=9999)',
    pageId: 'study-detail',
    rationale: 'StudyDetailView가 404 응답을 받았을 때 찾을 수 없음 안내를 올바르게 렌더하는지 확인한다.',
    recipe: {
      render: { url: '/ko/studies/9999' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main'],
      text: { 'main': '스터디를 찾을 수 없어요' },
    },
    screenshot: { fullPage: false },
  },
  {
    id: 'study-apply--modal',
    label: '스터디 신청 모달 — 기본 (study_id=6, past-project-review)',
    pageId: 'study-detail',
    rationale: '스터디 상세에서 신청하기 클릭 시 뜨는 신청 폼 모달과 질문 필드들이 올바르게 렌더링되는지 확인한다.',
    recipe: {
      storage: [
        {
          key: 'sc_user',
          value: {
            id: 1,
            email: 'test@test.com',
            nickname: '테스트',
            picture: null,
            role: 'MEMBER',
          },
        },
        {
          key: 'sc_discord',
          value: { linked: true, username: 'test#0001' },
        },
        {
          key: 'sc_discord_nickname',
          value: '테스트',
        },
      ],
      render: { url: '/ko/studies/6' },
      steps: [
        { action: 'click', selector: 'button:has-text("신청하기")' },
        { action: 'wait', ms: 500 },
      ],
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['[role="dialog"]', '[role="dialog"] h2:has-text("스터디 신청")'],
    },
    screenshot: { fullPage: false },
  },
];
