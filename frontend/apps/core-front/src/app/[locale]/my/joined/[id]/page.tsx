'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function JoinedStudyPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) ?? 'ko';
  const id = typeof params?.id === 'string' ? params.id : '';
  useEffect(() => {
    router.replace(id ? `/${locale}/my/joined/${id}/schedule` : `/${locale}/my/joined`);
  }, [id, locale, router]);
  return <div className='px-6 py-16 text-center text-sm text-fg-secondary'>불러오는 중…</div>;
}
