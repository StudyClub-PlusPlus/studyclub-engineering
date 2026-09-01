'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import { t } from '@core/lib/i18n';

/**
 * 상단 「내 스터디」 — 로그인한 회원에게만 보인다.
 *
 * 드롭다운이 아니라 **페이지로 보낸다.** 출석 현황은 표라서 말풍선 안에 넣으면 잘리고,
 * 매주 쓰는 화면이라 주소로 바로 열 수 있어야 한다.
 */
export function MyStudiesLink({ locale }: { locale: Locale }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(Boolean(getUser())), []);
  if (!signedIn) return null;

  return (
    <Link
      href={`/proto/core/${locale}/my/studies`}
      className='hidden rounded-full border border-border-strong px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-surface-2 sm:block'
    >
      {t({ ko: '내 스터디', en: 'My studies' }, locale)}
    </Link>
  );
}
