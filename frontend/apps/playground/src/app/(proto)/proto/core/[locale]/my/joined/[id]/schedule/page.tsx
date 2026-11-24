'use client';

import { RetroCell } from '@core/components/MeetingRetro';
import { ScheduleManager } from '@core/components/ScheduleManager';
import { useManage } from '@core/components/StudyManageShell';

import { CREW_RETRO_SPEC, LEAD_RETRO_SPEC } from './retro/spec';
import { MANAGE_SPEC, SCHEDULE_SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

export default function StudyManageSchedulePage() {
  const { study, group, canEdit, setDirty, role, locale } = useManage();
  return (
    <>
      <ScreenSpecRegistrar spec={MANAGE_SPEC} />
      <ScreenSpecRegistrar spec={SCHEDULE_SPEC} />
      <ScreenSpecRegistrar spec={CREW_RETRO_SPEC} />
      {role !== 'crew' && <ScreenSpecRegistrar spec={LEAD_RETRO_SPEC} />}
      <ScheduleManager
        study={study}
        group={group}
        canEdit={canEdit}
        onDirtyChange={setDirty}
        retroCell={(m) => <RetroCell study={study} meeting={m} role={role} locale={locale} />}
      />
    </>
  );
}
