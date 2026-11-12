'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** 아무 화면에서나 + 를 5번 연달아(간격 1.5초 안) 누르면 /++ 로 간다. 글을 쓰는 중에는 듣지 않는다. */
const NEED = 5;
const GAP_MS = 1500;

export function PlusPlusCombo({ locale }: { locale: string }) {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (e.key !== '+') {
        count = 0;
        return;
      }
      const now = Date.now();
      count = now - last <= GAP_MS ? count + 1 : 1;
      last = now;
      if (count < NEED) return;
      count = 0;
      router.push(`/${locale}/++`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locale, router]);
  return null;
}
