'use client';

import { useEffect, useState } from 'react';

import type { Study } from '@studyclub/types';

import { recruitmentDeadlineAt } from './recruitment-deadline';

/** 열린 화면도 마감 순간에 다시 판정한다. 백그라운드 탭 복귀 시에도 현재 시각으로 갱신. */
export function useRecruitmentClock(studies: readonly Study[]) {
  const [now, setNow] = useState(Date.now);
  const next = Math.min(...studies.map((s) => Date.parse(recruitmentDeadlineAt(s) ?? '')).filter((at) => at > now));
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = window.setTimeout(tick, Math.max(1, Math.min(60_000, next - Date.now())));
    window.addEventListener('focus', tick);
    return () => { window.clearTimeout(timer); window.removeEventListener('focus', tick); };
  }, [next, now]);
  return now;
}
