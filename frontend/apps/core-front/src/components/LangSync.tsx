'use client';

import { useEffect } from 'react';

/** 서버 렌더 시 루트 layout의 lang='ko' 고정값을 실제 locale로 동기화한다. */
export function LangSync({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
