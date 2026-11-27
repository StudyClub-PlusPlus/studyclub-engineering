import { describe, expect, it } from 'vitest';

import {
  answersForUnchangedQuestions,
  draftToSubmitPayload,
  validateDraftAnswers,
  type DraftAnswers,
} from './answers';
import type { ApiEventQuestion } from './response-schema';

const baseQuestions: ApiEventQuestion[] = [
  { questionId: 'q1', label: '동기', type: 'TEXTAREA', required: true, options: [] },
  { questionId: 'q2', label: '주제', type: 'RADIO', required: false, options: ['A', 'B'] },
];

describe('event answers', () => {
  it('keeps answers only for unchanged questions', () => {
    const answers: DraftAnswers = { q1: 'hello', q2: 'A' };
    const nextQuestions = [{ ...baseQuestions[0]!, label: '바뀐 제목' }, baseQuestions[1]!];
    const kept = answersForUnchangedQuestions(baseQuestions, nextQuestions, answers);
    expect(kept).toEqual({ q2: 'A' });
  });

  it('builds submit payload with string arrays', () => {
    const answers: DraftAnswers = { q1: '  hi  ', q2: 'A' };
    const payload = draftToSubmitPayload(answers, baseQuestions);
    expect(payload).toEqual({ q1: ['hi'], q2: ['A'] });
  });

  it('validates required answers', () => {
    const errors = validateDraftAnswers({}, baseQuestions, 'ko');
    expect(errors.q1).toBeTruthy();
  });
});