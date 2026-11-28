import type { ScreenStateDef, ScreenStep } from '../../types';

/**
 * ST-039 · ST-040 스터디 일정 「회고」 탭 · 회고 작성. 개발 MSW 회고 목(packages/mock 의 retros.ts)과 고정 시각으로 찍는다.
 * 목은 나(participantId 1)만 가장 최근에 끝난 회차를 안 썼다. 캡틴 스터디 1 은 내가 반 명부에 있어 쓸 사람이고,
 * 캡틴 스터디 20 은 명부에 없어 쓸 사람이 아니다(목의 OFF_ROSTER_CAPTAIN_STUDY_IDS).
 * 작성 페이지는 회차 번호가 목에서 정해져 회고 탭의 「회고 작성」을 눌러 들어간다.
 */
const CREW_STORAGE = [
  {
    key: 'sc_user',
    value: {
      id: 1,
      email: 'crew@test.com',
      nickname: '테스트크루',
      picture: null,
      role: 'MEMBER',
      timeZone: 'Asia/Seoul',
      onboardingCompletedAt: '2026-08-01T00:00:00Z',
    },
  },
];
/** 내가 반 명부에 없는 캡틴 스터디 — packages/mock 의 OFF_ROSTER_CAPTAIN_STUDY_IDS */
const OFF_ROSTER_CAPTAIN_STUDY = 20;
const retroUrl = (studyId: number) => `/ko/my/joined/${studyId}/schedule/retro`;
const openWrite: ScreenStep = { action: 'click', selector: 'a:has-text("회고 작성")' };

export const joinedRetroScreenStates: ScreenStateDef[] = [
  {
    id: 'my-joined-retro--crew',
    prdScenarios: ['CORE-ST-039-V01', 'CORE-ST-039-S01', 'CORE-ST-039-S07', 'CORE-ST-039-S08', 'CORE-ST-039-S13'],
    label: '내 스터디 회고 — 크루 (아직 안 쓴 최근 회차)',
    pageId: 'my-joined-retro',
    rationale:
      '크루로 회고 탭을 열면 끝난 회차 칩 · 마감 시각 · 「회고 작성」 · 작성 권유 문구 · 문항별 👍 많은 순이 보이고, 작성 현황(「n명 중 m명 작성」)은 없다.',
    recipe: { storage: CREW_STORAGE, render: { url: retroUrl(18) } },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['[role="radiogroup"][aria-label="회차"]', 'a:has-text("회고 작성")'],
      hidden: ['[aria-label="작성 현황"]'],
      text: { main: '아직 회고를 작성하지 않았어요!' },
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-joined-retro--navigator',
    prdScenarios: ['CORE-ST-040-V01', 'CORE-ST-040-S01', 'CORE-ST-040-S02', 'CORE-ST-040-S03'],
    label: '내 스터디 회고 — 네비게이터 (작성 현황)',
    pageId: 'my-joined-retro',
    rationale: '네비게이터로 회고 탭을 열면 「n명 중 m명 작성」과 작성 현황(작성 · 미작성)이 보이고, 본인 회고도 쓸 수 있다.',
    recipe: { storage: CREW_STORAGE, render: { url: retroUrl(11) } },
    viewports: ['desktop', 'mobile'],
    assertions: { visible: ['[aria-label="작성 현황"]', 'a:has-text("회고 작성")'], text: { main: '명 작성' } },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-joined-retro--captain',
    prdScenarios: ['CORE-ST-040-S04'],
    label: '내 스터디 회고 — 명부에 있는 캡틴 (작성 현황 · 회고 작성)',
    pageId: 'my-joined-retro',
    rationale: '반 명부에 있는 담당 캡틴은 참여자처럼 회고를 쓴다 — 작성 현황 · 「n명 중 m명 작성」과 「회고 작성」이 함께 보인다.',
    recipe: { storage: CREW_STORAGE, render: { url: retroUrl(1) } },
    viewports: ['desktop'],
    assertions: { visible: ['[aria-label="작성 현황"]', 'a:has-text("회고 작성")'], text: { main: '명 작성' } },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-joined-retro--captain-off-roster',
    prdScenarios: ['CORE-ST-040-S04'],
    label: '내 스터디 회고 — 명부에 없는 캡틴 (작성 버튼 없음)',
    pageId: 'my-joined-retro',
    rationale: '반 명부에 없는 담당 캡틴은 회고를 쓰지 않는다 — 작성 현황은 보이고 작성 버튼 · 작성 권유 문구는 없다.',
    recipe: { storage: CREW_STORAGE, render: { url: retroUrl(OFF_ROSTER_CAPTAIN_STUDY) } },
    viewports: ['desktop'],
    assertions: {
      visible: ['[aria-label="작성 현황"]'],
      hidden: ['a:has-text("회고 작성")', 'a:has-text("내 회고 수정")', 'button:has-text("회고 마감")'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-joined-retro-write--crew',
    prdScenarios: ['CORE-ST-039-S03'],
    label: '회고 작성 — 크루',
    pageId: 'my-joined-retro-write',
    rationale: '회고 탭의 「회고 작성」으로 들어가면 회차 · 기한 · 미팅 종료 카드와 세 문항(500자 · 글자 수)이 탭 폭으로 보인다.',
    recipe: { storage: CREW_STORAGE, render: { url: retroUrl(18) }, steps: [openWrite] },
    viewports: ['desktop', 'mobile'],
    assertions: { visible: ['textarea', 'button:has-text("회고 제출")'], text: { main: '회고 작성' } },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-joined-retro-write--invalid',
    prdScenarios: ['CORE-ST-039-V04', 'CORE-ST-039-S04'],
    label: '회고 작성 — 필수 칸 누락',
    pageId: 'my-joined-retro-write',
    rationale: '아무것도 적지 않고 제출하면 좋았던 점 · 개선할 점 칸 아래에 오류가 뜨고 제출되지 않는다.',
    recipe: {
      storage: CREW_STORAGE,
      render: { url: retroUrl(18) },
      steps: [openWrite, { action: 'click', selector: 'button:has-text("회고 제출")' }],
    },
    viewports: ['desktop'],
    assertions: { text: { main: '좋았던 점을 적어 주세요.' } },
    screenshot: { fullPage: true },
  },
];
