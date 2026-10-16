'use client';

import { AttendanceTabContent } from '@/components/AttendanceTabContent';
import { useManage } from '@/components/StudyManageShell';
import { useStudyAttendance, useStudyMeetings } from '@/features/studies/queries';

export default function StudyManageAttendancePage() {
  const { study, group, groupId, canEdit } = useManage();
  const meetingQuery = useStudyMeetings(Number(study.id), groupId);
  const attendanceQuery = useStudyAttendance(Number(study.id), groupId);
  return (
    <AttendanceTabContent
      study={study}
      group={group}
      groupId={groupId}
      meetingData={meetingQuery.data}
      attendanceData={attendanceQuery.data}
      refetchAttendance={attendanceQuery.refetch}
      canEdit={canEdit}
    />
  );
}
