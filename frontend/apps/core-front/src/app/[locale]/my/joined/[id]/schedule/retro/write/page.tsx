'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { RetroWriteForm } from '@/features/meeting-retro/RetroWriteForm';

function Form() {
  const meeting = Number(useSearchParams().get('meeting'));
  return <RetroWriteForm meetingId={meeting > 0 ? meeting : undefined} />;
}

export default function StudyManageRetroWritePage() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
