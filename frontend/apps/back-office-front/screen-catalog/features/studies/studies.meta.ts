import type { ScreenStateDef } from '../../types';

/** 서버 반 ID에 스터디 시간만 시드한다. 회차는 E2E의 stubSchedule.ts가 제공한다. */
const SCHEDULE_SEED = { '1': { weekdays: [3], time: '20:00' } };

export const studyScreenStates: ScreenStateDef[] = [
  {
    // PRD 부분 연결: BO-ST-022-S01 BO-ST-022-V01. 전체 기준은 features/prd/와 대응표 참고.
    id: 'study-list--default',
    label: '스터디 목록 — 관리자',
    pageId: 'study-list',
    rationale: '스터디 목록 페이지가 올바르게 렌더되는지 확인한다. 테스트 인증 쿠키 필요.',
    recipe: {
      render: { url: '/studies' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['main', 'h1'],
    },
    screenshot: { fullPage: true },
  },
  {
    // PRD 부분 연결: BO-ST-025-S01 BO-ST-025-V02 BO-ST-026-S01 BO-ST-026-V01. 전체 기준은 features/prd/와 대응표 참고.
    id: 'study-detail--applicants',
    label: '스터디 상세 — 신청자 탭 (study_id:1 ai-paper-study)',
    pageId: 'study-detail',
    rationale: '신청자 탭으로 전환하면 크루 목록이 렌더되는지 확인한다. 테스트 인증 쿠키 필요.',
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
    // PRD 부분 연결: BO-ST-023-S01 BO-ST-023-V06. 전체 기준은 features/prd/와 대응표 참고.
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
    // PRD 부분 연결: BO-ST-027-S01 BO-ST-027-V01. 전체 기준은 features/prd/와 대응표 참고.
    id: 'study-detail--attendance',
    label: '스터디 상세 — 출석 탭 (study_id:1 ai-paper-study)',
    pageId: 'study-detail',
    rationale: '출석 탭으로 전환 후 출석부 테이블이 렌더되는지 확인한다. 테스트 인증 쿠키 필요.',
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
    // PRD 부분 연결: BO-ST-004-S01 BO-ST-004-V01 BO-ST-003-S01. 전체 기준은 features/prd/와 대응표 참고.
    id: 'study-detail--info',
    label: '스터디 상세 — 정보 탭 (study_id:1 ai-paper-study)',
    pageId: 'study-detail',
    rationale: '정보 탭으로 전환 후 스터디 메타 정보가 렌더되는지 확인한다. 테스트 인증 쿠키 필요.',
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
  {
    // PRD 부분 연결: BO-ST-025-S03 BO-ST-025-V03. 전체 기준은 features/prd/와 대응표 참고.
    id: 'study-detail--schedule-empty',
    label: '스터디 상세 — 일정 탭, 스터디 시간 없는 반',
    pageId: 'study-detail',
    rationale: '막 만든 반은 표 대신 「스터디 시간 정하기」 안내가 보이는지 확인한다. 테스트 인증 쿠키 필요.',
    recipe: {
      render: { url: '/studies/1?tab=schedule' },
    },
    viewports: ['desktop'],
    assertions: {
      text: { main: '아직 이 반의 스터디 시간이 없습니다.' },
    },
    screenshot: { fullPage: true },
  },
  {
    // PRD 부분 연결: BO-ST-025-S04 BO-ST-025-S05. 전체 기준은 features/prd/와 대응표 참고.
    id: 'study-detail--schedule',
    label: '스터디 상세 — 일정 탭, 킥오프 · 회차 있는 반',
    pageId: 'study-detail',
    rationale:
      '정보 카드 · 일정 표가 렌더되고, 킥오프가 0회차로 맨 위에 서며 제목 줄 버튼이 「킥오프 수정」인지 확인한다. 테스트 인증 쿠키 필요.',
    recipe: {
      storage: [{ key: 'bo_schedule_time:1', value: SCHEDULE_SEED }],
      render: { url: '/studies/1?tab=schedule' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['table', 'button:has-text("킥오프 수정")'],
      text: { main: '전체 3 · 예정 0' },
    },
    screenshot: { fullPage: true },
  },
];
