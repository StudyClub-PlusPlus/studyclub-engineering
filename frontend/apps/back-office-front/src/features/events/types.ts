import type { z } from 'zod';

import type {
  eventDetailSchema,
  eventMailDetailSchema,
  eventMailPageSchema,
  eventMailPreviewSchema,
  eventPageSchema,
  eventRegistrationDetailSchema,
  eventRegistrationPageSchema,
  eventRegistrationRowSchema,
} from '@/features/events/response-schema';

export type EventDetail = z.infer<typeof eventDetailSchema>;
export type EventPage = z.infer<typeof eventPageSchema>;
export type EventListItem = EventPage['items'][number];
export type EventQuestion = EventDetail['questions'][number];
export type EventRegistrationRow = z.infer<typeof eventRegistrationRowSchema>;
export type EventRegistrationPage = z.infer<typeof eventRegistrationPageSchema>;
export type EventRegistrationDetail = z.infer<typeof eventRegistrationDetailSchema>;
export type EventMailPreview = z.infer<typeof eventMailPreviewSchema>;
export type EventMailDetail = z.infer<typeof eventMailDetailSchema>;
export type EventMailPage = z.infer<typeof eventMailPageSchema>;

export type EventChannel = 'ONLINE' | 'OFFLINE';
export type EventFormat = 'ONLINE' | 'OFFLINE' | 'HYBRID';
export type EventConfirmation = 'AUTO' | 'REVIEW';
export type QuestionType = 'TEXT' | 'TEXTAREA' | 'RADIO' | 'CHECKBOX';
export type EventStatusTarget = 'PUBLISHED' | 'CLOSED' | 'CANCELLED';
export type RegistrationTarget = 'CONFIRMED' | 'DECLINED' | 'CANCELLED';
export type MailType = 'ANNOUNCEMENT' | 'CANCELLATION';
export type MailAudience = 'ALL' | 'ONLINE' | 'OFFLINE' | 'CANCELLED_ACTIVE';

/** 등록·수정 요청 본문. 수정은 `version` 을 더해 보낸다. */
export type EventPayload = {
  title: string;
  summary: string;
  description: string;
  timeZone: string;
  startsAt: string;
  endsAt: string | null;
  deadlineAt: string;
  format: EventFormat;
  offline: { capacity: number; location: string } | null;
  online: { capacity: number; url: string | null } | null;
  confirmation: EventConfirmation;
  questions: {
    questionId: string | null;
    label: string;
    type: QuestionType;
    required: boolean;
    options: string[];
  }[];
};

export const EVENT_PAGE_SIZE = 20;
export const REGISTRATION_PAGE_SIZE = 20;
export const MAIL_PAGE_SIZE = 20;

/** 서버와 같은 기준이다. UTF-16 단위 `length` 로 센다. */
export const EVENT_LIMITS = {
  title: 60,
  summary: 120,
  description: 5000,
  location: 300,
  url: 2048,
  questionLabel: 200,
  optionLabel: 100,
  questions: 20,
  minOptions: 2,
  maxOptions: 10,
  minCapacity: 1,
  maxCapacity: 10000,
  notice: 5000,
} as const;

/** 서버가 받는 행사 기준 시간대. 회원 시간대(밴쿠버 포함)와 다르다. */
export const EVENT_ZONES = [
  { value: 'Asia/Seoul', label: '한국 (서울)' },
  { value: 'America/Toronto', label: '캐나다 (토론토)' },
  { value: 'America/New_York', label: '미국 (뉴욕)' },
  { value: 'America/Los_Angeles', label: '미국 (로스앤젤레스)' },
] as const;

export const CHANNEL_LABEL: Record<EventChannel, string> = { ONLINE: '온라인', OFFLINE: '오프라인' };
export const FORMAT_LABEL: Record<EventFormat, string> = { ...CHANNEL_LABEL, HYBRID: '온라인·오프라인' };
export const REGISTRATION_LABEL = {
  PENDING: '확인 대기',
  CONFIRMED: '참가 확정',
  DECLINED: '참가 불가',
  CANCELLED: '신청 취소',
} as const;
export const DISPLAY_STATUS_LABEL = {
  RECRUITING: '모집 중',
  FULL: '정원 마감',
  RECRUITMENT_CLOSED: '모집 마감',
  ENDED: '종료',
  CANCELLED: '행사 취소',
} as const;
export const MAIL_AUDIENCE_LABEL: Record<MailAudience, string> = {
  ALL: '참가 확정자 전체',
  ONLINE: '온라인 참가 확정자',
  OFFLINE: '오프라인 참가 확정자',
  CANCELLED_ACTIVE: '취소 당시 신청자 전체',
};
