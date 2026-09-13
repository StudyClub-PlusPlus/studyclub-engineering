import type { Locale } from './content';

/** Matches POST /accounts/onboarding. No real API is called in playground. */
export type OnboardingRequest = {
  nickname: string;
  timeZone: string;
  termsOfServiceAgreed: boolean;
  privacyPolicyAgreed: boolean;
  marketingAgreed: boolean;
};

export const ONBOARDING_SCENARIOS = [
  'default',
  'empty',
  'nickname',
  'duplicate',
  'server',
  'expired',
  'loading',
] as const;
export type OnboardingScenario = (typeof ONBOARDING_SCENARIOS)[number];
export const LOGIN_SCENARIOS = ['new', 'returning', 'existing', 'cancelled', 'error'] as const;
export type LoginScenario = (typeof LOGIN_SCENARIOS)[number];

const DRAFT_PREFIX = 'playground_onboarding_draft_';
export const SUCCESS_KEY = 'playground_onboarding_success';

export function readDraft(scenario: OnboardingScenario): OnboardingRequest | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_PREFIX + scenario);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const d = value as Record<string, unknown>;
    if (typeof d.nickname !== 'string' || typeof d.timeZone !== 'string') return null;
    if (['termsOfServiceAgreed', 'privacyPolicyAgreed', 'marketingAgreed'].some((key) => typeof d[key] !== 'boolean'))
      return null;
    return d as OnboardingRequest;
  } catch {
    return null;
  }
}

export function saveDraft(scenario: OnboardingScenario, draft: OnboardingRequest) {
  try {
    sessionStorage.setItem(DRAFT_PREFIX + scenario, JSON.stringify(draft));
  } catch {
    // Storage may be disabled. The current form still works in React state.
  }
}

export function clearDrafts() {
  try {
    for (const scenario of ONBOARDING_SCENARIOS) sessionStorage.removeItem(DRAFT_PREFIX + scenario);
  } catch {
    // Preview storage is optional.
  }
}

export function initialDraft(scenario: OnboardingScenario): OnboardingRequest {
  const saved = readDraft(scenario);
  if (saved) return saved;
  let timeZone = '';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* Allow manual selection. */
  }
  return {
    nickname:
      scenario === 'empty'
        ? ''
        : scenario === 'nickname'
          ? 'Journey Park'
          : scenario === 'duplicate'
            ? 'studyclub'
            : 'Journey',
    timeZone: scenario === 'empty' ? '' : timeZone,
    termsOfServiceAgreed: !['default', 'empty', 'nickname'].includes(scenario),
    privacyPolicyAgreed: !['default', 'empty', 'nickname'].includes(scenario),
    marketingAgreed: false,
  };
}

/** Mirrors NicknamePolicy: trim, UTF-16 length, Unicode letters/digits, reserved names. */
export function nicknameError(raw: string, locale: Locale): string | undefined {
  const value = raw.trim();
  const ko = locale === 'ko';
  if (!value) return ko ? '닉네임을 입력해 주세요.' : 'Enter a nickname.';
  if (value.length < 2 || value.length > 20) return ko ? '닉네임은 2~20자로 입력해 주세요.' : 'Use 2–20 characters.';
  if (!/^[\p{L}\p{Nd}_]+$/u.test(value))
    return ko
      ? '글자·숫자·밑줄(_)만 사용할 수 있어요. 공백은 빼 주세요.'
      : 'Use letters, numbers or underscores (_), without spaces.';
  if (/^_+$/.test(value))
    return ko ? '밑줄만으로 된 닉네임은 사용할 수 없어요.' : 'Your nickname cannot contain only underscores.';
  if (['운영진', '관리자', 'admin'].includes(value.toLowerCase()) || value.toLowerCase().startsWith('account_')) {
    return ko
      ? '사용할 수 없는 닉네임이에요. 다른 이름을 입력해 주세요.'
      : 'This nickname is reserved. Choose another one.';
  }
}

export function isValidTimeZone(value: string): boolean {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

/** Keep prototype return links inside the user site, never back into authentication. */
export function returnPath(raw: string | null, locale: Locale): string {
  const fallback = `/proto/core/${locale}`;
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  try {
    const url = new URL(raw, 'https://playground.invalid');
    if (url.origin !== 'https://playground.invalid' || !/^\/proto\/core\/(ko|en)(\/|$)/.test(url.pathname))
      return fallback;
    if (/^\/proto\/core\/(ko|en)\/(login|onboarding)(\/|$)/.test(url.pathname)) return fallback;
    return url.pathname.replace(/^\/proto\/core\/(ko|en)/, `/proto/core/${locale}`) + url.search + url.hash;
  } catch {
    return fallback;
  }
}
