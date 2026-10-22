// 스터디 목록 조회 — 키·fetcher·훅을 한곳에. 브라우저가 백엔드를 직접 부른다.
import { useQuery } from '@tanstack/react-query';

import {
  studyQuery,
  toStudy,
  toStudyFromDetail,
  type ApiPage,
  type ApiStudy,
  type ApiStudyDetail,
  type StudySearch,
} from '@/lib/api';
import type { Study } from '@/lib/content';
import { http } from '@/lib/http';
import { joinedStudyIds, type ApiMyStudies } from '@/lib/joined-api';
import { getStudyAttendance, getStudyMeetings } from '@/lib/joined-detail-api';

export const studyKeys = {
  all: ['studies'] as const,
  list: (search: StudySearch) => [...studyKeys.all, 'list', search] as const,
  detail: (studyId: number) => [...studyKeys.all, 'detail', studyId] as const,
  joined: () => [...studyKeys.all, 'joined'] as const,
  groupInfo: (studyId: number) => [...studyKeys.all, 'group-info', studyId] as const,
  meetings: (studyId: number, groupId: number) => [...studyKeys.all, 'meetings', studyId, groupId] as const,
  attendance: (studyId: number, groupId: number) => [...studyKeys.all, 'attendance', studyId, groupId] as const,
};

/**
 * 목록. 공개 API 라 로그인 없이도 받는다.
 * TODO(api): GET /api/studies
 *
 * `initial` 은 서버가 기본 조건으로 이미 받아 둔 첫 화면이다 — 같은 조건이면 요청을 한 번 더 보내지
 * 않도록 `initialData` 로 심는다. 필터를 건드리면 키가 달라져 자연히 새로 받는다.
 */
export function useStudies(search: StudySearch, initial?: Study[]) {
  const isDefault = Object.values(search).every((v) => v === undefined);
  return useQuery({
    queryKey: studyKeys.list(search),
    queryFn: async () => {
      const page = await http<ApiPage<ApiStudy>>(`/api/studies?${studyQuery(search)}`);
      return page.items.map(toStudy);
    },
    initialData: isDefault ? initial : undefined,
    // 필터를 바꾸는 동안 이전 목록을 지우지 않는다 — 비었다 다시 차면 어디를 보고 있었는지 잃는다
    placeholderData: (previous) => previous,
  });
}

/** TODO(api): GET /api/studies/{studyId} */
/** initial = 서버에서 미리 받은 값 — 첫 HTML 에 본문이 실리게 한다(크롤러는 JS 를 거의 안 돌린다) */
export function useStudyDetail(studyId: number, initial?: Study | null) {
  return useQuery({
    queryKey: studyKeys.detail(studyId),
    ...(initial ? { initialData: initial } : {}),
    queryFn: async () => {
      const detail = await http<ApiStudyDetail>(`/api/studies/${studyId}`);
      return toStudyFromDetail(detail);
    },
    retry: false,
  });
}

/** 로그인 회원의 참여 명부. 서버가 relation·role을 판정한다. */
export function useMyStudies() {
  return useQuery({
    queryKey: studyKeys.joined(),
    queryFn: async () => {
      const response = await http<ApiMyStudies>('/api/me/studies');
      return { ...response, ids: joinedStudyIds(response.items) };
    },
    retry: false,
  });
}

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

export function useStudyAttendance(studyId: number, groupId: number) {
  return useQuery({
    queryKey: studyKeys.attendance(studyId, groupId),
    queryFn: () => getStudyAttendance(studyId, groupId),
    enabled: Number.isFinite(studyId) && Number.isFinite(groupId),
  });
}
