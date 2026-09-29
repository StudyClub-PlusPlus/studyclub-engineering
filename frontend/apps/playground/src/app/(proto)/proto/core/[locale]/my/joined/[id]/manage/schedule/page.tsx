'use client';

import { ScheduleManager } from '@core/components/ScheduleManager';
import { useManage } from '@core/components/StudyManageShell';

import { MANAGE_SPEC, SCHEDULE_SPEC } from '../spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export default function StudyManageSchedulePage() {
  const { study, group } = useManage();
  return (
    <>
      <ScreenSpecRegistrar spec={MANAGE_SPEC} />
      <ScreenSpecRegistrar spec={SCHEDULE_SPEC} />
      <ScheduleManager study={study} group={group} />
    </>
  );
}
