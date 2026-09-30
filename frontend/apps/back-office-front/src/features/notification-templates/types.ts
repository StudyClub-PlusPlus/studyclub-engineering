// 알림 템플릿 타입·표시 이름. 백엔드 NotificationTemplateResponse 와 1:1 이다.

export type NotificationTemplate = {
  id: number;
  eventType: string;
  channel: string;
  subject: string;
  body: string;
  updatedAt: string | null;
  updatedByAdminId: number | null;
};

/** 이벤트 코드 → 사람이 읽는 이름. 모르는 코드는 코드 그대로 보여준다(빈칸보다 낫다). */
export const EVENT_LABEL: Record<string, string> = {
  USER_REGISTERED: '가입 환영',
};

export const CHANNEL_LABEL: Record<string, string> = {
  EMAIL: '메일',
  DISCORD: '디스코드',
};

export function fmtDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}
