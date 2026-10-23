// 알림 템플릿 타입. 백엔드 NotificationTemplateResponse 와 1:1 이다.
// 조건·채널 이름과 시각 표기는 발송 이력과 같은 규칙이라 `features/notifications/labels.ts` 를 쓴다.

import { eventLabel } from '@/features/notifications/labels';

export type NotificationTemplate = {
  id: number;
  eventType: string;
  channel: string;
  subject: string;
  body: string;
  updatedAt: string | null;
  updatedByAdminId: number | null;
};

/** 추가·수정 요청 바디. 채널은 보내지 않는다 — 지금 보낼 수 있는 것은 메일뿐이라 서버가 정한다. */
export type TemplateDraft = {
  eventType: string;
  subject: string;
  body: string;
};

/**
 * 팝업에서 고를 수 있는 알림 조건 코드. **조건이 곧 그 알림의 이름이다** — 이름을 따로 받지 않는다.
 * 저장되는 이벤트 코드는 이 선택이 정하고, 화면에 적는 이름은 목록과 같은 `eventLabel` 한 곳에서 온다.
 * 백엔드에 이벤트가 있는 조건만 둔다. 회원 탈퇴는 BE 이벤트가 생길 때 코드 한 줄을 더하고 `labels.ts` 에 이름을 단다.
 */
const SELECTABLE_EVENTS = ['USER_REGISTERED'];

export const TEMPLATE_CONDITIONS: { value: string; label: string }[] = SELECTABLE_EVENTS.map((value) => ({
  value,
  label: eventLabel(value),
}));
