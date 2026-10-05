'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * 옛 출석 기록 주소. 출석 기록은 스터디 일정의 출석부 탭으로 옮겼다 — 그리로 보낸다.
 * 경로 값은 study_id 다 — 같은 자리의 스터디 일정(`[id]/manage`)과 맞춘다.
 */
export default function AttendanceRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) ?? 'ko';
  const id = typeof params?.id === 'string' ? params.id : '';

  useEffect(() => {
    router.replace(id ? `/proto/core/${locale}/my/joined/${id}/manage/attendance` : `/proto/core/${locale}/my/joined`);
  }, [id, locale, router]);

  return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;
}
