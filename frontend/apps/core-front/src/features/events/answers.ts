import type { ApiEventQuestion } from '@/features/events/response-schema';

export const TEXT_ANSWER_MAX = 200;
export const TEXTAREA_ANSWER_MAX = 2000;

export type DraftAnswers = Record<string, string | string[]>;

export function questionFingerprint(questions: ApiEventQuestion[]): string {
  return JSON.stringify(
    questions.map(({ questionId, label, type, required, options }) => [
      questionId,
      label,
      type,
      required,
      options,
    ]),
  );
}

/** 질문이 바뀐 뒤에도 내용이 같은 질문의 답만 유지한다. */
export function answersForUnchangedQuestions(
  previous: ApiEventQuestion[],
  current: ApiEventQuestion[],
  answers: DraftAnswers,
): DraftAnswers {
  const previousById = new Map(previous.map((q) => [q.questionId, questionFingerprint([q])]));
  const next: DraftAnswers = {};
  for (const q of current) {
    if (previousById.get(q.questionId) !== questionFingerprint([q])) continue;
    const value = answers[q.questionId];
    if (value !== undefined) next[q.questionId] = value;
  }
  return next;
}

export function draftToSubmitPayload(answers: DraftAnswers, questions: ApiEventQuestion[]): Record<string, string[]> {
  const payload: Record<string, string[]> = {};
  for (const q of questions) {
    const raw = answers[q.questionId];
    if (raw === undefined) {
      if (!q.required) payload[q.questionId] = [];
      continue;
    }
    if (q.type === 'CHECKBOX') {
      const values = (Array.isArray(raw) ? raw : [raw]).map((v) => v.trim()).filter(Boolean);
      if (values.length) payload[q.questionId] = values;
      else if (!q.required) payload[q.questionId] = [];
      continue;
    }
    const text = (Array.isArray(raw) ? raw[0] : raw).trim();
    if (text) payload[q.questionId] = [text];
    else if (!q.required) payload[q.questionId] = [];
  }
  return payload;
}

export function validateDraftAnswers(
  answers: DraftAnswers,
  questions: ApiEventQuestion[],
  locale: 'ko' | 'en',
): Record<string, string> {
  const errors: Record<string, string> = {};
  const msg = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  for (const q of questions) {
    const raw = answers[q.questionId];
    if (q.type === 'CHECKBOX') {
      const values = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((v) => String(v).trim()).filter(Boolean);
      if (q.required && !values.length) errors[q.questionId] = msg(`‘${q.label}’에 답변해 주세요.`, `Answer “${q.label}”.`);
      continue;
    }
    const text = (Array.isArray(raw) ? raw[0] : raw ?? '').trim();
    if (q.required && !text) {
      errors[q.questionId] = msg(`‘${q.label}’에 답변해 주세요.`, `Answer “${q.label}”.`);
      continue;
    }
    if (!text) continue;
    if (q.type === 'TEXT' && text.length > TEXT_ANSWER_MAX) {
      errors[q.questionId] = msg(`답변은 ${TEXT_ANSWER_MAX}자 이내로 입력해 주세요.`, `Keep your answer within ${TEXT_ANSWER_MAX} characters.`);
    }
    if (q.type === 'TEXTAREA' && text.length > TEXTAREA_ANSWER_MAX) {
      errors[q.questionId] = msg(`답변은 ${TEXTAREA_ANSWER_MAX}자 이내로 입력해 주세요.`, `Keep your answer within ${TEXTAREA_ANSWER_MAX} characters.`);
    }
    if (q.type === 'RADIO' && !q.options.includes(text)) {
      errors[q.questionId] = msg('목록에서 선택해 주세요.', 'Pick an option from the list.');
    }
  }
  return errors;
}

export function occupiesSeat(status: string) {
  return status === 'PENDING' || status === 'CONFIRMED';
}