// 백오피스 알림 발송 이력·재발송 API 목 — specs/notification/spec.md 의 응답 모양 그대로.
//
// 서버가 하는 일(필터·정렬·페이지·total·수신 주소 마스킹·canResend 판정·재발송 접수)을 목에서도 같은 순서로 흉내 낸다.
// 재발송하면 그 줄이 PENDING 이 됐다가 잠시 뒤 SENT 로 넘어간다 — 화면이 「끝 추적」을 목에서도 보게 하려는 것이다.
// 이메일은 example.com 만 쓴다 — 실제 개인정보를 넣지 않는다.
import { HttpResponse } from 'msw';

import { mockClient, type MockResolveContext } from '../utils';

export type ApiNotificationStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED';

export type ApiNotification = {
  id: number;
  eventType: string;
  recipientType: string;
  /** 서버가 가린 값. 전체 주소는 내려오지 않는다. */
  recipientValue: string;
  status: ApiNotificationStatus;
  templateId: number;
  sentAt: string | null;
  createdAt: string;
  /** 서버가 판정한다 — 화면은 이 값을 그린다. */
  canResend: boolean;
};

export type ApiNotificationPage = {
  items: ApiNotification[];
  total: number;
  offset: number;
  limit: number;
};

export type ApiNotificationResend = {
  accepted: number[];
  skipped: { id: number; reason: 'NOT_FAILED' | 'RECIPIENT_GONE' }[];
};

const MAX_LIMIT = 100;
/** 재발송을 접수한 줄이 PENDING 에서 끝(SENT)으로 넘어가기까지 — 목의 흉내. */
const RESEND_SETTLE_MS = 1500;

/** 서버가 DB 에서 읽는 값. canResend 는 응답을 만들 때 계산한다. */
type MockRecord = Omit<ApiNotification, 'canResend'> & {
  /** 수신 회원이 탈퇴했는가 — 주소가 지워져 보낼 수 없다. */
  recipientGone: boolean;
  resentAt: number | null;
};

const EMAILS = ['h***@example.com', 'j***@example.com', 'm***@example.com', 's***@example.com', 'd***@example.com'];

function seed(): MockRecord[] {
  const base = Date.UTC(2026, 9, 15, 9, 0);
  return Array.from({ length: 47 }, (_, i) => {
    const id = 500 - i;
    const createdAt = new Date(base - i * 3_600_000).toISOString();
    // 최근 두 건은 진행 중, 일부는 실패(그중 하나는 탈퇴한 회원), 나머지는 완료
    const failed = i === 2 || i === 3 || i === 9 || i === 17 || i === 30 || i === 41;
    const status: ApiNotificationStatus = i === 0 ? 'PENDING' : i === 1 ? 'PROCESSING' : failed ? 'FAILED' : 'SENT';
    return {
      id,
      eventType: 'USER_REGISTERED',
      recipientType: 'EMAIL',
      recipientValue: EMAILS[i % EMAILS.length]!,
      status,
      templateId: 1,
      createdAt,
      sentAt: status === 'SENT' ? new Date(Date.parse(createdAt) + 4_000).toISOString() : null,
      recipientGone: i === 17,
      resentAt: null,
    };
  });
}

let records = seed();

/** 테스트·스토리에서 처음 상태로 되돌린다. */
export function resetMockNotifications() {
  records = seed();
}

/** 재발송한 지 충분히 지났으면 끝난 것으로 본다. */
function settle(now = Date.now()) {
  for (const r of records) {
    if (r.status === 'PENDING' && r.resentAt !== null && now - r.resentAt >= RESEND_SETTLE_MS) {
      r.status = 'SENT';
      r.sentAt = new Date(now).toISOString();
    }
  }
}

function toApi(r: MockRecord): ApiNotification {
  const { recipientGone: _gone, resentAt: _at, ...rest } = r;
  return { ...rest, canResend: r.status === 'FAILED' && !r.recipientGone };
}

const invalidInput = () => HttpResponse.json({ errorCode: 'INVALID_INPUT', errorMessage: '입력값이 올바르지 않습니다.' }, { status: 400 });
const forbidden = () => HttpResponse.json({ errorCode: 'FORBIDDEN', errorMessage: '권한이 없습니다.' }, { status: 403 });
const serverError = () =>
  HttpResponse.json({ errorCode: 'INTERNAL_ERROR', errorMessage: '서버 오류가 발생했습니다.' }, { status: 500 });

function listNotifications({ request }: MockResolveContext) {
  settle();
  const url = new URL(request.url);
  const eventType = url.searchParams.get('eventType');
  const status = url.searchParams.get('status');
  const idsParam = url.searchParams.get('ids');
  const offset = Number(url.searchParams.get('offset') ?? 0);
  const limit = Number(url.searchParams.get('limit') ?? 20);

  if (!Number.isInteger(offset) || !Number.isInteger(limit) || offset < 0 || limit < 1 || limit > MAX_LIMIT) {
    return invalidInput();
  }

  // ids 가 있으면 그 줄들만 offset·limit·필터와 상관없이 준다 — 재발송한 건의 끝을 쫓는 용도
  if (idsParam) {
    const ids = idsParam.split(',').map(Number);
    if (ids.length > MAX_LIMIT || ids.some((n) => !Number.isInteger(n))) return invalidInput();
    const items = records.filter((r) => ids.includes(r.id)).map(toApi);
    return { items, total: items.length, offset: 0, limit: Math.max(1, items.length) } satisfies ApiNotificationPage;
  }

  const matched = records
    .filter((r) => (!eventType || r.eventType === eventType) && (!status || r.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id);
  return {
    items: matched.slice(offset, offset + limit).map(toApi),
    total: matched.length,
    offset,
    limit,
  } satisfies ApiNotificationPage;
}

async function resendNotifications({ request }: MockResolveContext) {
  settle();
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? (body.ids as unknown[]) : null;
  if (!ids || ids.length < 1 || ids.length > MAX_LIMIT || ids.some((n) => !Number.isInteger(n))) return invalidInput();

  const unique = [...new Set(ids as number[])].sort((a, b) => a - b);
  const rows = unique.map((id) => records.find((r) => r.id === id));
  // 없는 ID 가 하나라도 있으면 아무것도 바꾸지 않고 404
  if (rows.some((r) => !r)) {
    return HttpResponse.json({ errorCode: 'NOT_FOUND', errorMessage: '발송 이력을 찾을 수 없습니다.' }, { status: 404 });
  }

  const result: ApiNotificationResend = { accepted: [], skipped: [] };
  for (const row of rows as MockRecord[]) {
    if (row.status !== 'FAILED') result.skipped.push({ id: row.id, reason: 'NOT_FAILED' });
    else if (row.recipientGone) result.skipped.push({ id: row.id, reason: 'RECIPIENT_GONE' });
    else {
      row.status = 'PENDING';
      row.resentAt = Date.now();
      result.accepted.push(row.id);
    }
  }
  return HttpResponse.json(result, { status: 202 });
}

export const notificationsHandlers = mockClient.createHandlerGroup('/api/admin/notifications', [
  {
    method: 'GET',
    path: '/',
    presets: [
      { label: '정상', status: 200, response: listNotifications },
      {
        label: '이력 없음',
        status: 200,
        response: { items: [], total: 0, offset: 0, limit: 20 } satisfies ApiNotificationPage,
      },
      { label: '500 서버 오류', status: 500, response: serverError },
      { label: '403 캡틴 아님', status: 403, response: forbidden },
    ],
  },
  {
    method: 'POST',
    path: '/resend',
    presets: [
      { label: '접수', status: 202, response: resendNotifications },
      { label: '500 서버 오류', status: 500, response: serverError },
      { label: '403 캡틴 아님', status: 403, response: forbidden },
    ],
  },
]);
