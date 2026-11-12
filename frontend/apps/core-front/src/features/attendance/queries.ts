import { useQuery } from '@tanstack/react-query';

import { getStudyAttendance } from '@/features/attendance/repository';
import { studyKeys } from '@/features/studies/keys';

export function useStudyAttendance(studyId: number, groupId: number) {
  return useQuery({
    queryKey: studyKeys.attendance(studyId, groupId),
    queryFn: () => getStudyAttendance(studyId, groupId),
    enabled: Number.isFinite(studyId) && Number.isFinite(groupId),
  });
}
