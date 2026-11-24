'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { RetroWriteForm } from '@core/components/MeetingRetro';
import { useManage } from '@core/components/StudyManageShell';

import { CREW_RETRO_SPEC } from '../spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

function Form() {
  const { study, role, locale } = useManage();
  const meetingId = useSearchParams().get('meeting') ?? undefined;
  return (
    <>
      <ScreenSpecRegistrar spec={CREW_RETRO_SPEC} />
      <RetroWriteForm study={study} role={role} locale={locale} meetingId={meetingId} />
    </>
  );
}

export default function StudyRetroWritePage() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
