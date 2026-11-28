'use client';


import type { MemberRegion } from '@studyclub/types';

import { getUser } from '@/features/auth/auth';

export const DISCORD_NICKNAME_EXAMPLE = '홍길동/SWE/산호세/시스템디자인';

/** 신청 폼 별명 칸의 첫 값. 서버가 연동할 때 디스코드에서 받아 둔 별명(세션에 캐시)이다. 직접 입력하지 않는다. */
export function getDiscordNickname(): string | undefined {
  return getUser()?.discordNickname?.trim() || undefined;
}

/* ── 거주 지역 ───────────────────────────────────────────────────────────── */

/**
 * 시간대에서 거주 지역을 정한다 — 서울이면 한국, 그 밖이면 북미.
 * 지역을 따로 저장하지 않는다. 값이 둘이면 시간대만 고친 회원의 지역이 옛 값으로 남는다.
 */
export function regionOfTimeZone(timeZone: string | null | undefined): MemberRegion {
  if (!timeZone || timeZone === 'Asia/Seoul') return 'KR';
  return 'NA';
}

/**
 * 회원 거주 지역. 신청 폼이 "가능한 시간"을 어느 시간대 기준으로 받을지 정하는 값이다.
 * 회원이 마이페이지에서 고친 시간대를 따라간다.
 */
export function getRegion(): MemberRegion {
  return regionOfTimeZone(getUser()?.timeZone);
}
