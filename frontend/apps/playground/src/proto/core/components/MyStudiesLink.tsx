'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import { t } from '@core/lib/i18n';

/**
 * 상단 「내 스터디」 — 로그인한 회원에게만 보인다.
 *
 * 참여 목록으로 보낸다. 기본 탭은 참여중.
 */
export function MyStudiesLink({ locale }: { locale: Locale }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => setSignedIn(Boolean(getUser())), []);
  if (!signedIn) return null;

  return (
    <Link
      href={`/proto/core/${locale}/my/joined`}
      className='hidden rounded-full border border-border-strong px-4 py-2 text-sm font-semibold text-fg transition-colors hover:bg-surface-2 sm:block'
    >
      {t({ ko: '내 스터디', en: 'My studies' }, locale)}
    </Link>
  );
}
