import type { Locale } from '@/lib/content';

/** POST /accounts/onboarding 에 보낼 폼 상태 (age14Confirmed 는 별도). */
export type OnboardingDraft = {
  nickname: string;
  timeZone: string;
  termsOfServiceAgreed: boolean;
  privacyPolicyAgreed: boolean;
  marketingAgreed: boolean;
};

/** 한국 / 북미 동부 / 밴쿠버 / LA — 서머타임 정책 차이로 밴쿠버·LA 를 분리한다. */
export const ONBOARDING_ZONES = [
  'Asia/Seoul',
  'America/New_York',
  'America/Vancouver',
  'America/Los_Angeles',
] as const;
export type OnboardingZone = (typeof ONBOARDING_ZONES)[number];

const DRAFT_PREFIX = 'sc_onboarding_draft_';

function draftKey(accountId: number): string {
  return `${DRAFT_PREFIX}${accountId}`;
}

export function readDraft(accountId: number): OnboardingDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(draftKey(accountId));
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const d = value as Record<string, unknown>;
    if (typeof d.nickname !== 'string' || typeof d.timeZone !== 'string') return null;
    if (
      ['termsOfServiceAgreed', 'privacyPolicyAgreed', 'marketingAgreed'].some(
        (key) => typeof d[key] !== 'boolean',
      )
    ) {
      return null;
    }
    return d as OnboardingDraft;
  } catch {
    return null;
  }
}

export function saveDraft(accountId: number, draft: OnboardingDraft) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(draftKey(accountId), JSON.stringify(draft));
  } catch {
    // Storage may be disabled.
  }
}

export function clearDraft(accountId: number) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(draftKey(accountId));
  } catch {
    // optional
  }
}

/** 기기 시간대를 온보딩 4개 중 하나로 접는다. 못 접으면 빈 값 — 사용자가 고른다. */
export function snapToOnboardingZone(iana: string): OnboardingZone | '' {
  if ((ONBOARDING_ZONES as readonly string[]).includes(iana)) return iana as OnboardingZone;
  const aliases: Record<string, OnboardingZone> = {
    'Asia/Seoul': 'Asia/Seoul',
    'America/Toronto': 'America/New_York',
    'America/Detroit': 'America/New_York',
    'America/Montreal': 'America/New_York',
    'America/Seattle': 'America/Los_Angeles',
    'America/Tijuana': 'America/Los_Angeles',
  };
  if (aliases[iana]) return aliases[iana]!;
  try {
    const target = offsetMinutes(iana);
    for (const zone of ONBOARDING_ZONES) {
      if (offsetMinutes(zone) === target) return zone;
    }
  } catch {
    // ignore
  }
  return '';
}

function offsetMinutes(zone: string): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    timeZoneName: 'longOffset',
  }).formatToParts(now);
  const raw = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = raw.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours * 60 + minutes);
}

export function initialDraft(accountId: number, suggestedNickname: string | null): OnboardingDraft {
  const saved = readDraft(accountId);
  if (saved) return saved;
  let detected = '';
  try {
    detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    detected = '';
  }
  return {
    nickname: suggestedNickname?.trim() ?? '',
    timeZone: snapToOnboardingZone(detected),
    termsOfServiceAgreed: false,
    privacyPolicyAgreed: false,
    marketingAgreed: false,
  };
}

/**
 * 닉네임 형식 검사 — 서버 NicknamePolicy 와 같은 허용 문자.
 * 도움말 기본 문구는 PDF 기준 「한글, 영문」으로 화면에 따로 둔다.
 */
const ALLOWED = /[\p{L}\p{Nd}_]/u;
const EMOJI = /\p{Extended_Pictographic}/u;

function violations(value: string): string[] {
  const found: string[] = [];
  for (const char of value) {
    if (ALLOWED.test(char) || found.includes(char)) continue;
    found.push(char);
  }
  return found;
}

export function nicknameError(raw: string, locale: Locale): string | undefined {
  const value = raw.trim();
  const ko = locale === 'ko';
  if (!value) return ko ? '닉네임을 입력해 주세요' : 'Enter a nickname.';

  const bad = violations(value);
  if (bad.length > 0) {
    if (/\s/.test(raw)) return ko ? '공백은 사용할 수 없습니다' : 'Spaces are not allowed.';
    if (bad.some((char) => EMOJI.test(char))) return ko ? '이모지는 사용할 수 없습니다' : 'Emoji are not allowed.';
    if (bad.length > 3) {
      return ko ? '사용할 수 없는 문자가 포함되어 있습니다' : 'Contains characters that are not allowed.';
    }
    const quoted = bad.map((char) => `'${char}'`).join(', ');
    return ko ? `${quoted}는 사용할 수 없는 문자입니다` : `${quoted} cannot be used.`;
  }

  if (value.length < 2) return ko ? '2자 이상 입력해 주세요' : 'Use at least 2 characters.';
  if (value.length > 20) return ko ? '20자 이내로 입력해 주세요' : 'Use 20 characters or fewer.';
  if (/^_+$/.test(value)) {
    return ko ? '밑줄만으로는 닉네임을 만들 수 없습니다' : 'Your nickname cannot be only underscores.';
  }
  if (['운영진', '관리자', 'admin'].includes(value.toLowerCase()) || value.toLowerCase().startsWith('account_')) {
    return ko ? '사용할 수 없는 닉네임입니다' : 'This nickname is reserved.';
  }
}

export function isOnboardingTimeZone(value: string): value is OnboardingZone {
  return (ONBOARDING_ZONES as readonly string[]).includes(value);
}

/** 로그인과 동일 — next 없으면 /{locale}/my. open redirect 방지. */
export function returnPath(raw: string | null, locale: Locale): string {
  const fallback = `/${locale}/my`;
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  try {
    const url = new URL(raw, 'https://studyclub.invalid');
    if (url.origin !== 'https://studyclub.invalid') return fallback;
    if (!/^\/(ko|en)(\/|$)/.test(url.pathname)) return fallback;
    if (/^\/(ko|en)\/(login|onboarding)(\/|$)/.test(url.pathname)) return fallback;
    return `/${locale}${url.pathname.replace(/^\/(ko|en)/, '')}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}

export function zoneOffset(zone: string, now: Date): string {
  try {
    return (
      new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' })
        .formatToParts(now)
        .find((part) => part.type === 'timeZoneName')
        ?.value.replace('GMT', 'UTC') ?? ''
    );
  } catch {
    return '';
  }
}
