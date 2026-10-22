import { describe, expect, it } from 'vitest';

import { answerText, summarizeAnswers } from './answers';
import type { ApplicationResult, ResultQuestion } from './types';

const question: ResultQuestion = { id: 'q', label: '질문', type: 'CHECKBOX', options: ['A', 'B'], allowOther: true };
function applications(values: (string | string[] | undefined)[]): ApplicationResult[] {
  return values.map((value, id): ApplicationResult => ({
    id,
    recruitmentId: 1,
    discordNickname: null,
    email: null,
    answers: value === undefined ? {} : { q: value },
  }));
}

describe('신청 답변 집계', () => {
  it('공백과 미응답은 제외하고 복수 선택은 선택지별로 한 사람씩 센다', () => {
    const summary = summarizeAnswers(
      question,
      applications([['A', 'A', 'B'], ['A', '기타 내용'], '', '  ', [], undefined]),
    );
    expect(summary.count).toBe(2);
    expect(summary.tallies).toEqual([
      { option: 'A', count: 2 },
      { option: 'B', count: 1 },
    ]);
    expect(summary.texts).toEqual(['기타 내용']);
  });
  it.each(['RADIO', 'SELECT'] as const)('%s 단일 선택도 기타 답과 구분한다', (type) => {
    const summary = summarizeAnswers({ ...question, type }, applications(['A', '직접 입력']));
    expect(summary.count).toBe(2);
    expect(summary.tallies[0].count).toBe(1);
    expect(summary.texts).toEqual(['직접 입력']);
  });
  it('긴 답변의 줄바꿈과 동일한 답변을 낸 사람 수를 보존한다', () => {
    const answer = '첫 줄\n둘째 줄';
    expect(summarizeAnswers({ ...question, type: 'TEXTAREA' }, applications([answer, answer])).texts).toEqual([
      answer,
      answer,
    ]);
    expect(answerText(answer)).toBe(answer);
    expect(answerText([])).toBe('—');
  });
});
