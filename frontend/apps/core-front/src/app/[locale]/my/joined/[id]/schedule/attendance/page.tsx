'use client';

import { AttendanceTabContent } from '@/features/attendance/AttendanceTabContent';
import { useStudyAttendance } from '@/features/attendance/queries';
import { useStudyMeetings } from '@/features/schedule/queries';
import { useManage } from '@/features/schedule/StudyManageShell';

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
