'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

import { clubOfStudy } from '@console/lib/clubs';
import { MyClub } from '@core/components/MyClub';
import { PAGE } from '@core/lib/layout';
import { ArrowLeft } from 'lucide-react';

import { SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';
import { kindOf } from '@/proto/lib/study-kind';
import { useMswStudies } from '@/proto/lib/use-msw-studies';

/**
 * 내 클럽 — 주소 값은 클럽(STUDY_PROGRAM.ID)이다. 달이 바뀌어도 주소가 같다.
 * TODO(api): GET /api/clubs/{programId}/me — 멤버가 아니면 403
 */
export default function MyClubPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ko';
  const programId = String(params?.programId ?? '');
  const studies = useMswStudies();
  const cohorts = studies.filter((s) => s.program?.id === programId && kindOf(s) === 'club');
  // 지금 진행 중인 기수 — 없으면 가장 최근 것
  const current = cohorts.find((s) => s.status === 'ongoing') ?? cohorts[cohorts.length - 1];
  const club = current && clubOfStudy(current);

  return (
    <main className={`${PAGE} flex flex-col gap-6 py-8`}>
      <ScreenSpecRegistrar spec={SPEC} />
      <Link
        href={`/proto/core/${locale}/my/joined`}
        className='inline-flex items-center gap-1 self-start type-label-lg text-fg-secondary hover:text-fg'
      >
        <ArrowLeft className='h-4 w-4' aria-hidden />내 스터디룸
      </Link>
      {current && club ? (
        <MyClub club={club} study={current} locale={locale} />
      ) : (
        <p className='py-16 text-center type-body-md text-fg-secondary'>참여 중인 클럽이 아닙니다.</p>
      )}
    </main>
  );
}
