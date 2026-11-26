// 백오피스 알림 발송 이력·재발송 타입. 응답 모양은 specs/notification/spec.md 와 1:1 이다.
//
// 값은 서버 enum 그대로 받는다. 화면 문구로 바꾸는 일은 labels.ts 한 곳에서 한다.

/** 서버가 정의한 발송 상태. 화면이 모르는 값(예: 탈퇴로 취소된 `CANCELLED`)이 와도 깨지지 않게 `string` 으로 받는다. */
export type ApiNotificationStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | (string & {});

export type ApiNotification = {
  id: number;
  /** 알림이 나가는 조건 — 코드 그대로 오고, 화면은 라벨로 바꿔 적는다. */
  eventType: string;
  recipientType: string;
  /** **서버가 가린 값.** 전체 주소는 내려오지 않으며 화면에서 펼치는 길도 없다. */
  recipientValue: string;
  status: ApiNotificationStatus;
  /** 받되 화면에 쓰지 않는다. */
  templateId: number;
  /** 아직 안 나갔으면 null. `SENT` 인데 비어 있어도 오류로 다루지 않는다. */
  sentAt: string | null;
  createdAt: string;
  /** 서버가 판정한 「지금 다시 보낼 수 있는가」 — 화면이 `status` 로 다시 계산하지 않는다. */
  canResend: boolean;
};

export type ApiNotificationPage = {
  items: ApiNotification[];
  /** 조건에 걸린 **전체** 건수 — 보이는 한 페이지가 아니다. */
  total: number;
  offset: number;
  limit: number;
};

/** 재발송을 접수하지 못한 이유. 오류가 아니라 응답의 `skipped[].reason` 으로 온다. */
export type ResendSkipReason = 'NOT_FAILED' | 'RECIPIENT_GONE';

export type ApiNotificationResend = {
  /** 다시 `PENDING` 으로 되돌려 접수한 줄 — 끝을 쫓을 때 `?ids=` 에 그대로 넘긴다. */
  accepted: number[];
  skipped: { id: number; reason: ResendSkipReason }[];
};

/** 목록 조건. 비우면 그 조건을 걸지 않는다. 쿼리 키에 그대로 들어간다. */
export type NotificationFilter = {
  eventType?: string;
  status?: ApiNotificationStatus;
  offset: number;
  limit: number;
};

/** 한 페이지 20건 고정(기획). */
export const NOTIFICATION_PAGE_SIZE = 20;

/** 서버가 한 번에 주는 최대 건수이자 재발송 요청의 `ids` 상한. */
export const NOTIFICATION_MAX_LIMIT = 100;
