// 크루 스터디 신청 — 신청 폼 조회·내 신청 상태 조회·신청서 제출. 키·fetcher·훅을 한곳에. 브라우저가 백엔드를 직접 부른다.
import type { ApiStudyApplicationForm } from '@studyclub/mock/msw';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { http } from '@/lib/http';

export type ApiMyApplication = {
  applied: boolean;
  applicationId: number | null;
  submittedAt: string | null;
};

export type SubmitApplicationPayload = {
  discordNickname: string;
  availableDays: string[];
  scheduleAgreed?: boolean;
  answers: Record<string, string | string[]>;
};

export const applicationKeys = {
  all: ['applications'] as const,
  form: (studyId: number) => [...applicationKeys.all, 'form', studyId] as const,
  my: (studyId: number) => [...applicationKeys.all, 'my', studyId] as const,
};

/**
 * 스터디 신청 폼 조회 (질문, 모집 기한, 확정 일정 등).
 * GET /api/studies/{studyId}/application-form
 */
export function useStudyApplicationForm(studyId: number, enabled = true) {
  return useQuery({
    queryKey: applicationKeys.form(studyId),
    queryFn: () => http<ApiStudyApplicationForm>(`/api/studies/${studyId}/application-form`),
    enabled: enabled && studyId > 0,
    staleTime: 60 * 1000,
    retry: false,
  });
}

/**
 * 내 신청 여부 조회.
 * GET /api/studies/{studyId}/applications/me
 */
export function useMyApplication(studyId: number, enabled = true) {
  return useQuery({
    queryKey: applicationKeys.my(studyId),
    queryFn: () => http<ApiMyApplication>(`/api/studies/${studyId}/applications/me`),
    enabled: enabled && studyId > 0,
    staleTime: 60 * 1000,
    retry: false,
  });
}

/**
 * 스터디 신청서 제출.
 * POST /api/studies/{studyId}/applications
 */
export function useSubmitApplication(studyId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SubmitApplicationPayload) =>
      http<null>(`/api/studies/${studyId}/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      // 신청 완료 시 내 신청 여부 캐시를 즉시 '신청 완료' 상태로 반영
      queryClient.setQueryData<ApiMyApplication>(applicationKeys.my(studyId), {
        applied: true,
        applicationId: 1,
        submittedAt: new Date().toISOString(),
      });
    },
  });
}
