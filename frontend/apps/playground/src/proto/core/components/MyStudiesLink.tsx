'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { getUser } from '@core/lib/auth';
import type { Locale } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import { ButtonLink } from '@studyclub/ui';

/**
 * 상단 「내 스터디룸」 — 로그인한 회원에게만 보인다.
 *
 * 참여 목록으로 보낸다. 기본 탭은 참여중.
 */
export function MyStudiesLink({ locale }: { locale: Locale }) {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const user = getUser();
    setSignedIn(Boolean(user) && user?.onboardingCompletedAt !== null);
  }, []);
  if (!signedIn) return null;

  return (
    <ButtonLink
      linkAs={Link}
      variant='secondary'
      href={`/proto/core/${locale}/my/joined`}
      className='hidden sm:inline-flex'
    >
      {t({ ko: '내 스터디룸', en: 'My study room' }, locale)}
    </ButtonLink>
  );
}
