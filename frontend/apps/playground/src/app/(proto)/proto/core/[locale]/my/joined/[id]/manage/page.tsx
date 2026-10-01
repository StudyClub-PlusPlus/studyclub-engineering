'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** 스터디 관리의 첫 화면은 일정이다. */
export default function StudyManageIndex() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) ?? 'ko';
  const id = typeof params?.id === 'string' ? params.id : '';

  useEffect(() => {
    router.replace(`/proto/core/${locale}/my/joined/${id}/manage/schedule`);
  }, [id, locale, router]);

  return null;
}
