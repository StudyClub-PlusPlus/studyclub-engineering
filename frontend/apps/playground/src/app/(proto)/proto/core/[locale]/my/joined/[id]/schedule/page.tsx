'use client';

import { clubOfStudy } from '@console/lib/clubs';
import { MyClub } from '@core/components/MyClub';
import { ScheduleManager } from '@core/components/ScheduleManager';
import { useManage } from '@core/components/StudyManageShell';

import { CLUB_TODAY_SPEC } from './club-spec';
import { MANAGE_SPEC, SCHEDULE_SPEC } from './spec';
import { ScreenSpecRegistrar } from '@/proto/annotate';

/** 첫 탭 — 스터디는 일정(규칙 · 회차 · 발표자), 클럽은 오늘(내 기록). 껍데기는 같다 */
export default function StudyManageSchedulePage() {
  const { study, group, canEdit, setDirty, locale } = useManage();
  const club = clubOfStudy(study);
  if (club)
    return (
      <>
        <ScreenSpecRegistrar spec={MANAGE_SPEC} />
        <ScreenSpecRegistrar spec={CLUB_TODAY_SPEC} />
        <MyClub club={club} study={study} locale={locale} />
      </>
    );
  return (
    <>
      <ScreenSpecRegistrar spec={MANAGE_SPEC} />
      <ScreenSpecRegistrar spec={SCHEDULE_SPEC} />
      <ScheduleManager study={study} group={group} canEdit={canEdit} onDirtyChange={setDirty} />
    </>
  );
}
