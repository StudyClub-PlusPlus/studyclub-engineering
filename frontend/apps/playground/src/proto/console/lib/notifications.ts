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
 * 이름을 따로 두지 않는다 — 조건이 곧 그 알림이다.
 */
export type NotificationEvent = 'USER_REGISTERED' | 'USER_WITHDRAWN' | 'FEEDBACK_REPLIED';

export const EVENT_LABEL: Record<NotificationEvent, string> = {
  USER_REGISTERED: '회원가입',
  USER_WITHDRAWN: '회원 탈퇴',
  FEEDBACK_REPLIED: '문의 회신',
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
/**
 * 상태 이름. **「발송」을 앞에 붙이지 않는다** — 발송 이력의 상태 칸이라 무엇의 상태인지는
 * 열 이름이 이미 말한다. 짧아야 뱃지 옆에 재발송 아이콘이 설 자리가 남는다.
 *
 * 「완료」는 **보냈다는 뜻**이지 받았다는 뜻이 아니다 (POL-0009).
 */
export const STATUS_LABEL: Record<NotificationStatus, string> = {
  PENDING: '대기',
  PROCESSING: '처리 중',
  SENT: '완료',
  FAILED: '실패',
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
    eventType: seed % 9 === 0 ? 'USER_WITHDRAWN' : seed % 7 === 0 ? 'FEEDBACK_REPLIED' : 'USER_REGISTERED',
    recipientType: 'EMAIL',
    recipientValue: address(seed),
    status,
    sentAt: sent ? sent.toISOString() : null,
  };
  return row;
}).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/**
 * 재발송을 서버에 **맡긴다.** 돌아오는 것은 「접수했다」까지다 — 보냈다는 뜻이 아니다.
 *
 * 프로토는 서버가 없어 지연만 흉내 낸다. 접수 자체가 실패하는 길(네트워크가 끊기거나 서버가
 * 받지 못한 경우)도 보여야 해서, **id 로 정해지는 드문 경우** 하나를 실패로 만든다 — 누를 때마다
 * 달라지면 그 화면을 다시 띄울 수 없다.
 *
 * TODO(api): POST /api/admin/notifications/resend
 */
export function requestResend(ids: number[]): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => (hash(`ack-${ids[0]}`) % 7 === 0 ? reject(new Error('unreachable')) : resolve()), 700);
  });
}

/** 재발송의 끝. 보냈는지 못 보냈는지, 아니면 끝내 알 수 없었는지. */
export type ResendOutcome = { settled: Map<number, 'SENT' | 'FAILED'>; abandoned: number[] };

/**
 * 접수된 건의 **최종 상태**를 쫓는다.
 *
 * 접수는 보냈다는 뜻이 아니라, 완료·실패가 확인될 때까지 따로 쫓아야 한다. 쫓는 방식과 주기,
 * 언제 포기하는지는 서버가 붙을 때 정한다 — 화면은 **끝을 알게 되는 시점**만 알면 된다.
 *
 * 포기한 건은 `abandoned` 로 돌아온다. 그 건에는 아무 말도 하지 않는다 — 못 쫓았다는 사정은
 * 운영자가 할 일을 바꾸지 않고, 화면이 지어낸 결과를 적으면 틀린 말이 된다.
 */
export function trackResend(ids: number[], rows: NotificationRow[]): Promise<ResendOutcome> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const settled = new Map<number, 'SENT' | 'FAILED'>();
      const abandoned: number[] = [];
      for (const id of ids) {
        const row = rows.find((r) => r.id === id);
        const seed = hash(`settle-${row?.recipientValue ?? id}-${id}`);
        if (seed % 23 === 0) abandoned.push(id);
        else settled.set(id, seed % 4 === 0 ? 'FAILED' : 'SENT');
      }
      resolve({ settled, abandoned });
    }, 1800);
  });
}

/** 지금 거른 조건에 걸린 **실패 건 전체**. 보고 있는 페이지에 한정하지 않는다. */
export function failedIds(
  eventType: 'all' | NotificationEvent,
  rows: NotificationRow[] = notifications,
): number[] {
  return rows.filter((n) => n.status === 'FAILED' && (eventType === 'all' || n.eventType === eventType)).map((n) => n.id);
}

/**
 * 한 페이지. 서버가 `items` 와 `total` 을 주는 모양을 그대로 흉내 낸다.
 *
 * `keep` 은 **이번 화면에서 다시 보낸 건**이다. 상태가 바뀌어 거르는 조건에서 벗어나도 그 자리에
 * 남긴다 — 누르자마자 행이 사라지면 방금 무엇을 눌렀는지, 그래서 어떻게 됐는지 볼 수 없다.
 * 다음에 다시 읽을 때 빠진다.
 */
export function queryNotifications(
  status: 'all' | NotificationStatus,
  eventType: 'all' | NotificationEvent,
  offset: number,
  rows: NotificationRow[] = notifications,
  keep: ReadonlySet<number> = new Set(),
) {
  const matched = rows.filter(
    (n) =>
      (status === 'all' || n.status === status || keep.has(n.id)) &&
      (eventType === 'all' || n.eventType === eventType),
  );
  return { items: matched.slice(offset, offset + PAGE_SIZE), total: matched.length };
}
