// 스터디 조회·수정·삭제 — 키·fetcher·훅을 한 파일에 둔다.
//
// 키를 딕셔너리 하나에 모으지 않는다. 그건 도메인이 수십 개라 이름이 충돌할 때 필요한 장치다.
// 여기서는 **이 기능을 고치는 사람이 이 파일만 열면 되는 것**이 더 중요하다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type {
  ApiStudyDetail,
  ApiStudyProgram,
  StudyCreatePayload,
  StudyUpdatePayload,
} from '@/features/studies/types';
import { ApiError, http } from '@/lib/http';

/**
 * 키는 넓은 것에서 좁은 것으로 쌓는다 — `['studies']` 를 무효화하면 아래가 전부 딸려 간다.
 * 목록은 서버 컴포넌트가 직접 받는다(`lib/api.ts`) — 여기에는 상세·등록·수정만 있다.
 */
export const studyKeys = {
  all: ['studies'] as const,
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

/** 바뀐 필드만 관리자 수정 API에 보낸다. */
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

/** 삭제 성공 후 상세 캐시를 제거하고 목록과 다음 기수 기본값을 갱신한다. */
export function useDeleteStudy(studyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => http<null>(`/api/admin/studies/${studyId}`, { method: 'DELETE' }),
    onSuccess: () => {
      // 지워진 상세를 다시 불러오면 404 다 — 무효화하지 않고 캐시에서 뺀다
      queryClient.removeQueries({ queryKey: studyKeys.detail(studyId) });
      void queryClient.invalidateQueries({ queryKey: programKeys.all });
      return queryClient.invalidateQueries({ queryKey: [...studyKeys.all, 'list'] });
    },
  });
}

/** 자동 연결이 안 된 스터디의 디스코드 연결을 재시도한다. 봇 호출은 자동 재시도하지 않는다. */
export function useLinkStudyDiscord(studyId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (studyName: string) =>
      http<{ discordStudyId: string; discordRoleId: string }>(`/api/admin/studies/${studyId}/discord-link`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ studyName }),
      }),
    retry: false,
    onSuccess: async () => {
      const queryKey = studyKeys.detail(studyId);
      // POST 성공으로 연결은 확정됐다. 먼저 진행 중인 조회를 취소해 이전 false 응답이 덮어쓰지 못하게 한다.
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData<ApiStudyDetail>(queryKey, (detail) =>
        detail ? { ...detail, discordLinked: true } : detail,
      );
      return queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      // 다른 운영자가 먼저 연결했을 수 있다. 이름 중복과 같은 409이므로 상세를 다시 확인한다.
      if (error instanceof ApiError && error.status === 409) {
        return queryClient.invalidateQueries({ queryKey: studyKeys.detail(studyId) });
      }
    },
  });
}
