import type { ScreenStateDef } from '../../types';

const MEMBER = {
  id: 1,
  email: 'crew@test.com',
  nickname: '테스트크루',
  picture: null,
  role: 'MEMBER',
  timeZone: 'Asia/Seoul',
  onboardingCompletedAt: '2026-08-01T00:00:00Z',
};

export const authScreenStates: ScreenStateDef[] = [
  {
    id: 'login--default',
    label: '로그인 페이지 — 기본',
    pageId: 'login',
    rationale: '로그인 진입점. Google OAuth 버튼이 올바르게 렌더되는지 확인한다.',
    recipe: {
      render: { url: '/ko/login' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['main'],
    },
  },
  {
    id: 'my--default',
    label: '마이페이지 — 내 정보',
    pageId: 'my',
    rationale:
      '마이페이지는 내 정보만 다룬다(스터디 목록 없음). 사진 · 닉네임 · 이메일 · 시간대 · 디스코드 · 마케팅 수신 줄과 카드 밖 회원 탈퇴가 보이는지 확인한다.',
    recipe: {
      storage: [{ key: 'sc_user', value: MEMBER }],
      render: { url: '/ko/my' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: {
      visible: ['h1:has-text("마이페이지")', 'button[aria-label="내 정보 수정"]', 'a:has-text("회원 탈퇴")'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-saved--with-bookmarks',
    label: '찜한 스터디 — 찜 있음',
    pageId: 'my-saved',
    rationale: '하트로 담은 스터디가 실제 목록 API 의 스터디와 맞춰져 카드로 보이는지 확인한다.',
    recipe: {
      storage: [
        { key: 'sc_user', value: MEMBER },
        { key: 'sc_bookmarks', value: ['1', '2'] },
      ],
      render: { url: '/ko/my/saved' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['h1:has-text("찜한 스터디")', 'button[aria-label="찜한 스터디에서 빼기"]'],
    },
    screenshot: { fullPage: true },
  },
  {
    id: 'my-saved--empty',
    label: '찜한 스터디 — 빈 상태',
    pageId: 'my-saved',
    rationale: '찜이 없을 때 빈 상태 안내가 보이는지 확인한다.',
    recipe: {
      storage: [{ key: 'sc_user', value: MEMBER }],
      render: { url: '/ko/my/saved' },
    },
    viewports: ['desktop'],
    assertions: {
      visible: ['h1:has-text("찜한 스터디")', 'text=찜한 스터디가 없습니다'],
    },
  },
];
