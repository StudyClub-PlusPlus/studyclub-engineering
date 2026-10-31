import { apiAttendanceSchema } from '@/features/attendance/response-schema';
import { emptyResponseSchema } from '@/lib/http';
import { http } from '@/lib/http';

export function getStudyAttendance(studyId: number, studyGroupId: number) {
  return http(`/api/me/studies/${studyId}/attendances?studyGroupId=${studyGroupId}`, apiAttendanceSchema);
}

export function saveStudyAttendance(
  studyId: number,
  body: {
    studyGroupId: number;
    updates: Array<{ meetingId: number; participantId: number; status: string }>;
    withdrawals?: number[];
  },
) {
  return http(`/api/me/studies/${studyId}/attendances`, emptyResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
