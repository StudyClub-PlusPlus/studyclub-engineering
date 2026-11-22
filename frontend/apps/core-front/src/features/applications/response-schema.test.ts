import { describe, expect, it } from 'vitest';

import { apiMyApplicationSchema, apiStudyApplicationFormSchema } from './response-schema';

const form = {
  studyId: 190,
  title: '스터디',
  description: null,
  schedule: null,
  recruitDeadline: '2026-11-30T14:59:59Z',
  category: 'AI_ML',
  summary: '요약',
  detail: null,
};

describe('application form response contract', () => {
  // 서버는 해당 없는 칸을 null 로 보낸다 — 거부하면 신청 폼을 못 연다 (stage 2026-10-31)
  it('accepts null for fields a question type does not use, and reads them as absent', () => {
    const parsed = apiStudyApplicationFormSchema.parse({
      ...form,
      questions: [
        {
          id: 'q1',
          label: '한 줄',
          type: 'TEXT',
          required: true,
          placeholder: null,
          description: null,
          options: null,
          allowOther: null,
        },
      ],
    });
    expect(parsed.questions[0]).toMatchObject({ placeholder: undefined, options: undefined, allowOther: undefined });
  });

  it('keeps values that are present', () => {
    const parsed = apiStudyApplicationFormSchema.parse({
      ...form,
      questions: [{ id: 'q2', label: '고르기', type: 'RADIO', required: false, options: ['A', 'B'], allowOther: true }],
    });
    expect(parsed.questions[0]).toMatchObject({ options: ['A', 'B'], allowOther: true });
  });
});

describe('my application response contract', () => {
  it('참여 중단된 신청은 withdrawn=true 로 읽는다', () => {
    const parsed = apiMyApplicationSchema.parse({
      applied: true,
      applicationId: 42,
      submittedAt: '2026-09-19T12:00:00Z',
      withdrawn: true,
    });
    expect(parsed.withdrawn).toBe(true);
  });

  it('withdrawn 칸이 없는 옛 응답은 참여 중단이 아닌 것으로 읽는다', () => {
    const parsed = apiMyApplicationSchema.parse({ applied: false, applicationId: null, submittedAt: null });
    expect(parsed.withdrawn).toBe(false);
  });
});
