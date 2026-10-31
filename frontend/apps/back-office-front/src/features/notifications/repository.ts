import { z } from 'zod';

import { apiNotificationResendSchema } from './response-schema';
import {
  NOTIFICATION_MAX_LIMIT,
  type ApiNotification,
  type ApiNotificationPage,
  type ApiNotificationResend,
} from './types';
import { apiNotificationPageSchema } from '@/features/notifications/response-schema';
import { type NotificationFilter } from '@/features/notifications/types';
import { ApiError } from '@/lib/http';
import { http, qs } from '@/lib/http';
import { handleUnauthorized } from '@/lib/query-client';

export function notificationsPath(filter: NotificationFilter): string {
  return `/api/admin/notifications${qs({
    eventType: filter.eventType,
    status: filter.status,
    offset: filter.offset,
    limit: filter.limit,
  })}`;
}

export async function call<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
  timeoutMs = RESEND_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await http(path, schema, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error) handleUnauthorized(error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const RESEND_REQUEST_TIMEOUT_MS = 15_000;

export function notifications(filter: NotificationFilter) {
  return http(notificationsPath(filter), apiNotificationPageSchema);
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** 재발송 접수 폴링 — 접수는 보냈다는 뜻이 아니라서 끝(`SENT`·`FAILED`)을 따로 쫓는다. 주기·포기 시점은 개발이 정한다. */
export const RESEND_POLL_MS = 2_000;
export const RESEND_GIVE_UP_MS = 2 * 60_000;
/** 요청 하나가 기다리는 최대 시간. 넘기면 끊고 실패로 본다 — 응답이 안 오는 요청이 로딩 표시를 붙잡지 않게. */

/** 「거른 전체」의 ID 를 모을 때 처음부터 다시 훑는 최대 횟수. */
const COLLECT_MAX_PASSES = 5;

export function chunk<T>(items: T[], size: number): T[][] {
  const parts: T[][] = [];
  for (let i = 0; i < items.length; i += size) parts.push(items.slice(i, i + size));
  return parts;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const isUnauthorized = (error: unknown) => error instanceof ApiError && error.status === 401;

/**
 * 재발송 흐름이 서버를 부르는 단 하나의 길. 두 가지를 여기서 한다.
 *
 * - **제한 시간**: 응답이 안 오면 끊는다. 끊긴 요청은 실패와 같게 다룬다.
 * - **로그인 만료(401)**: 앱 공통 처리(세션 정리 · 로그인 화면)로 보낸다. 이 흐름은 react-query 를 거치지 않아서
 *   `QueryCache`/`MutationCache` 의 공통 처리가 닿지 않는다.
 */

export function postResend(ids: number[]): Promise<ApiNotificationResend> {
  return call('/api/admin/notifications/resend', apiNotificationResendSchema, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ ids }),
  });
}

/** 줄이 끝났는가 — 대기·처리 중이 아니면 끝(완료·실패·그 밖의 상태)이다. */
const isSettled = (row: ApiNotification) => row.status !== 'PENDING' && row.status !== 'PROCESSING';

/** `deadline` 이 있으면 요청마다 남은 시간 안에서만 기다린다. */
export async function fetchByIds(ids: number[], deadline?: number): Promise<ApiNotification[]> {
  const rows: ApiNotification[] = [];
  for (const part of chunk(ids, NOTIFICATION_MAX_LIMIT)) {
    const timeout =
      deadline === undefined
        ? RESEND_REQUEST_TIMEOUT_MS
        : Math.max(1, Math.min(RESEND_REQUEST_TIMEOUT_MS, deadline - Date.now()));
    const page = await call(
      `/api/admin/notifications${qs({ ids: part.join(',') })}`,
      apiNotificationPageSchema,
      {},
      timeout,
    );
    rows.push(...page.items);
  }
  return rows;
}

/**
 * 접수한 줄이 모두 끝날 때까지 쫓는다. 끝났으면 그 줄들을, 포기 시점까지 끝내 모르면 `null` 을 돌려준다.
 *
 * - 한 번 못 읽었다고 멈추지 않는다 — 다음 주기에 다시 읽는다. 요청 하나가 걸려도 **포기 시점을 넘겨 기다리지 않는다**
 *   (요청마다 남은 시간 안에서만 기다리고, 넘기면 끊는다).
 * - 로그인이 풀렸으면(401) 더 쫓지 않는다. 같은 401 이 2분 동안 반복될 뿐이다.
 */
export async function trackUntilSettled(ids: number[]): Promise<ApiNotification[] | null> {
  const deadline = Date.now() + RESEND_GIVE_UP_MS;
  while (Date.now() < deadline) {
    await sleep(RESEND_POLL_MS);
    if (Date.now() >= deadline) break;
    try {
      const rows = await fetchByIds(ids, deadline);
      if (rows.length === ids.length && rows.every(isSettled)) return rows;
    } catch (error) {
      if (isUnauthorized(error)) return null;
      // 그 밖의 오류는 다음 주기에 다시
    }
  }
  return null;
}

/**
 * 실패만 거른 목록의 **거른 전체**에서 다시 보낼 수 있는 줄의 ID 를 모은다.
 *
 * 서버가 조건을 받지 않아 목록을 100건씩 읽어 모으는데, 읽는 사이 **다른 운영자가 재발송하면 그 줄들이 목록에서 빠져**
 * 뒤쪽이 앞으로 당겨진다. 한 번 훑고 끝내면 `offset` 이 어긋나 당겨진 줄을 못 읽고 건너뛴다. 그래서 중복을 없애며 모으고,
 * **새 ID 가 더 나오지 않을 때까지 처음부터 다시 훑는다.** 한 번에 읽힌 한 페이지는 서로 어긋날 수 없으므로
 * 페이지가 하나뿐이면 다시 훑지 않는다.
 */
export async function collectFailedIds(eventType?: string): Promise<number[]> {
  const ids = new Set<number>();
  for (let pass = 0; pass < COLLECT_MAX_PASSES; pass++) {
    const before = ids.size;
    let pages = 0;
    for (let offset = 0, total = 1; offset < total;) {
      const page = await call<ApiNotificationPage>(
        notificationsPath({ eventType, status: 'FAILED', offset, limit: NOTIFICATION_MAX_LIMIT }),
        apiNotificationPageSchema,
      );
      pages += 1;
      for (const row of page.items) if (row.canResend) ids.add(row.id);
      if (page.items.length === 0) break;
      total = page.total;
      offset += page.limit;
    }
    if (pages === 1 || ids.size === before) break; // 하나뿐인 페이지는 어긋날 수 없다 · 이번 훑기에 새로 나온 것이 없다
  }
  return [...ids];
}
