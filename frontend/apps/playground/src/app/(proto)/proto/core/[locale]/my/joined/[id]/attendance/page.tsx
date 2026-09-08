'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * 옛 출석 기록 주소. 내 스터디 카드의 출석 기록에서 연다.
 */
export default function AttendanceRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) ?? 'ko';
  const id = typeof params?.id === 'string' ? params.id : '';

  useEffect(() => {
    const q = id ? `?open=${encodeURIComponent(id)}` : '';
    router.replace(`/proto/core/${locale}/my/joined${q}`);
  }, [id, locale, router]);

  return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;
}
