// 백오피스 푸시 보내기 (specs/web-push/spec.md). 보낸 결과는 발송 이력 탭에서 본다.
import { toast } from '@studyclub/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { notificationKeys } from '@/features/notifications/queries';
import { ApiError, http } from '@/lib/http';
import { handleUnauthorized } from '@/lib/query-client';

const statusSchema = z.object({
  enabled: z.boolean(),
  subscriptions: z.number(),
  accounts: z.number(),
  mySubscriptions: z.number(),
});
const sendSchema = z.object({ queued: z.number() });

export type PushAudience = 'SELF' | 'ALL';
export type PushDraft = { audience: PushAudience; title: string; body: string; url: string };

/** 서버 검증과 같은 한도. 넘으면 버튼을 잠근다 */
export const TITLE_MAX = 60;
export const BODY_MAX = 200;

const webPushKeys = { status: ['web-push', 'status'] as const };

export function useWebPushStatus() {
  return useQuery({
    queryKey: webPushKeys.status,
    queryFn: () =>
      http('/api/admin/web-push', statusSchema).catch((error: unknown) => {
        if (error instanceof Error) handleUnauthorized(error);
        throw error;
      }),
  });
}

export function useSendPush() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draft: PushDraft) =>
      http('/api/admin/web-push/send', sendSchema, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, url: draft.url.trim() || null }),
      }),
    onSuccess: ({ queued }) => {
      toast.success(`${queued}건을 보냈습니다. 30초 안에 도착합니다. 결과는 발송 이력에서 볼 수 있습니다.`);
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
    onError: (error) => {
      if (error instanceof Error) handleUnauthorized(error);
      toast.error(error instanceof ApiError ? error.message : '보내지 못했습니다. 다시 시도해 주세요.');
    },
  });
}
