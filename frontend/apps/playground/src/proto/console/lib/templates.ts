/**
 * 알림 템플릿 (프로토 mock).
 *
 * 문구를 보고·더하고·고치고·지운다. 회원가입과 문의 회신은 메일 시안 HTML을 함께 쓴다.
 *
 * TODO(api): GET·POST /api/admin/notification-templates · PUT·DELETE /api/admin/notification-templates/{id}
 */

/**
 * 발송 조건 — **언제 보내는가.**
 *
 * 알림은 이름이 아니라 이 값으로 나간다. 조건이 없는 템플릿은 보낼 계기가 없어 영영 발송되지 않는다.
 * 운영자는 조건을 고르고, 저장되는 코드는 그 선택이 정한다 — 코드를 직접 적지 않는다.
 */
export type NotificationTrigger = 'USER_REGISTERED' | 'USER_WITHDRAWN' | 'FEEDBACK_REPLIED';

export const TRIGGERS: { value: NotificationTrigger; label: string }[] = [
  { value: 'USER_REGISTERED', label: '회원가입' },
  { value: 'USER_WITHDRAWN', label: '회원 탈퇴' },
  // 캡틴이 문의·오류 신고에 회신하면 제출자에게 — 회신 내용은 담지 않고 내 문의 링크만
  { value: 'FEEDBACK_REPLIED', label: '문의 회신' },
];

export const TRIGGER_LABEL: Record<string, string> = Object.fromEntries(TRIGGERS.map((t) => [t.value, t.label]));

export type NotificationTemplate = {
  id: number;
  /**
   * 언제 보내는가. **이것이 곧 알림의 이름이다** — 따로 이름을 받지 않는다. 이름을 따로 두면
   * 「가입 환영」이라는 템플릿이 탈퇴 때 나가는 일이 생긴다. 같은 조건에 여러 통을 둘 수 있고, 제목으로 구분한다.
   */
  trigger: NotificationTrigger;
  /** 지금은 메일뿐이다. 디스코드는 보낼 수단이 아직 없다. */
  channel: 'EMAIL';
  subject: string;
  body: string;
  /** **등록한 날이 곧 첫 수정일이다.** 비어 있는 경우를 두지 않는다 — 문구 없는 템플릿은 없다. */
  updatedAt: string;
};

export const TEMPLATE_CHANNEL_LABEL: Record<string, string> = { EMAIL: '메일' };

/** 서버 페이지에서 회원가입·문의 회신 메일 시안 파일을 읽어 전달한다. */
export const createTemplates = (welcomeBody: string, feedbackBody: string): NotificationTemplate[] => [
  {
    id: 1,
    trigger: 'USER_REGISTERED',
    channel: 'EMAIL',
    subject: '[StudyClub] 회원가입을 환영합니다',
    body: welcomeBody,
    updatedAt: '2026-09-12T00:00:00Z',
  },
  {
    id: 2,
    trigger: 'FEEDBACK_REPLIED',
    channel: 'EMAIL',
    subject: '[StudyClub] 문의에 답변이 등록됐어요',
    body: feedbackBody,
    updatedAt: '2026-10-31T00:00:00Z',
  },
];
