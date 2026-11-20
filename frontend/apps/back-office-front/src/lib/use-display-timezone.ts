import { useEffect, useSyncExternalStore } from 'react';
import { z } from 'zod';

import { getUser, setUserTimeZone } from '@/features/auth/auth';
import { http } from '@/lib/http';

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

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 백오피스가 시각을 읽고 쓰는 기준 시간대 (IANA ID) — 운영자 프로필 시간대(세션 user 의 `timeZone`), 없으면 서울.
 * 브라우저 시간대는 쓰지 않는다: 같은 운영자가 다른 곳에서 열어도 화면마다 기준이 같아야 한다.
 * 반 시간대가 본질인 일정 표·출석은 이 값 대신 반 시간대를 쓴다.
 * 프로필을 바꾸면 백오피스를 다시 열 때 반영된다(`ProfileTimeZoneSync`). 서버 렌더에서는 세션을 모르므로 서울로 그린다.
 */
export function useDisplayTimeZone(): string {
  return useSyncExternalStore(subscribe, profileZone, () => FALLBACK_TIME_ZONE);
}

const meSchema = z.object({ timeZone: z.string().nullable().optional() });

/** 백오피스를 열 때 한 번 프로필을 읽어, 로그인 뒤 사이트에서 바꾼 시간대를 세션에 반영한다. */
export async function syncProfileTimeZone(): Promise<void> {
  const user = getUser();
  if (!user) return;
  try {
    const { timeZone = null } = await http('/api/me', meSchema);
    if ((timeZone ?? null) === (user.timeZone ?? null)) return;
    setUserTimeZone(timeZone ?? null);
    listeners.forEach((l) => l());
  } catch {
    // 못 읽으면 로그인 때 받은 값을 그대로 쓴다
  }
}

export function ProfileTimeZoneSync() {
  useEffect(() => {
    void syncProfileTimeZone();
  }, []);
  return null;
}
