import type { ScreenStateDef } from '../../types';

/** 일정 탭 시드 — 반 일정은 아직 서버 API 가 없어 브라우저 저장소(`bo_schedule:{studyId}`)에 산다 (features/schedule/store.ts).
 *  날짜는 지난 날로 고정한다 — 「오늘」 기준이면 스크린샷이 날마다 달라진다. 지난 회차라 모두 흐린 줄(고칠 수 없음)이다. */
const SCHEDULE_SEED = {
  groups: [{ id: 'g1', title: '기본반', time: { weekdays: [3], time: '20:00', tz: 'Asia/Seoul' } }],
  meetings: {
    g1: [
      { id: 'k', kind: 'kickoff', scheduledAt: '2026-09-02T11:00:00.000Z', title: '킥오프' },
      { id: 'm1', scheduledAt: '2026-09-09T11:00:00.000Z', title: '오리엔테이션' },
      { id: 'm2', scheduledAt: '2026-09-16T11:00:00.000Z', title: '1장 신뢰성' },
      { id: 'm3', scheduledAt: '2026-09-23T11:00:00.000Z' },
    ],
  },
  rules: {},
};

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
  {
    id: 'study-detail--schedule-empty',
    label: '스터디 상세 — 일정 탭, 스터디 시간 없는 반',
    pageId: 'study-detail',
    rationale: '막 만든 반은 표 대신 「스터디 시간 정하기」 안내가 보이는지 확인한다. BO_DEV_BYPASS_AUTH=1 필요.',
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
    id: 'study-detail--schedule',
    label: '스터디 상세 — 일정 탭, 킥오프 · 회차 있는 반',
    pageId: 'study-detail',
    rationale:
      '정보 카드 · 일정 표가 렌더되고, 킥오프가 0회차로 맨 위에 서며 제목 줄 버튼이 「킥오프 수정」인지 확인한다. BO_DEV_BYPASS_AUTH=1 필요.',
    recipe: {
      storage: [{ key: 'bo_schedule:1', value: SCHEDULE_SEED }],
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
