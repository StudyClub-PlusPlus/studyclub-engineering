'use client';

import { createContext, useContext, useEffect, useId, useSyncExternalStore } from 'react';

import { getTimeZone } from '@core/lib/me';

/** 백오피스 안에서만 표시 기준을 덮어쓴다. 회원 프로필 값은 수정하지 않는다. */
export const DisplayTimeZoneContext = createContext<{
  zone: string;
  lock: (id: string, blocked: boolean, zone: string) => void;
} | null>(null);

export function useIsConsoleTimeZone() {
  return useContext(DisplayTimeZoneContext) !== null;
}

export function useTimeZoneChangeLock(blocked: boolean) {
  const context = useContext(DisplayTimeZoneContext);
  const lock = context?.lock;
  const zone = context?.zone ?? 'Asia/Seoul';
  const id = useId();
  useEffect(() => {
    lock?.(id, blocked, zone);
    return () => lock?.(id, false, zone);
  }, [id, lock, blocked, zone]);
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener('sc:timezone-change', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('sc:timezone-change', onChange);
  };
}

/** 서버와 첫 화면의 값을 맞춘 뒤, 브라우저에서 저장된 프로필 시간대를 우선한다. */
export function useDisplayTimeZone() {
  const override = useContext(DisplayTimeZoneContext);
  const profileZone = useSyncExternalStore(subscribe, getTimeZone, () => 'Asia/Seoul');
  return override?.zone ?? profileZone;
}
