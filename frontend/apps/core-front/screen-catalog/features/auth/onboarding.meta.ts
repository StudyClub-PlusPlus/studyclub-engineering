import type { ScreenStateDef } from '../../types';

/** 로그인은 했지만 온보딩(닉네임 · 약관 동의)을 아직 안 마친 회원 — onboardingCompletedAt 이 없다 */
const NEW_MEMBER = {
  id: 1,
  email: 'crew@test.com',
  nickname: '테스트크루',
  picture: null,
  role: 'MEMBER',
  timeZone: 'Asia/Seoul',
  onboardingCompletedAt: null,
};

/** 온보딩을 마친 회원 — 디스코드 단계는 가입 완료 뒤에 온다 */
const MEMBER = { ...NEW_MEMBER, onboardingCompletedAt: '2026-08-01T00:00:00Z' };

export const onboardingScreenStates: ScreenStateDef[] = [
  {
    id: 'onboarding--default',
    prdScenarios: ['CORE-ST-005-V04', 'CORE-ST-005-S05', 'CORE-ST-005-S07', 'CORE-ST-005-S08'],
    label: '온보딩 — 닉네임 · 약관 동의',
    pageId: 'onboarding',
    rationale: '처음 로그인한 회원이 닉네임 · 시간대 · 약관 동의를 입력하는 가입 폼이 렌더되는지 확인한다.',
    recipe: {
      storage: [{ key: 'sc_user', value: NEW_MEMBER }],
      render: { url: '/ko/onboarding' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: { visible: ['h1:has-text("StudyClub에 오신 것을 환영해요")', 'form'] },
    screenshot: { fullPage: true },
  },
  {
    id: 'onboarding--discord',
    prdScenarios: ['CORE-ST-005-V09', 'CORE-ST-005-S11'],
    label: '온보딩 — 디스코드 연동 단계',
    pageId: 'onboarding',
    rationale: '가입을 마친 뒤 디스코드 연동을 권하는 단계가 연결 · 건너뛰기 버튼과 함께 보이는지 확인한다.',
    recipe: {
      storage: [
        { key: 'sc_user', value: MEMBER },
        { key: 'msw-discord-linked', value: false },
      ],
      render: { url: '/ko/onboarding?step=discord' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: { visible: ['button:has-text("지금 연결")', 'button:has-text("스터디 신청할 때 하기")'] },
    screenshot: { fullPage: true },
  },
];
