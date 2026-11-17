'use client';

import { useSyncExternalStore } from 'react';

import { getUser, USER_CHANGED_EVENT } from '@/features/auth/auth';
import { resolveDisplayZone } from '@/features/schedule/timezone';

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(USER_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(USER_CHANGED_EVENT, onChange);
  };
}

export function getDisplayTimeZone(): string {
  return resolveDisplayZone(getUser()?.timeZone, Intl.DateTimeFormat().resolvedOptions().timeZone);
}

/** 프로필 저장·다른 탭의 프로필 변경을 즉시 반영한다. */
export function useDisplayTimeZone() {
  return useSyncExternalStore(subscribe, getDisplayTimeZone, () => 'Asia/Seoul');
}
