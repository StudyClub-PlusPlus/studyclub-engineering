// 디스코드 계정 연동 — 연동 여부 조회(GET /api/me 의 discordLinked)와 연동(POST /api/me/discord/link).
// 연동 여부는 서버의 ACCOUNT.DISCORD_ID 가 정본이다. 브라우저에 따로 저장하지 않는다.
// 백엔드(DSC-01·DSC-02) 전에는 개발 서버의 MSW 목(packages/mock handlers/discord.ts)이 답한다.

import type { Account } from '@/features/account/types';
import { profileKeys } from '@/features/profile/queries';
import { fetchAccount } from '@/features/profile/repository';
import { track, type DiscordConnectFailReason, type DiscordLinkSource } from '@/lib/analytics';
import { emptyResponseSchema } from '@/lib/http';
import { ApiError, http } from '@/lib/http';
import { getQueryClient } from '@/lib/query-client';

/** 디스코드 OAuth 앱 client id. 공개값이다 — 시크릿(DISCORD_OAUTH_CLIENT_SECRET)은 서버에만 있다. */
const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? '';

/**
 * 연동 창이 진짜로 연동할 수 있는가. client id 가 들어간 환경이면 켠다 — 그 환경의 서버 OAuth 시크릿과 같이 넣는다.
 * 꺼져 있으면 연동 창이 POST 를 보내지 않고 「준비 중」을 알린다. 개발 서버는 client id 없이도 MSW 목으로 켠다.
 */
export const DISCORD_LINK_READY = Boolean(DISCORD_CLIENT_ID) || process.env.NODE_ENV === 'development';

/** 팝업이 돌아오는 곳. 서버 DISCORD_OAUTH_REDIRECT_URI 와 Discord 개발자 포털에 등록한 값이 이것과 글자까지 같아야 한다. */
export const DISCORD_CALLBACK_PATH = '/api/auth/discord/callback';
/** 콜백 페이지가 opener 로 보내는 메시지 표식 (구글 로그인 'studyclub-oauth' 와 섞이지 않게) */
export const DISCORD_OAUTH_SOURCE = 'studyclub-discord-oauth';
/** 팝업을 열어 둔 채 답이 없으면 이만큼 뒤에 닫고 취소로 본다 — 연동 창이 「처리 중」에 갇히지 않게 */
const POPUP_TIMEOUT_MS = 5 * 60_000;
/** client id 없는 개발 서버에서 보내는 자리값. MSW 목은 코드를 보지 않는다 */
const MOCK_OAUTH_CODE = 'mock-oauth';

/** blocked: 팝업 차단 · cancelled: 창을 닫았거나 디스코드에서 취소 */
export class DiscordPopupError extends Error {
  constructor(readonly reason: 'blocked' | 'cancelled') {
    super(`discord oauth ${reason}`);
  }
}

/**
 * 디스코드 인가 팝업을 열고 돌아온 code 를 준다. 팝업 차단을 피하려면 **클릭 핸들러 안에서 await 전에** 부른다.
 * 메시지는 같은 출처 · 우리 표식 · 이번에 만든 state 가 모두 맞을 때만 받는다 (다른 창이 code 를 끼워 넣지 못하게).
 */
export function requestDiscordCode(): Promise<string> {
  if (!DISCORD_CLIENT_ID) return Promise.resolve(MOCK_OAUTH_CODE);

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: window.location.origin + DISCORD_CALLBACK_PATH,
    response_type: 'code',
    scope: 'identify guilds.members.read',
    state,
  });
  const w = 480;
  const h = 720;
  const left = window.screenX + (window.outerWidth - w) / 2;
  const top = window.screenY + (window.outerHeight - h) / 2;
  const popup = window.open(
    `https://discord.com/oauth2/authorize?${params.toString()}`,
    'studyclub-discord-link',
    `width=${w},height=${h},left=${left},top=${top}`,
  );
  if (!popup) return Promise.reject(new DiscordPopupError('blocked'));

  return new Promise((resolve, reject) => {
    function done() {
      window.removeEventListener('message', onMessage);
      clearInterval(closedTimer);
      clearTimeout(deadline);
    }
    function onMessage(ev: MessageEvent) {
      const data = ev.data;
      if (ev.origin !== window.location.origin || data?.source !== DISCORD_OAUTH_SOURCE || data.state !== state) return;
      done();
      popup?.close();
      if (data.code) resolve(String(data.code));
      else reject(new DiscordPopupError('cancelled'));
    }
    // 사용자가 팝업을 그냥 닫으면 메시지가 오지 않는다
    const closedTimer = setInterval(() => {
      if (!popup.closed) return;
      done();
      reject(new DiscordPopupError('cancelled'));
    }, 500);
    const deadline = setTimeout(() => {
      done();
      popup.close();
      reject(new DiscordPopupError('cancelled'));
    }, POPUP_TIMEOUT_MS);
    window.addEventListener('message', onMessage);
  });
}

/**
 * 연동 여부.
 * - linked / unlinked : 서버가 판정한 값
 * - unauthorized      : 세션이 끝났다 — 다시 로그인해야 한다
 * - unknown           : 조회 실패이거나 응답에 discordLinked 가 아직 없다(DSC-02 배포 전).
 *                       신청 제출이 403 으로 최종 판정하므로 호출부는 폼을 열어도 된다
 */
export type DiscordLinkState = 'linked' | 'unlinked' | 'unauthorized' | 'unknown';

/** 연동 여부를 이만큼 기다려도 답이 없으면 unknown 으로 보고 폼을 연다. */
const LINK_STATE_TIMEOUT_MS = 8000;

/**
 * 신청 버튼이 누를 때마다 부른다. GET /api/me 는 프로필 편집과 같은 `profileKeys.account` 캐시를 쓴다 —
 * 기본 캐시 시간(1분) 안에 다시 누르면 기다리지 않는다. 연동은 linkDiscord 가 캐시에 바로 반영한다.
 */
export async function fetchDiscordLinkState(accountId: number): Promise<DiscordLinkState> {
  const query = getQueryClient().fetchQuery({ queryKey: profileKeys.account(accountId), queryFn: fetchAccount });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), LINK_STATE_TIMEOUT_MS);
  });
  try {
    const me = await Promise.race([query, timeout]);
    if (me === 'timeout' || typeof me.discordLinked !== 'boolean') return 'unknown';
    return me.discordLinked ? 'linked' : 'unlinked';
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return 'unauthorized';
    return 'unknown';
  } finally {
    clearTimeout(timer);
  }
}

/** 신청 제출이 403(미연동)으로 막혔다 — 캐시에 남은 연동 여부를 버려 다음에 누를 때 서버에 다시 묻는다. */
export function forgetDiscordLinkState(accountId: number) {
  void getQueryClient().invalidateQueries({ queryKey: profileKeys.account(accountId) });
}

/**
 * DELETE /api/me/discord/link — 응답 204. 참여 중이면 409 DISCORD_UNLINK_BLOCKED.
 * 다음 신청 때 연동 창이 다시 떠야 하므로 계정 캐시를 버린다.
 */
export async function unlinkDiscord(accountId: number): Promise<void> {
  await http('/api/me/discord/link', emptyResponseSchema, { method: 'DELETE' });
  await getQueryClient().invalidateQueries({ queryKey: profileKeys.account(accountId) });
}

function connectFailReason(e: unknown): DiscordConnectFailReason {
  if (e instanceof DiscordPopupError) return e.reason === 'blocked' ? 'popup_blocked' : 'cancelled';
  if (!(e instanceof ApiError)) return 'error';
  if (e.status === 401) return 'session_expired';
  if ((e.body as { errorCode?: string } | undefined)?.errorCode === 'DISCORD_NOT_IN_GUILD') return 'not_in_guild';
  if (e.status === 409) return 'already_linked';
  return 'error';
}

/**
 * POST /api/me/discord/link — 인가 코드만 보낸다. 디스코드 식별자·핸들은 서버가 직접 받는다. 응답 204.
 * `code` 는 {@link requestDiscordCode} 의 Promise 를 그대로 받는다 — 팝업 단계 실패(취소·차단)도 여기서 센다.
 * `My Discord Connected` · `Discord Connect Failed` 는 여기서만 보낸다 — 연동하는 화면이 늘어도 빠지지 않게.
 */
export async function linkDiscord(
  accountId: number,
  code: string | Promise<string>,
  source: DiscordLinkSource,
): Promise<void> {
  try {
    const resolved = await code;
    await http('/api/me/discord/link', emptyResponseSchema, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: resolved }),
    });
  } catch (e) {
    track({
      name: 'Discord Connect Failed',
      props: { source, reason: connectFailReason(e), http_status: e instanceof ApiError ? e.status : null },
    });
    throw e;
  }
  track({ name: 'My Discord Connected', props: { source } });
  // 캐시가 아직 미연동이면 1분 안에 다시 누를 때 연동 창이 또 뜬다
  getQueryClient().setQueryData<Account>(profileKeys.account(accountId), (prev) =>
    prev ? { ...prev, discordLinked: true } : prev,
  );
  // 응답은 204 라 discordHandle 이 없다 — 계정 캐시를 버려 마이페이지가 @이름을 다시 받게 한다
  await getQueryClient().invalidateQueries({ queryKey: profileKeys.account(accountId) });
}
