import { useQuery } from '@tanstack/react-query';

import { getStudyMeetings } from './repository';
import { studyKeys } from '@/features/studies/keys';

/** 내 분반 정보 (groupId 없이 첫 로드). Shell에서 role·group 도출에 사용. */
export function useStudyGroupInfo(studyId: number) {
  return useQuery({
    queryKey: studyKeys.groupInfo(studyId),
    queryFn: () => getStudyMeetings(studyId),
    enabled: Number.isFinite(studyId) && studyId > 0,
    retry: false,
  });
}

export function useStudyMeetings(studyId: number, groupId: number) {
  return useQuery({
    queryKey: studyKeys.meetings(studyId, groupId),
    queryFn: () => getStudyMeetings(studyId, groupId),
    enabled: Number.isFinite(studyId) && Number.isFinite(groupId),
  });
}
