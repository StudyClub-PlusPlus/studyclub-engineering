// 스터디 조회·수정·삭제 — 키·fetcher·훅을 한 파일에 둔다.
//
// 키를 딕셔너리 하나에 모으지 않는다. 그건 도메인이 수십 개라 이름이 충돌할 때 필요한 장치다.
// 여기서는 **이 기능을 고치는 사람이 이 파일만 열면 되는 것**이 더 중요하다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  toRow,
  type ApiStudyDetail,
  type ApiStudyPage,
  type ApiStudyProgram,
  type StudyCreatePayload,
  type StudyFilter,
  type StudyRow,
  type StudyUpdatePayload,
} from '@/features/studies/types';
import { http, qs } from '@/lib/http';

/**
 * 키는 넓은 것에서 좁은 것으로 쌓는다 — `['studies']` 를 무효화하면 아래가 전부 딸려 간다.
 * 필터를 키에 넣으므로 조건이 바뀌면 자연히 다른 캐시가 된다.
 */
export const studyKeys = {
  all: ['studies'] as const,
  list: (filter: StudyFilter) => [...studyKeys.all, 'list', filter] as const,
  detail: (studyId: number) => [...studyKeys.all, 'detail', studyId] as const,
};

/** 프로그램 목록은 스터디 목록과 따로 무효화된다 — 등록으로 늘어나는 건 같지만 필터·페이지가 없다. */
export const programKeys = {
  all: ['study-programs'] as const,
  clubs: () => [...programKeys.all, 'CLUB'] as const,
};

/**
 * 기수를 붙일 수 있는 클럽 목록. 등록 모달이 열려 있을 때만 쓰므로 `enabled` 로 꺼 둔다 —
 * 정보 탭에서는 부를 이유가 없다.
 */
export function useClubPrograms(enabled: boolean) {
  return useQuery({
    queryKey: programKeys.clubs(),
    queryFn: () =>
      http<{ items: ApiStudyProgram[] }>('/api/admin/study-programs?studyKind=CLUB'),
    select: (page) => page.items,
    enabled,
  });
}

/**
 * ⚠️ 규약 예외 — 백오피스는 `/api/admin` 을 불러야 하지만, 목록은 아직 **사용자 사이트용 목록 API** 를 쓴다.
 * 그래서 **공개된 스터디만** 온다(숨김·DRAFT 제외).
 * `GET /api/admin/studies` 가 status·페이지·total 을 지원하므로 교체할 수 있다 (PR #146 로 구현 완료).
 * 전환 시 `fetchStudies`·`toRow` 와 함께 ApiStudySummary 타입도
 * BackofficeStudyListResponse.StudySummary 에 맞게 바꾼다:
 * status(5단계)·recruitmentCapacity·recruitmentStartAt·hasApplicationForm 추가,
 * slug·phase·currentApplicants·closingSoon 제거.
 */
function fetchStudies(filter: StudyFilter): Promise<ApiStudyPage> {
  return http<ApiStudyPage>(
    `/api/studies${qs({ keyword: filter.keyword, category: filter.category, status: filter.phase, limit: 100 })}`,
  );
}

export function useStudies(filter: StudyFilter) {
  return useQuery({
    queryKey: studyKeys.list(filter),
    queryFn: () => fetchStudies(filter),
    select: (page): { rows: StudyRow[]; total: number } => ({
      rows: page.items.map(toRow),
      total: page.total,
    }),
    // 타이핑 중 이전 결과를 지우지 않는다 — 목록이 깜빡이면 지금 뭘 보고 있었는지 잃는다.
    placeholderData: (previous) => previous,
  });
}

/**
 * 상세·수정·삭제는 백오피스 경로(`/api/admin/studies/{id}`)를 쓴다 — 캡틴만 통과하고, 상세는 DRAFT 도 보인다.
 * 사용자 사이트(`/api/studies/{id}`)는 네비게이터용 상세·수정을 따로 받는다. 서버 로직은 같다.
 */
export function useStudyDetail(studyId: number) {
  return useQuery({
    queryKey: studyKeys.detail(studyId),
    queryFn: () => http<ApiStudyDetail>(`/api/admin/studies/${studyId}`),
    retry: false,
  });
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * 스터디 등록. 201 은 바디가 없고 `Location` 헤더만 온다 — 만들어진 id 가 필요하면 거기서 읽는다.
 * 새 프로그램을 만들었을 수도 있어 클럽 목록도 함께 무효화한다.
 */
export function useCreateStudy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StudyCreatePayload) =>
      http<null>('/api/admin/studies', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: programKeys.all });
      return queryClient.invalidateQueries({ queryKey: studyKeys.all });
    },
  });
}

/** TODO(api): PATCH /api/studies/{studyId} */
export function useUpdateStudy(studyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: StudyUpdatePayload) =>
      http<null>(`/api/admin/studies/${studyId}`, {
        method: 'PATCH',
        headers: JSON_HEADERS,
        body: JSON.stringify(payload),
      }),
    // 목록의 정원·마감도 바뀌므로 상세만이 아니라 스터디 전체를 무효화한다
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studyKeys.all }),
  });
}

/** TODO(api): DELETE /api/studies/{studyId} */
export function useDeleteStudy(studyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => http<null>(`/api/admin/studies/${studyId}`, { method: 'DELETE' }),
    onSuccess: () => {
      // 지워진 상세를 다시 불러오면 404 다 — 무효화하지 않고 캐시에서 뺀다
      queryClient.removeQueries({ queryKey: studyKeys.detail(studyId) });
      return queryClient.invalidateQueries({ queryKey: [...studyKeys.all, 'list'] });
    },
  });
}
