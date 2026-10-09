import type { ApplicationQuestion } from '@studyclub/mock';
import { z } from 'zod';

import type { Locale } from './content';
import { t } from './i18n';

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

export function normalizeSingleLine(value: string | undefined | null): string {
  return value == null ? '' : value.replace(/[\r\n\t]+/g, ' ').trim();
}

export function isKnownDayKey(key: string): key is AvailableDayKey {
  return (AVAILABLE_DAY_KEYS as readonly string[]).includes(key);
}

export function nicknameIssue(raw: string): FieldIssue | null {
  const v = normalizeSingleLine(raw);
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

export function extraAnswerIssue(
  q: ApplicationQuestion,
  answer: string | string[] | undefined,
  otherSelected?: boolean,
  otherText?: string,
): FieldIssue | null {
  if (q.type === 'checkbox') {
    const rawSelected = Array.isArray(answer)
      ? answer.map((v) => normalizeSingleLine(v)).filter((v) => v.length > 0)
      : [];
    const opts = optionSet(q);

    // 기타 체크 여부 검사
    if (otherSelected) {
      const cleanOther = normalizeSingleLine(otherText);
      if (!cleanOther) return 'other-empty';
      if (cleanOther.length > OTHER_ANSWER_MAX) return 'other-max';
    }

    const totalCount = rawSelected.length + (otherSelected ? 1 : 0);
    if (q.required && totalCount < 1) return 'empty';

    const max = opts.size + (q.allowOther ? 1 : 0);
    if (max > 0 && totalCount > max) return 'max';

    for (const v of rawSelected) {
      if (opts.has(v)) continue;
      if (!q.allowOther) return 'enum';
      if (v.length > OTHER_ANSWER_MAX) return 'other-max';
    }
    return null;
  }

  // Radio / Select / Text / Textarea
  if (q.type === 'radio' && otherSelected) {
    const cleanOther = normalizeSingleLine(otherText);
    if (!cleanOther) return 'other-empty';
    if (cleanOther.length > OTHER_ANSWER_MAX) return 'other-max';
    return null;
  }

  const isMultiline = q.type === 'textarea';
  const value = isMultiline
    ? (typeof answer === 'string' ? answer.trim() : '')
    : normalizeSingleLine(typeof answer === 'string' ? answer : '');

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

export interface MakeApplySchemaParams {
  extraQuestions?: ApplicationQuestion[];
  hasFixedSchedule?: boolean;
  locale?: Locale;
}

/**
 * Zod 기반 스터디 신청 폼 스키마 팩토리.
 * - 프로젝트 컴포넌트 가이드(docs/frontend-development-guide/component-guide.md)의
 *   makeSchema + superRefine 패턴을 준수합니다.
 */
export function makeApplySchema({
  extraQuestions = [],
  hasFixedSchedule = false,
  locale = 'ko',
}: MakeApplySchemaParams = {}) {
  return z
    .object({
      discordNickname: z.string(),
      days: z.array(z.string()),
      answers: z.record(z.union([z.string(), z.array(z.string())])).default({}),
      otherSelected: z.record(z.boolean()).optional().default({}),
      otherTexts: z.record(z.string()).optional().default({}),
      agreed: z.boolean().optional().default(false),
    })
    .superRefine((val, ctx) => {
      // 1. 디스코드 서버 별명 검증
      const nick = nicknameIssue(val.discordNickname);
      if (nick === 'empty') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discord'],
          message: t(
            { ko: '디스코드 서버 별명을 입력해 주세요.', en: 'Enter your Discord server nickname.' },
            locale,
          ),
        });
      } else if (nick === 'max') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['discord'],
          message: t(
            { ko: '100자 이내로 입력해 주세요.', en: 'Enter 100 characters or fewer.' },
            locale,
          ),
        });
      }

      // 2. 참여 가능한 요일 검증
      const dayProblem = daysIssue(val.days);
      if (dayProblem === 'empty' || dayProblem === 'max') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['days'],
          message: t(
            { ko: '참여 가능한 요일을 하나 이상 선택해 주세요.', en: 'Select at least one day you can join.' },
            locale,
          ),
        });
      } else if (dayProblem === 'enum') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['days'],
          message: t(
            { ko: '참여 가능한 요일을 다시 선택해 주세요.', en: 'Select a valid weekday.' },
            locale,
          ),
        });
      }

      // 3. 추가 동적 질문 검증
      for (const q of extraQuestions) {
        const issue = extraAnswerIssue(
          q,
          val.answers[q.id],
          val.otherSelected?.[q.id],
          val.otherTexts?.[q.id],
        );
        if (!issue) continue;

        if (issue === 'empty') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [q.id],
            message: t(
              { ko: '필수 질문에 답해 주세요.', en: 'Please answer required questions.' },
              locale,
            ),
          });
        } else if (issue === 'max') {
          const cap = q.type === 'textarea' ? '2,000' : '200';
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [q.id],
            message: t(
              { ko: `${cap}자 이내로 입력해 주세요.`, en: `Enter ${cap.replace(',', '')} characters or fewer.` },
              locale,
            ),
          });
        } else if (issue === 'enum') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [q.id],
            message: t(
              { ko: '선택지를 다시 골라 주세요.', en: 'Choose from the given options.' },
              locale,
            ),
          });
        } else if (issue === 'other-empty') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [q.id],
            message: t(
              { ko: '기타 내용을 입력해 주세요.', en: 'Enter the other option.' },
              locale,
            ),
          });
        } else if (issue === 'other-max') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [q.id],
            message: t(
              { ko: '100자 이내로 입력해 주세요.', en: 'Enter 100 characters or fewer.' },
              locale,
            ),
          });
        }
      }

      // 4. 고정 일정 확인 검증
      if (hasFixedSchedule && !val.agreed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['schedule'],
          message: t(
            { ko: '일정 참여 가능 여부를 확인해 주세요.', en: 'Please confirm you can attend.' },
            locale,
          ),
        });
      }
    });
}

export type ApplyFormSchema = ReturnType<typeof makeApplySchema>;
export type ApplyFormValues = z.infer<ApplyFormSchema>;
