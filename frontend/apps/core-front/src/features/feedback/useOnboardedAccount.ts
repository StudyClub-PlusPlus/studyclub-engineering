'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getUser } from '@/lib/auth';
import type { Locale } from '@/lib/content';
import { IS_DEV, syncPreview } from '@/lib/preview';

/**
 * 내 문의는 로그인 · 온보딩을 마친 계정만 쓴다 (스펙 「온보딩 전 계정은 쓰지 못한다」).
 * 서버 미들웨어가 로그인을 먼저 막고, 여기서는 세션이 없으면 로그인으로, 온보딩 전이면 온보딩으로 보낸다
 * — 마이페이지 화면들과 같은 순서다. 둘 다 마친 뒤 돌아올 곳은 `next`(쿼리 포함).
 *
 * 확인을 마치면 계정 번호를, 그 전이나 다른 곳으로 보냈으면 undefined 를 돌려준다.
 */
export function useOnboardedAccount(locale: Locale, next: string): number | undefined {
  const router = useRouter();
  const [accountId, setAccountId] = useState<number>();

  useEffect(() => {
    const u = IS_DEV ? syncPreview() : getUser();
    if (!u) {
      router.replace(`/${locale}/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!u.onboardingCompletedAt) {
      router.replace(`/${locale}/onboarding?next=${encodeURIComponent(next)}`);
      return;
    }
    setAccountId(u.id);
  }, [locale, next, router]);

  return accountId;
}
