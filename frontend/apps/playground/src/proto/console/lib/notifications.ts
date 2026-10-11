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

/**
 * 알림 조건 — **언제 보냈는가.** 템플릿의 조건과 같은 값이다 (POL-0009).
 *
 * 이름을 따로 두지 않는다 — 조건 하나에 템플릿 하나라 조건이 곧 그 알림이다.
 */
export type NotificationEvent = 'USER_REGISTERED' | 'USER_WITHDRAWN';

export const EVENT_LABEL: Record<NotificationEvent, string> = {
  USER_REGISTERED: '회원가입',
  USER_WITHDRAWN: '회원 탈퇴',
};

export type NotificationRow = {
  /** 화면에 내보내지 않는다 — key 로만 쓴다 */
  id: number;
  createdAt: string;
  eventType: NotificationEvent;
  recipientType: 'EMAIL';
  /** 받는 사람 주소. 화면에는 가린 채로 두고, 필요한 줄만 눈 아이콘으로 펼친다 (POL-0007) */
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

/** 알림 종류. 지금은 가입 환영 하나뿐이지만 축은 미리 세운다 — 늘면 여기만 더한다. */
export const EVENT_FILTERS: { value: NotificationEvent; label: string }[] = (
  Object.keys(EVENT_LABEL) as NotificationEvent[]
).map((key) => ({ value: key, label: EVENT_LABEL[key] }));

export const STATUS_FILTERS: { value: NotificationStatus; label: string }[] = [
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

/** 받는 사람 주소. 가리는 일은 화면이 한다 — 여기서는 전체 주소를 그대로 둔다. */
function address(seed: number): string {
  const name = NAMES[seed % NAMES.length];
  return `${name}${(seed % 90) + 10}@${DOMAINS[seed % DOMAINS.length]}`;
}

/** 240건. **요청 시각 내림차순 고정** — 최근 것이 위다. */
export const notifications: NotificationRow[] = Array.from({ length: 240 }, (_, i) => {
  const seed = hash(`notification-${i}`);
  const created = new Date(Date.UTC(2026, 9, 10, 9, 0) - i * 3_600_000 * (1 + (seed % 5)));
  // 대부분 나갔고, 최근 것 몇 건만 처리 중이거나 실패다 — 운영자가 볼 것이 있어야 화면이 설명된다
  const status: NotificationStatus = i === 0 ? 'PROCESSING' : i === 1 ? 'PENDING' : seed % 17 === 0 ? 'FAILED' : 'SENT';
  const sent = status === 'SENT' ? new Date(created.getTime() + 5_000 + (seed % 60) * 1000) : null;
  const row: NotificationRow = {
    id: 2000 - i,
    createdAt: created.toISOString(),
    // 가입이 대부분이고 탈퇴가 가끔 섞인다 — 조건 필터가 무슨 일을 하는지 보이게
    eventType: seed % 9 === 0 ? 'USER_WITHDRAWN' : 'USER_REGISTERED',
    recipientType: 'EMAIL',
    recipientValue: address(seed),
    status,
    sentAt: sent ? sent.toISOString() : null,
  };
  return row;
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/** 한 페이지. 서버가 `items` 와 `total` 을 주는 모양을 그대로 흉내 낸다. */
/**
 * 실패한 건을 다시 보낸다.
 *
 * **실패 건은 그대로 두고 새 건을 만든다** — 지워 버리면 언제 왜 실패했는지가 사라지고,
 * 같은 행을 고쳐 쓰면 한 번에 성공한 건과 두 번 만에 나간 건을 구분할 수 없다.
 * 새 건은 발송 대기로 들어가 다음 차례에 집어간다.
 */
export function resend(rows: NotificationRow[], id: number): NotificationRow[] {
  const target = rows.find((r) => r.id === id);
  if (!target || target.status !== 'FAILED') return rows;
  const again: NotificationRow = {
    ...target,
    id: Math.max(...rows.map((r) => r.id)) + 1,
    createdAt: new Date().toISOString(),
    status: 'PENDING',
    sentAt: null,
  };
  return [again, ...rows];
}

export function queryNotifications(
  status: 'all' | NotificationStatus,
  eventType: 'all' | NotificationEvent,
  offset: number,
  rows: NotificationRow[] = notifications,
) {
  const matched = rows.filter(
    (n) => (status === 'all' || n.status === status) && (eventType === 'all' || n.eventType === eventType),
  );
  return { items: matched.slice(offset, offset + PAGE_SIZE), total: matched.length };
}
