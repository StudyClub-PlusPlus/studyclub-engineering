'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { ApplicationsTab } from '@/features/applications/ApplicationsTab';
import { useStudyDetail } from '@/features/studies/queries';

export default function StudyApplicantsPage() {
  const { id } = useParams<{ id: string }>();
  const studyId = /^\d+$/.test(id) ? Number(id) : NaN;
  if (!Number.isSafeInteger(studyId) || studyId <= 0) notFound();
  const study = useStudyDetail(studyId);

  return (
    <div>
      <Link
        href='/studies'
        className='inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline'
      >
        <ArrowLeft size={15} aria-hidden /> 스터디 관리
      </Link>
      <h1 className='mb-6 mt-3 text-2xl font-extrabold tracking-tight'>
        {study.data?.title ? `${study.data.title} 신청자` : '스터디 신청자'}
      </h1>
      <ApplicationsTab key={studyId} studyId={studyId} />
    </div>
  );
}
