'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { RetroBoard } from '@/features/meeting-retro/RetroBoard';

function Board() {
  const meeting = Number(useSearchParams().get('meeting'));
  return <RetroBoard meetingId={meeting > 0 ? meeting : undefined} />;
}

export default function StudyManageRetroPage() {
  return (
    <Suspense>
      <Board />
    </Suspense>
  );
}
