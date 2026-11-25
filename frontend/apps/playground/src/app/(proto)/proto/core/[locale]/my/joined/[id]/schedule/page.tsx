'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { ScheduleManager } from '@core/components/ScheduleManager';
import { useManage } from '@core/components/StudyManageShell';

import { MANAGE_SPEC, SCHEDULE_SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';
import { kindRules } from '@/proto/lib/study-kind';

export default function StudyManageSchedulePage() {
  const { study, group, canEdit, setDirty } = useManage();
  const router = useRouter();
  const params = useParams();
  // 클럽은 일정 탭이 없다 — 이 주소로 오면 출석 탭으로 보낸다
  const noSchedule = kindRules(study).hiddenTabs.includes('schedule');
  useEffect(() => {
    if (noSchedule) router.replace(`/proto/core/${params?.locale ?? 'ko'}/my/joined/${study.study_id}/schedule/attendance`);
  }, [noSchedule, params?.locale, router, study.study_id]);
  if (noSchedule) return null;
  return (
    <>
      <ScreenSpecRegistrar spec={MANAGE_SPEC} />
      <ScreenSpecRegistrar spec={SCHEDULE_SPEC} />
      <ScheduleManager study={study} group={group} canEdit={canEdit} onDirtyChange={setDirty} />
    </>
  );
}
