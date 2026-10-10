/**
 * 알림 템플릿 (프로토 mock).
 *
 * **문구를 보는 화면이다.** 고치는 길은 두지 않는다 — 편집 API 가 없고, 지금 등록된 문구는
 * 마이그레이션이 넣은 한 건뿐이다.
 *
 * TODO(api): GET /api/admin/notification-templates
 */

export type NotificationTemplate = {
  id: number;
  eventType: 'USER_REGISTERED';
  channel: 'EMAIL';
  subject: string;
  body: string;
  updatedAt: string | null;
};

export const TEMPLATE_EVENT_LABEL: Record<string, string> = { USER_REGISTERED: '가입 환영' };
export const TEMPLATE_CHANNEL_LABEL: Record<string, string> = { EMAIL: '메일', DISCORD: '디스코드' };

export const templates: NotificationTemplate[] = [
  {
    id: 1,
    eventType: 'USER_REGISTERED',
    channel: 'EMAIL',
    subject: 'StudyClub++에 오신 걸 환영합니다',
    body: `안녕하세요, {{nickname}}님.

StudyClub++ 회원가입이 완료되었습니다.
가입을 환영합니다!

StudyClub++ 바로가기

이 메일은 회원님의 가입 요청에 따라 가입 완료 사실을 안내하기 위해 발송되었습니다.

직접 가입하지 않으셨거나 계정 관련 문의가 있다면 contact@studyclub-plusplus.com으로 연락해 주세요.

감사합니다.
StudyClub++ 드림`,
    updatedAt: null,
  },
];
