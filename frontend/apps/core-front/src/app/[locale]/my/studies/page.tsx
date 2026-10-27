'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { PAGE } from '@/lib/layout';

/**
 * 오늘 출석 — 회원이 직접 체크인하는 화면.
 *
 * 회원 본인 체크인 API 가 아직 없어(출석 기록은 네비게이터·디스코드 봇이 남긴다) 준비 중으로 둔다.
 * 예전 프로토는 예시 회차와 브라우저 저장소로 돌았다 — 실데이터와 섞여 보여서 걷어냈다.
 * 내 회차·출석은 「내 스터디」(/my/joined)에서 본다.
 */
export default function MyStudiesPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ko';

  return (
    <div className={`${PAGE} pb-16 pt-8`}>
      <Link
        href={`/${locale}/my/joined`}
        className='inline-flex items-center gap-1.5 type-label-lg text-fg-secondary hover:text-fg'
      >
        <ArrowLeft size={15} /> 내 스터디룸
      </Link>
      <p className='mt-16 text-center type-body-sm text-fg-secondary'>출석 체크 화면을 준비 중입니다.</p>
    </div>
  );
}
