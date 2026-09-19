import type { ApplicationQuestion } from '@studyclub/mock';

/**
 * 스터디 신청 폼 — 유효값. 기획서 MIN / MAX / ENUM 과 같은 숫자다.
 * 서버도 이 값으로 거절한다. 화면만 막고 서버가 느슨하면 우회된다.
 */

export const DISCORD_NICKNAME_MIN = 1;
export const DISCORD_NICKNAME_MAX = 100;

export const TEXT_ANSWER_MAX = 200;
export const TEXTAREA_ANSWER_MAX = 2_000;
export const OTHER_ANSWER_MAX = 100;

export const AVAILABLE_DAYS = [
  { key: 'mon', ko: '월요일', en: 'Monday' },
  { key: 'tue', ko: '화요일', en: 'Tuesday' },
  { key: 'wed', ko: '수요일', en: 'Wednesday' },
  { key: 'thu', ko: '목요일', en: 'Thursday' },
  { key: 'fri', ko: '금요일', en: 'Friday' },
  { key: 'sat', ko: '토요일', en: 'Saturday' },
  { key: 'sun', ko: '일요일', en: 'Sunday' },
] as const;

export type AvailableDayKey = (typeof AVAILABLE_DAYS)[number]['key'];

export const AVAILABLE_DAY_KEYS: readonly AvailableDayKey[] = AVAILABLE_DAYS.map((d) => d.key);
export const AVAILABLE_DAYS_MIN = 1;
export const AVAILABLE_DAYS_MAX = AVAILABLE_DAY_KEYS.length;

export type FieldIssue = 'empty' | 'max' | 'enum' | 'other-empty' | 'other-max';

export function isKnownDayKey(key: string): key is AvailableDayKey {
  return (AVAILABLE_DAY_KEYS as readonly string[]).includes(key);
}

export function nicknameIssue(raw: string): FieldIssue | null {
  const v = raw.trim();
  if (v.length < DISCORD_NICKNAME_MIN) return 'empty';
  if (v.length > DISCORD_NICKNAME_MAX) return 'max';
  return null;
}

export function daysIssue(days: string[]): FieldIssue | null {
  const unique = [...new Set(days)];
  if (unique.length < AVAILABLE_DAYS_MIN) return 'empty';
  if (unique.length > AVAILABLE_DAYS_MAX) return 'max';
  if (unique.some((d) => !isKnownDayKey(d))) return 'enum';
  return null;
}

function optionSet(q: ApplicationQuestion) {
  return new Set((q.options ?? []).filter(Boolean));
}

function isOtherValue(q: ApplicationQuestion, value: string) {
  return Boolean(q.allowOther) && !optionSet(q).has(value);
}

export function extraAnswerIssue(
  q: ApplicationQuestion,
  answer: string | string[] | undefined,
): FieldIssue | null {
  if (q.type === 'checkbox') {
    const selected = Array.isArray(answer) ? answer.map((v) => v.trim()).filter(Boolean) : [];
    if (q.required && selected.length < 1) return 'empty';
    const max = optionSet(q).size + (q.allowOther ? 1 : 0);
    if (max > 0 && selected.length > max) return 'max';
    for (const v of selected) {
      if (optionSet(q).has(v)) continue;
      if (!q.allowOther) return 'enum';
      if (v.length > OTHER_ANSWER_MAX) return 'other-max';
    }
    return null;
  }

  const value = typeof answer === 'string' ? answer.trim() : '';
  if (q.required && !value) return 'empty';
  if (!value) return null;

  if (q.type === 'text' && value.length > TEXT_ANSWER_MAX) return 'max';
  if (q.type === 'textarea' && value.length > TEXTAREA_ANSWER_MAX) return 'max';

  if (q.type === 'radio' || q.type === 'select') {
    if (optionSet(q).has(value)) return null;
    if (!q.allowOther) return 'enum';
    if (!value) return 'other-empty';
    if (value.length > OTHER_ANSWER_MAX) return 'other-max';
  }

  return null;
}
