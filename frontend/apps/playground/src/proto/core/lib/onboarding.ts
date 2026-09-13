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

/**
 * 닉네임 형식 검사 — 서버 `NicknamePolicy` 를 그대로 옮긴 것.
 *
 * **틀린 이유는 방금 친 글자로 말한다.** 「허용되지 않은 문자」라고만 하면 스무 자 중 어느 것이
 * 문제인지 찾아야 한다. 위반 문자를 따옴표로 감싸 보여주면 바로 알아본다.
 *
 * 다만 따옴표로 감쌀 수 없는 것이 둘 있다 — **공백**은 감싸도 안 보이고, **이모지**는
 * 「'😀'는 사용할 수 없는 문자입니다」가 어색하다. 둘은 문장으로 따로 뺀다.
 */
const ALLOWED = /[\p{L}\p{Nd}_]/u;
const EMOJI = /\p{Extended_Pictographic}/u;

/** 위반 문자를 앞에서부터, 중복 없이. */
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

  // 문자부터 본다 — 길이를 먼저 말하면 지우고 다시 쳐도 같은 문자를 또 넣는다.
  const bad = violations(value);
  if (bad.length > 0) {
    if (/\s/.test(raw)) return ko ? '공백은 사용할 수 없습니다' : 'Spaces are not allowed.';
    if (bad.some((char) => EMOJI.test(char))) return ko ? '이모지는 사용할 수 없습니다' : 'Emoji are not allowed.';
    if (bad.length > 3) return ko ? '사용할 수 없는 문자가 포함되어 있습니다' : 'Contains characters that are not allowed.';
    const quoted = bad.map((char) => `'${char}'`).join(', ');
    return ko ? `${quoted}는 사용할 수 없는 문자입니다` : `${quoted} cannot be used.`;
  }

  if (value.length < 2) return ko ? '2자 이상 입력해 주세요' : 'Use at least 2 characters.';
  if (value.length > 20) return ko ? '20자 이내로 입력해 주세요' : 'Use 20 characters or fewer.';
  if (/^_+$/.test(value)) return ko ? '밑줄만으로는 닉네임을 만들 수 없습니다' : 'Your nickname cannot be only underscores.';
  if (['운영진', '관리자', 'admin'].includes(value.toLowerCase()) || value.toLowerCase().startsWith('account_')) {
    return ko ? '사용할 수 없는 닉네임입니다' : 'This nickname is reserved.';
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
