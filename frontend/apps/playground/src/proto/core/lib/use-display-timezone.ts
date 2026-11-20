'use client';

import { useSyncExternalStore } from 'react';

import { getTimeZone } from '@core/lib/me';

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
  return useSyncExternalStore(subscribe, getTimeZone, () => 'Asia/Seoul');
}
