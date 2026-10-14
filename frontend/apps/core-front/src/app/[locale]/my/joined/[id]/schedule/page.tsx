'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

export default function StudySchedulePage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ko';

  return (
    <div className='mx-auto max-w-6xl px-6 pb-16 pt-8'>
      <Link
        href={`/${locale}/my/joined`}
        className='inline-flex items-center gap-1.5 text-sm font-medium text-fg-secondary hover:text-fg'
      >
        <ArrowLeft size={15} /> 내 스터디
      </Link>
      <p className='mt-16 text-center text-sm text-fg-secondary'>스터디 일정 화면을 준비 중입니다.</p>
    </div>
  );
}
