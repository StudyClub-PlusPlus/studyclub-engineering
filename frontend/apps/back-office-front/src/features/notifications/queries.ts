import { useCallback, useRef, useState } from 'react';

import { toast } from '@studyclub/ui';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';

import { chunk, collectFailedIds, fetchByIds, isUnauthorized, postResend, trackUntilSettled } from './repository';
import { RESEND_REQUEST_FAILED, resendResultMessage } from '@/features/notifications/labels';
import { notifications } from '@/features/notifications/repository';
import { showRetryToast } from '@/features/notifications/retry-toast';
import {
  NOTIFICATION_MAX_LIMIT,
  type ApiNotification,
  type ApiNotificationPage,
  type NotificationFilter,
} from '@/features/notifications/types';

export { RESEND_GIVE_UP_MS, RESEND_POLL_MS } from './repository';
// 백오피스 알림 발송 이력·재발송 — 키·fetcher·훅을 한 파일에 둔다.

/** 키는 넓은 것에서 좁은 것으로 쌓는다 — `['notifications']` 를 무효화하면 목록이 전부 딸려 간다. */
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filter: NotificationFilter) => [...notificationKeys.all, 'list', filter] as const,
};

/** 목록 요청 경로. 값이 없는 조건은 넣지 않는다 — 「전체」일 때 상태 조건을 서버에 보내지 않는다. */

export function useNotifications(filter: NotificationFilter, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: notificationKeys.list(filter),
    queryFn: () => notifications(filter),
    enabled: options.enabled ?? true,
    // 같은 조건을 연달아 불러도 마지막 응답만 반영된다(react-query 가 앞선 요청의 결과를 버린다).
    // 조건·페이지를 바꾸는 동안 이전 결과를 지우지 않는다 — 표가 깜빡이면 보던 자리를 잃는다.
    placeholderData: keepPreviousData,
  });
}

/**
 * 실패 건 재발송.
 *
 * 1. 서버가 **접수**하면 그 줄이 「대기」로 바뀐다(미리 바꾸지 않는다 — 닿지 못했을 때 보낸 적 없는 건이 보낸 것처럼 남는다).
 * 2. 접수는 보냈다는 뜻이 아니므로 끝(완료·실패)을 따로 쫓고, **끝난 뒤 토스트로 한 번만** 알린다.
 * 3. 쫓는 동안 그 줄의 아이콘은 돌고 눌리지 않는다 — 두 번 눌러 두 번 나가지 않게.
 * 4. 요청이 닿지 못하면 한 건도 나가지 않은 것이다 — 상태는 그대로 두고 아이콘을 되살리며, 토스트에 「다시 시도」를 띄운다.
 *    묶음이면 나가지 못한 줄만 다시 보낸다. 로그인이 풀렸으면(401) 다시 시도해도 같으니 안내하지 않고 로그인 화면으로 보낸다.
 * 5. 끝을 끝내 알 수 없으면 아무 말도 하지 않는다. 지어낸 결과를 적으면 틀린 말이 된다.
 * 6. **거르는 조건에서 벗어난 줄을 그 자리에서 치우지 않는다.** 목록을 다시 읽지 않고 캐시의 그 줄만 바꾼다 —
 *    「실패」로 거른 목록에서 누르자마자 줄이 사라지면 방금 무엇을 눌렀는지, 어떻게 됐는지 볼 수 없다. 대신 그 캐시를
 *    **오래된 것으로 표시**해 둔다(`staleTime` 동안은 새로 읽지 않으므로) — 다음에 필터·페이지를 바꿔 읽을 때는 서버에서
 *    다시 읽어 조건대로 빠진다.
 *
 * 쫓는 일은 화면을 떠나도 포기 시점까지 이어진다 — 토스트와 캐시 갱신은 화면과 무관하게 전역이다.
 */
export function useNotificationResend() {
  const queryClient = useQueryClient();
  // 같은 틱의 중복 클릭을 막으려고 ref 로 먼저 센다. 화면에 그리는 state 는 거기서 복사한다.
  const inFlight = useRef(new Set<number>());
  const [resending, setResending] = useState<ReadonlySet<number>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // 「다시 시도」가 자기 자신을 다시 부를 수 있게 — 토스트가 뜬 시점의 함수가 아니라 늘 최신 것을 쓴다
  const runRef = useRef<(ids: number[]) => Promise<void>>(async () => {});
  const allRef = useRef<(eventType?: string) => Promise<void>>(async () => {});

  const publish = () => setResending(new Set(inFlight.current));
  const release = (ids: number[]) => {
    ids.forEach((id) => inFlight.current.delete(id));
    publish();
  };

  /**
   * 캐시에 든 모든 목록에서 줄을 바꾼다. 다시 읽지 않는다 — 조건에서 벗어난 줄도 그 자리에 남는다.
   * `setQueriesData` 는 갱신 시각을 지금으로 돌려 캐시를 「방금 읽은 신선한 것」으로 만든다. 그대로 두면 `staleTime` 동안
   * 필터를 바꿨다 돌아와도 서버를 다시 읽지 않아 완료된 줄이 「실패」 목록에 남으므로, 바로 오래된 것으로 표시한다
   * (`refetchType: 'none'` — 지금 보는 화면은 다시 읽지 않는다).
   */
  const patchRows = (replace: (row: ApiNotification) => ApiNotification) => {
    queryClient.setQueriesData<ApiNotificationPage>({ queryKey: notificationKeys.all }, (page) =>
      page ? { ...page, items: page.items.map(replace) } : page,
    );
    void queryClient.invalidateQueries({ queryKey: notificationKeys.all, refetchType: 'none' });
  };
  /** 서버가 지금 말하는 모습으로 그 줄들을 맞춘다. */
  const adopt = (rows: ApiNotification[]) => {
    const truth = new Map(rows.map((row) => [row.id, row]));
    patchRows((row) => truth.get(row.id) ?? row);
  };

  const run = useCallback(
    async (requested: number[]) => {
      const ids = [...new Set(requested)].filter((id) => !inFlight.current.has(id));
      if (ids.length === 0) return;
      ids.forEach((id) => inFlight.current.add(id));
      publish();

      const accepted: number[] = [];
      const skipped: number[] = [];
      let unsent: number[] = []; // 요청이 닿지 못해 나가지 않은 줄
      let expired = false; // 로그인이 풀렸다 — 다시 시도해도 같다
      const parts = chunk(ids, NOTIFICATION_MAX_LIMIT);
      for (let i = 0; i < parts.length; i++) {
        try {
          const result = await postResend(parts[i]!);
          accepted.push(...result.accepted);
          skipped.push(...result.skipped.map((s) => s.id));
        } catch (error) {
          if (isUnauthorized(error)) expired = true;
          else unsent = parts.slice(i).flat();
          break;
        }
      }
      // 접수되지 않은 줄(건너뜀·요청 실패·로그인 만료)은 바로 되살린다
      release(ids.filter((id) => !accepted.includes(id)));

      if (unsent.length > 0) showRetryToast(RESEND_REQUEST_FAILED, () => void runRef.current(unsent));
      if (skipped.length > 0) {
        // 건너뛴 줄은 화면이 알던 것과 서버의 지금이 다르다(다른 캡틴이 먼저 보냈다 등) — 서버의 모습으로 맞춘다
        try {
          adopt(await fetchByIds(skipped));
        } catch {
          // 못 읽어도 다음에 읽을 때 맞춰진다
        }
      }
      if (accepted.length === 0) {
        if (unsent.length === 0 && !expired) toast('다시 보낼 수 있는 건이 없어 아무것도 보내지 않았습니다.');
        return;
      }

      // 접수된 줄이 「대기」로 바뀐다 — 그 자리에서
      const acceptedSet = new Set(accepted);
      patchRows((row) =>
        acceptedSet.has(row.id) ? { ...row, status: 'PENDING', sentAt: null, canResend: false } : row,
      );
      const rows = await trackUntilSettled(accepted);
      if (rows) adopt(rows); // 끝난 모습(완료·실패, 다시 실패했으면 아이콘도 되살아난다)
      release(accepted);
      if (!rows) return; // 끝을 끝내 알 수 없다 — 아무 말도 하지 않는다. 줄은 「대기」로 남는다

      const succeeded = rows.filter((r) => r.status === 'SENT').length;
      toast(resendResultMessage({ bulk: ids.length > 1, succeeded, failed: rows.length - succeeded }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- publish·release·patchRows·adopt 는 ref 와 queryClient 만 쓴다
    [queryClient],
  );
  runRef.current = run;

  /** 한 줄 재발송 — 묻지 않는다. 누른 그 줄에서 무엇이 나가는지가 이미 보인다. */
  const resendOne = useCallback((id: number) => run([id]), [run]);

  /**
   * 실패만 거른 목록의 **거른 전체**를 다시 보낸다 — 보고 있는 페이지의 20건이 아니다. 서버는 조건을 받지 않으므로
   * 같은 조건으로 목록을 100건씩 읽어 ID 를 모은 뒤 `ids` 로 요청한다([collectFailedIds]).
   */
  const resendAllFailed = useCallback(
    async (eventType?: string) => {
      setBulkBusy(true);
      try {
        await run(await collectFailedIds(eventType));
      } catch (error) {
        // ID 를 모으지 못했다 — 한 건도 나가지 않았다. 로그인이 풀린 것이 아니면 같은 조건으로 처음부터 다시 모은다
        if (!isUnauthorized(error)) showRetryToast(RESEND_REQUEST_FAILED, () => void allRef.current(eventType));
      } finally {
        setBulkBusy(false);
      }
    },
    [run],
  );
  allRef.current = resendAllFailed;

  return { resending, bulkBusy, resendOne, resendAllFailed };
}

export { notificationsPath, RESEND_REQUEST_TIMEOUT_MS } from './repository';
