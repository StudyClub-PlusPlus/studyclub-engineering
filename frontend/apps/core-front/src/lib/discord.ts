// 디스코드 계정 연동 — 연동 여부 조회(GET /api/me 의 discordLinked)와 연동(POST /api/me/discord/link).
// 연동 여부는 서버의 ACCOUNT.DISCORD_ID 가 정본이다. 브라우저에 따로 저장하지 않는다.
// 백엔드(DSC-01·DSC-02) 전에는 개발 서버의 MSW 목(packages/mock handlers/discord.ts)이 답한다.

import { ApiError, http } from './http';

/**
 * 연동 API(DSC-01)가 서버에 있는가. 없으면 연동 창이 POST 를 보내지 않고 「준비 중」을 알린다.
 * NEXT_PUBLIC_DISCORD_LINK_READY 가 정하고, 비어 있으면 MSW 목이 도는 개발 서버에서만 켠다.
 * DSC-01 이 나오면 이 분기를 디스코드 OAuth 팝업으로 바꾼다.
 */
const DISCORD_LINK_READY_ENV = process.env.NEXT_PUBLIC_DISCORD_LINK_READY;
export const DISCORD_LINK_READY = DISCORD_LINK_READY_ENV
  ? DISCORD_LINK_READY_ENV === 'true'
  : process.env.NODE_ENV === 'development';

/**
 * 연동 여부.
 * - linked / unlinked : 서버가 판정한 값
 * - unauthorized      : 세션이 끝났다 — 다시 로그인해야 한다
 * - unknown           : 조회 실패이거나 응답에 discordLinked 가 아직 없다(DSC-02 배포 전).
 *                       신청 제출이 403 으로 최종 판정하므로 호출부는 폼을 열어도 된다
 */
export type DiscordLinkState = 'linked' | 'unlinked' | 'unauthorized' | 'unknown';

/** GET /api/me 중 이 파일이 읽는 필드만. */
type MeDiscordFields = { discordLinked?: boolean | null };

export async function fetchDiscordLinkState(): Promise<DiscordLinkState> {
  try {
    const me = await http<MeDiscordFields>('/api/me');
    if (typeof me?.discordLinked !== 'boolean') return 'unknown';
    return me.discordLinked ? 'linked' : 'unlinked';
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return 'unauthorized';
    return 'unknown';
  }
}

/** POST /api/me/discord/link — 인가 코드만 보낸다. 디스코드 식별자·핸들은 서버가 직접 받는다. 응답 204. */
export async function linkDiscord(code: string): Promise<void> {
  await http<null>('/api/me/discord/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
}
