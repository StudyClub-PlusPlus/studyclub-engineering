import { bypass, HttpResponse } from 'msw';

import { mockClient, readSessionUser, type MockResolveContext } from '../utils';

/**
 * 디스코드 연동 여부 — GET /api/me 의 `discordLinked` (DSC-02) · POST /api/me/discord/link (DSC-01, #298).
 * 백엔드에 아직 없거나 로컬에서 부를 수 없는 것만 목이 대신 답한다 — 연동 API 는 진짜 디스코드 인가 코드가 있어야 해서 목이 받는다.
 * GET /api/me 는 이미 있으니 기본은 진짜 응답에 `discordLinked` 만 덧붙인다.
 * 연동하면 이 브라우저에 기억해 새로고침해도 연동된 채로 둔다.
 * 처음 상태를 바꾸려면 MSW 데브툴에서 프리셋을 고르거나 이 키를 지운다.
 */
export const MOCK_DISCORD_LINKED_KEY = 'msw-discord-linked';
const MOCK_DISCORD_HANDLE = 'jiwon_dev';

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

/** 백엔드를 안 띄웠을 때 쓰는 대체 응답. 로그인 세션(sc_user)을 그대로 돌려준다 — 마이페이지가 같은 응답으로 세션을 갱신하므로 남의 값이 끼면 안 된다. */
function sessionAccount() {
  return {
    id: 1,
    email: 'crew@example.com',
    nickname: '테스트',
    picture: null,
    role: 'MEMBER',
    timeZone: 'Asia/Seoul',
    onboardingCompletedAt: '2026-01-01T00:00:00Z',
    ...readSessionUser(),
  };
}

function me(discordLinked: boolean) {
  return {
    ...sessionAccount(),
    createdAt: '2026-01-01T00:00:00Z',
    discordNickname: null,
    discordLinked,
    discordHandle: discordLinked ? MOCK_DISCORD_HANDLE : null,
  };
}

/**
 * core-front 개발 서버의 미리보기 세션(lib/preview.ts). 서버가 발급한 토큰이 없어 진짜 서버는 늘 401 을 준다.
 * 진짜 회원 id 는 양수라 0 으로 가른다.
 */
const PREVIEW_ACCOUNT_ID = 0;

/**
 * 진짜 GET /api/me 응답에 `discordLinked` 만 덧붙인다. 401 등 실패는 그대로 넘긴다.
 * 백엔드에 닿지 않거나, 미리보기 세션이라 401 이면 대체 응답 — 백엔드를 띄운 채로도 미리보기로 신청 흐름을 볼 수 있게.
 */
async function realMeWithLinked(request: Request): Promise<Response | ReturnType<typeof me>> {
  let real: Response;
  try {
    real = await fetch(bypass(request));
  } catch {
    return me(readLinked());
  }
  if (real.status === 401 && readSessionUser()?.id === PREVIEW_ACCOUNT_ID) return me(readLinked());
  if (!real.ok) return real;
  const linked = readLinked();
  return HttpResponse.json({ ...(await real.json()), discordLinked: linked, discordHandle: linked ? MOCK_DISCORD_HANDLE : null });
}

export const meDiscordHandlers = mockClient.createHandlerGroup('/api', [
  {
    method: 'GET',
    path: '/me',
    presets: [
      {
        label: '실제 응답 + 연동 상태 기억',
        status: 200,
        response: ({ request }: MockResolveContext) => realMeWithLinked(request),
      },
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
        label: '로그인 만료 (401)',
        status: 401,
        response: { errorCode: 'UNAUTHORIZED', errorMessage: '로그인이 필요합니다.' },
      },
      {
        label: '디스코드 서버 미가입 (403)',
        status: 403,
        response: { errorCode: 'DISCORD_NOT_IN_GUILD', errorMessage: '스터디클럽 디스코드 서버 멤버가 아닙니다.' },
      },
      {
        label: '디스코드 응답 실패 (503)',
        status: 503,
        response: { errorCode: 'EXTERNAL_SERVICE_ERROR', errorMessage: '디스코드 연동에 실패했습니다.' },
      },
    ],
  },
  {
    method: 'DELETE',
    path: '/link',
    presets: [
      {
        label: '해제 성공',
        status: 204,
        response: () => {
          writeLinked(false);
          return new HttpResponse(null, { status: 204 });
        },
      },
      {
        label: '참여 중이라 해제 불가 (409)',
        status: 409,
        response: { errorCode: 'DISCORD_UNLINK_BLOCKED', errorMessage: '참여 중인 스터디가 있어 디스코드 연결을 해제할 수 없습니다.' },
      },
      {
        label: '캡틴이라 해제 불가 (409)',
        status: 409,
        response: { errorCode: 'DISCORD_LINK_REQUIRED', errorMessage: '캡틴은 디스코드 연결을 해제할 수 없습니다.' },
      },
    ],
  },
]);
