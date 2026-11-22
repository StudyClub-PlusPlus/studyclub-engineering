import type { Locale } from '@studyclub/types';

import type { ApplyBlockedReason } from '@/features/events/response-schema';

export const FORMAT_LABEL: Record<string, Record<Locale, string>> = {
  ONLINE: { ko: '온라인', en: 'Online' },
  OFFLINE: { ko: '오프라인', en: 'In person' },
  HYBRID: { ko: '온라인·오프라인', en: 'Online & in person' },
};

export const CHANNEL_LABEL: Record<string, Record<Locale, string>> = {
  ONLINE: { ko: '온라인', en: 'Online' },
  OFFLINE: { ko: '오프라인', en: 'In person' },
};

export const DISPLAY_STATUS_LABEL: Record<string, Record<Locale, string>> = {
  RECRUITING: { ko: '모집 중', en: 'Open' },
  FULL: { ko: '정원 마감', en: 'Full' },
  RECRUITMENT_CLOSED: { ko: '모집 마감', en: 'Closed' },
  ENDED: { ko: '종료', en: 'Ended' },
  CANCELLED: { ko: '행사 취소', en: 'Cancelled' },
};

export const REGISTRATION_STATUS_LABEL: Record<string, Record<Locale, string>> = {
  PENDING: { ko: '확인 대기', en: 'Pending' },
  CONFIRMED: { ko: '참가 확정', en: 'Confirmed' },
  DECLINED: { ko: '참가 불가', en: 'Declined' },
  CANCELLED: { ko: '신청 취소', en: 'Cancelled' },
};

export function displayStatusTone(status: string): 'recruiting' | 'neutral' | 'error' {
  if (status === 'RECRUITING') return 'recruiting';
  if (status === 'CANCELLED') return 'error';
  return 'neutral';
}

export function registrationTone(status: string): 'recruiting' | 'closingsoon' | 'neutral' | 'error' {
  if (status === 'CONFIRMED') return 'recruiting';
  if (status === 'PENDING') return 'closingsoon';
  if (status === 'DECLINED') return 'error';
  return 'neutral';
}

export function applyBlockedMessage(reason: ApplyBlockedReason | null, locale: Locale): string | null {
  if (!reason) return null;
  const ko: Record<ApplyBlockedReason, string> = {
    LOGIN_REQUIRED: '로그인한 뒤 신청할 수 있어요.',
    ONBOARDING_REQUIRED: '가입을 마치면 신청할 수 있어요.',
    EVENT_CANCELLED: '취소된 행사예요.',
    EVENT_ENDED: '종료된 행사예요.',
    RECRUITMENT_CLOSED: '모집이 마감되었어요.',
    ACCOUNT_EMAIL_INVALID: '계정 이메일을 확인한 뒤 다시 신청해 주세요.',
    ALREADY_REGISTERED: '이미 신청한 행사예요.',
    DECLINED_BEFORE: '참가 불가 처리된 행사는 다시 신청할 수 없어요.',
    FULL: '정원이 마감되었어요.',
  };
  const en: Record<ApplyBlockedReason, string> = {
    LOGIN_REQUIRED: 'Sign in to apply.',
    ONBOARDING_REQUIRED: 'Complete onboarding to apply.',
    EVENT_CANCELLED: 'This event was cancelled.',
    EVENT_ENDED: 'This event has ended.',
    RECRUITMENT_CLOSED: 'Registration is closed.',
    ACCOUNT_EMAIL_INVALID: 'Check your account email and try again.',
    ALREADY_REGISTERED: 'You already applied to this event.',
    DECLINED_BEFORE: 'You cannot apply again after being declined.',
    FULL: 'This event is full.',
  };
  return locale === 'ko' ? ko[reason] : en[reason];
}