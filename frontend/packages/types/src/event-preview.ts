/** 행사 기획 검토용 모델. 실제 API 계약과 분리한다. */
export type EventChannel = "ONLINE" | "OFFLINE";
export type EventConfirmation = "AUTO" | "REVIEW";
export type EventRegistrationStatus =
  "PENDING" | "CONFIRMED" | "DECLINED" | "CANCELLED";
export type EventQuestion = {
  id: string;
  label: string;
  type: "TEXT" | "TEXTAREA" | "RADIO" | "CHECKBOX" | "SELECT";
  required: boolean;
  options: string[];
};
export type PreviewEvent = {
  id: string;
  title: string;
  summary: string;
  description: string;
  startsAt: string;
  /** 빈 문자열이면 종료 시각 미정 */
  endsAt: string;
  deadlineAt: string;
  timeZone: string;
  format: "ONLINE" | "OFFLINE" | "HYBRID";
  location: string;
  onlineUrl: string;
  onlineCapacity: number;
  offlineCapacity: number;
  confirmation: EventConfirmation;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "CANCELLED";
  publishedAt?: string;
  /** 행사 취소 직전 확인 대기·참가 확정 신청자의 ID. */
  cancellationRecipientIds?: string[];
  questions: EventQuestion[];
};
export type EventRegistration = {
  id: string;
  eventId: string;
  memberId: string;
  name: string;
  email: string;
  /** 신청 당시 회원 프로필 시간대. 기존 기록은 행사 시간대를 사용한다. */
  timeZone?: string;
  channel: EventChannel;
  status: EventRegistrationStatus;
  createdAt: string;
  questions: EventQuestion[];
  answers: Record<string, string | string[]>;
};
export type EventMailPreview = {
  id: string;
  eventId: string;
  subject: string;
  body: string;
  recipients: string[];
  /** 발송 시점에 선택한 대상. 기존 이력은 인원수로만 구분한다. */
  audience?: "ALL" | "ONLINE" | "OFFLINE" | "ACTIVE" | "CANCELLED_ACTIVE";
  /** 2: 행사 정보를 채우고 닉네임만 원문으로 둔 공통 미리보기. */
  previewVersion?: 2;
  /** 일괄 발송의 수신자별 치환 결과. 목록은 한 번의 발송을 한 건으로 표시한다. */
  deliveries?: { recipient: string; subject: string; body: string; format: "HTML" | "TEXT" }[];
  format?: "HTML" | "TEXT";
  createdAt: string;
  /** 운영진이 작성한 안내 메일과 상태 변경에 따른 자동 메일을 구분한다. */
  kind?: "OPERATOR" | "AUTOMATIC";
};
export type EventNoticeTemplate = {
  id: number;
  trigger: "EVENT_ANNOUNCEMENT";
  channel: "EMAIL";
  subject: string;
  body: string;
  updatedAt: string;
};
export type PreviewNotificationTemplate = Omit<EventNoticeTemplate, "trigger"> & {
  trigger:
    | "USER_REGISTERED"
    | "USER_WITHDRAWN"
    | "FEEDBACK_REPLIED"
    | "EVENT_ANNOUNCEMENT"
    | "EVENT_REGISTRATION_PENDING"
    | "EVENT_REGISTRATION_CONFIRMED"
    | "EVENT_REGISTRATION_DECLINED"
    | "EVENT_REGISTRATION_CANCELLED";
};
export type EventPreviewState = {
  version: 2;
  /** 예시 확장은 한 번만 적용하고 이후 운영진이 바꾼 상태를 보존한다. */
  exampleRevision?: number;
  eventTemplates: EventNoticeTemplate[];
  notificationTemplates?: PreviewNotificationTemplate[];
  deletedTemplateTriggers?: PreviewNotificationTemplate['trigger'][];
  events: PreviewEvent[];
  registrations: EventRegistration[];
  mails: EventMailPreview[];
};
