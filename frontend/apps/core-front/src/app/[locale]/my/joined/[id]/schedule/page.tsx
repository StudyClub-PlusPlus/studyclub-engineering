'use client';

import { useStudyAttendance } from '@/features/attendance/queries';
import { useStudyMeetings } from '@/features/schedule/queries';
import { ScheduleTab } from '@/features/schedule/ScheduleTab';
import { useManage } from '@/features/schedule/StudyManageShell';

export default function StudyManageSchedulePage() {
  const { study, group, groupId, canEdit, setDirty } = useManage();
  const meetingQuery = useStudyMeetings(Number(study.id), groupId);
  const attendanceQuery = useStudyAttendance(Number(study.id), groupId);
  async function refetchAll() {
    await Promise.all([meetingQuery.refetch(), attendanceQuery.refetch()]);
  }

  return (
    <ScheduleTab
      study={study}
      group={group}
      groupId={groupId}
      meetingData={meetingQuery.data}
      attendanceData={attendanceQuery.data}
      refetchMeetings={refetchAll}
      canEdit={canEdit}
      onDirty={setDirty}
    />
  );
}
