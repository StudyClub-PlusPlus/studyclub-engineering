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
  questions: EventQuestion[];
};
export type EventRegistration = {
  id: string;
  eventId: string;
  memberId: string;
  name: string;
  email: string;
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
  createdAt: string;
};
export type EventPreviewState = {
  version: 1;
  events: PreviewEvent[];
  registrations: EventRegistration[];
  mails: EventMailPreview[];
};
