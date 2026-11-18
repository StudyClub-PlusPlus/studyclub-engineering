import { useSyncExternalStore } from 'react';

import { getUser } from '@/features/auth/auth';

export const FALLBACK_TIME_ZONE = 'Asia/Seoul';

function profileZone(): string {
  const zone = getUser()?.timeZone;
  if (!zone) return FALLBACK_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

const noSubscription = () => () => {};

/**
 * 백오피스가 시각을 읽고 쓰는 기준 시간대 (IANA ID) — 로그인 때 받은 운영자 프로필 시간대(세션 user 의 `timeZone`), 없으면 서울.
 * 브라우저 시간대는 쓰지 않는다: 같은 운영자가 다른 곳에서 열어도 화면마다 기준이 같아야 한다.
 * 반 시간대가 본질인 일정 표·출석은 이 값 대신 반 시간대를 쓴다.
 * 프로필을 바꾸면 다시 로그인한 뒤부터 반영된다. 서버 렌더에서는 세션을 모르므로 서울로 그린다.
 */
export function useDisplayTimeZone(): string {
  return useSyncExternalStore(noSubscription, profileZone, () => FALLBACK_TIME_ZONE);
}
