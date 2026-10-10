/**
 * 알림 발송 이력 (프로토 mock).
 *
 * 가입 환영 메일이 **어느 주소로 나갔고 지금 어떤 상태인가**만 본다. 재발송·취소는 없다 —
 * API 가 지원하지 않는다.
 *
 * TODO(api): GET /api/admin/notifications — status · eventType · offset · limit
 */

/** 발송 상태. 서버가 정의한 값 그대로 쓴다. */
export type NotificationStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';

export type NotificationRow = {
  /** 화면에 내보내지 않는다 — key 로만 쓴다 */
  id: number;
  createdAt: string;
  eventType: 'USER_REGISTERED';
  recipientType: 'EMAIL';
  /** **서버가 마스킹한 값**. 화면에서 가공하지 않는다 */
  recipientValue: string;
  status: NotificationStatus;
  /** 없으면 아직 안 나갔다는 뜻 */
  sentAt: string | null;
};

export const PAGE_SIZE = 20;

/** 상태 문구와 색. **색만으로 가르지 않는다** — 문구를 늘 함께 적는다. */
export const STATUS_LABEL: Record<NotificationStatus, string> = {
  PENDING: '발송 대기',
  PROCESSING: '발송 중',
  SENT: '발송 완료',
  FAILED: '발송 실패',
};

export const STATUS_TONE: Record<NotificationStatus, 'neutral' | 'inprogress' | 'recruiting' | 'error'> = {
  PENDING: 'neutral',
  PROCESSING: 'inprogress',
  SENT: 'recruiting',
  FAILED: 'error',
};

export const STATUS_FILTERS: { value: 'all' | NotificationStatus; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'PENDING', label: STATUS_LABEL.PENDING },
  { value: 'PROCESSING', label: STATUS_LABEL.PROCESSING },
  { value: 'SENT', label: STATUS_LABEL.SENT },
  { value: 'FAILED', label: STATUS_LABEL.FAILED },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const NAMES = ['hong', 'jiwon', 'minsu', 'sora', 'daniel', 'yuna', 'kevin', 'haeun', 'junho', 'mia'];
const DOMAINS = ['gmail.com', 'naver.com', 'outlook.com', 'kakao.com'];

/** 서버가 내려주는 모양 그대로 — 가운데를 가린 주소. */
function masked(seed: number): string {
  const name = NAMES[seed % NAMES.length];
  return `${name.slice(0, 1)}***@${DOMAINS[seed % DOMAINS.length]}`;
}

/** 128건. **요청 시각 내림차순 고정** — 최근 것이 위다. */
export const notifications: NotificationRow[] = Array.from({ length: 128 }, (_, i) => {
  const seed = hash(`notification-${i}`);
  const created = new Date(Date.UTC(2026, 9, 10, 9, 0) - i * 3_600_000 * (1 + (seed % 5)));
  // 대부분 나갔고, 최근 것 몇 건만 처리 중이거나 실패다 — 운영자가 볼 것이 있어야 화면이 설명된다
  const status: NotificationStatus = i === 0 ? 'PROCESSING' : i === 1 ? 'PENDING' : seed % 17 === 0 ? 'FAILED' : 'SENT';
  const sent = status === 'SENT' ? new Date(created.getTime() + 5_000 + (seed % 60) * 1000) : null;
  const row: NotificationRow = {
    id: 1000 - i,
    createdAt: created.toISOString(),
    eventType: 'USER_REGISTERED',
    recipientType: 'EMAIL',
    recipientValue: masked(seed),
    status,
    sentAt: sent ? sent.toISOString() : null,
  };
  return row;
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** 한 페이지. 서버가 `items` 와 `total` 을 주는 모양을 그대로 흉내 낸다. */
export function queryNotifications(status: 'all' | NotificationStatus, offset: number) {
  const matched = status === 'all' ? notifications : notifications.filter((n) => n.status === status);
  return { items: matched.slice(offset, offset + PAGE_SIZE), total: matched.length };
}
