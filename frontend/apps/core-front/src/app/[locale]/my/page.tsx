'use client';

// 수강생 페이지(A8) — 로그인 게이팅. 서버 미들웨어가 access 쿠키로 1차 게이트하고,
// 여기서도 클라이언트 세션(sc_user)이 없으면 /login 으로 보낸다(방어적).
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { Locale } from '@studyclub/types';

import { getUser, type SessionUser } from '@/features/auth/auth';
import { IS_DEV, syncPreview } from '@/features/auth/preview';
import { ProfileCard } from '@/features/profile/ProfileCard';
import { PAGE } from '@/lib/layout';

/**
 * 마이페이지 — 내 정보만 다룬다.
 *
 * 스터디 목록은 두지 않는다. 참여 중·참여 종료는 내 스터디룸(/my/joined)이 맡는다.
 * 신청에는 승인 대기가 없다 (POL-0004) — 신청하면 곧 참여라 따로 기다리는 목록이 필요 없다.
 *
 * 시간대는 내 정보에 있다: 일정 미정 스터디의 신청 폼이 "가능한 시간"을 이 시간대가 속한 지역의
 * 현지 시간으로 받으므로, 시간대가 틀리면 운영자가 겹치는 시간을 잘못 계산한다.
 */
export default function MyPage() {
  const params = useParams();
  const router = useRouter();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    // 로컬 미리보기에서는 세션 정의를 맞춘다
    const u = IS_DEV ? syncPreview() : getUser();
    if (!u) {
      router.replace(`/${locale}/login?next=/${locale}/my`);
      return;
    }
    if (!u.onboardingCompletedAt) {
      router.replace(`/${locale}/onboarding?next=${encodeURIComponent(`/${locale}/my`)}`);
      return;
    }
    setUser(u);
  }, [locale, router]);

  if (!user) {
    return <div className='px-6 py-16 text-center type-body-sm text-fg-secondary'>불러오는 중…</div>;
  }

  return (
    <div className={`${PAGE} pb-16 pt-10`}>
      <h1 className='type-headline-lg'>마이페이지</h1>

      <ProfileCard user={user} locale={locale} onUserChange={setUser} />
    </div>
  );
}
