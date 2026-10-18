import { HttpResponse } from 'msw';

import { mockClient } from '../utils';

/**
 * 디스코드 연동 여부 — GET /auth/me 의 `discordLinked` (DSC-02) · POST /api/me/discord/link (DSC-01).
 * 백엔드가 아직 없어 목이 대신 답한다. 연동하면 이 브라우저에 기억해 새로고침해도 연동된 채로 둔다.
 * 처음 상태를 바꾸려면 MSW 데브툴에서 프리셋을 고르거나 이 키를 지운다.
 */
export const MOCK_DISCORD_LINKED_KEY = 'msw-discord-linked';

function readLinked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MOCK_DISCORD_LINKED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeLinked(linked: boolean) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MOCK_DISCORD_LINKED_KEY, String(linked));
  } catch {
    // 저장 실패해도 응답은 낸다
  }
}

/** 로그인 세션(sc_user)을 그대로 돌려준다 — 마이페이지가 같은 응답으로 세션을 갱신하므로 남의 값이 끼면 안 된다. */
function sessionAccount() {
  const fallback = {
    id: 1,
    email: 'crew@example.com',
    nickname: '테스트',
    picture: null,
    role: 'MEMBER',
    timeZone: 'Asia/Seoul',
    onboardingCompletedAt: '2026-01-01T00:00:00Z',
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem('sc_user');
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function me(discordLinked: boolean) {
  return { ...sessionAccount(), createdAt: '2026-01-01T00:00:00Z', discordNickname: null, discordLinked };
}

export const authMeHandlers = mockClient.createHandlerGroup('/auth', [
  {
    method: 'GET',
    path: '/me',
    presets: [
      { label: '정상 (연동 상태 기억)', status: 200, response: () => me(readLinked()) },
      { label: '디스코드 연동됨', status: 200, response: () => me(true) },
      { label: '디스코드 미연동', status: 200, response: () => me(false) },
      {
        label: '로그인 만료 (401)',
        status: 401,
        response: { errorCode: 'UNAUTHORIZED', errorMessage: '로그인이 필요합니다.' },
      },
    ],
  },
]);

export const discordLinkHandlers = mockClient.createHandlerGroup('/api/me/discord', [
  {
    method: 'POST',
    path: '/link',
    presets: [
      {
        label: '연동 성공',
        status: 204,
        response: () => {
          writeLinked(true);
          return new HttpResponse(null, { status: 204 });
        },
      },
      {
        label: '다른 계정에 이미 연동 (409)',
        status: 409,
        response: { errorCode: 'CONFLICT', errorMessage: '이미 다른 계정에 연동된 디스코드 계정입니다.' },
      },
      {
        label: '디스코드 응답 실패 (502)',
        status: 502,
        response: { errorCode: 'BAD_GATEWAY', errorMessage: '디스코드 연동에 실패했습니다.' },
      },
    ],
  },
]);
