'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { RetroBoard } from '@core/components/MeetingRetro';
import { RetroRosterToolbar } from '@core/components/RetroRosterToolbar';
import { useManage } from '@core/components/StudyManageShell';

import { MANAGE_SPEC } from '../spec';
import { CREW_RETRO_SPEC, LEAD_RETRO_SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

function Board() {
  const { study, role, locale } = useManage();
  const meetingId = useSearchParams().get('meeting') ?? undefined;
  return (
    <>
      <ScreenSpecRegistrar spec={MANAGE_SPEC} />
      <ScreenSpecRegistrar spec={CREW_RETRO_SPEC} />
      {role !== 'crew' && <ScreenSpecRegistrar spec={LEAD_RETRO_SPEC} />}
      {role === 'captain' && <RetroRosterToolbar studyId={study.id} />}
      <RetroBoard study={study} role={role} locale={locale} meetingId={meetingId} />
    </>
  );
}

export default function StudyRetroPage() {
  return (
    <Suspense>
      <Board />
    </Suspense>
  );
}
