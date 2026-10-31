'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getUser } from '@/lib/auth';
import type { Locale } from '@/lib/content';
import { t } from '@/lib/i18n';

/**
 * 상단 「내 스터디」 — 로그인한 회원에게만 보인다.
 *
 * 드롭다운이 아니라 **페이지로 보낸다.** 출석 현황은 표라서 말풍선 안에 넣으면 잘리고,
 * 매주 쓰는 화면이라 주소로 바로 열 수 있어야 한다.
 */
export function MyStudiesLink({ locale }: { locale: Locale }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    // 가입을 마치지 않았으면 내 스터디룸이 온보딩으로 돌려보낸다 — 헤더는 「가입 마무리」만 둔다
    const user = getUser();
    setSignedIn(Boolean(user) && user?.onboardingCompletedAt !== null);
  }, []);
  if (!signedIn) return null;

  return (
    <Link
      href={`/${locale}/my/joined`}
      className='sc-button hidden type-label-lg sm:inline-flex'
      data-variant='secondary'
      data-size='md'
    >
      {t({ ko: '내 스터디룸', en: 'My study room' }, locale)}
    </Link>
  );
}
