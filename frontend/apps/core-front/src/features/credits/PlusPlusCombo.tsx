'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** 아무 화면에서나 + 를 5번 연달아(간격 1.5초 안) 누르면 /++ 로 간다. 글을 쓰는 중에는 듣지 않는다. */
export const COMBO_FLAG = 'sc-plusplus-combo';
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
      try {
        // 키 입력이 브라우저의 "사용자 동작"이라 도착한 화면이 BGM 을 바로 틀 수 있다
        sessionStorage.setItem(COMBO_FLAG, '1');
      } catch {
        // 저장소가 막힌 브라우저(사생활 보호 모드)면 기억만 못 한다
      }
      router.push(`/${locale}/++`);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locale, router]);
  return null;
}
