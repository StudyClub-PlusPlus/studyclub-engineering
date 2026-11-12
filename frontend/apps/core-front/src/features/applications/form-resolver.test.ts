import { zodResolver } from '@hookform/resolvers/zod';
import { describe, expect, it } from 'vitest';

import { makeApplySchema } from './schema';

describe('application form resolver', () => {
  const schema = makeApplySchema({
    hasFixedSchedule: true,
    extraQuestions: [
      { id: 'career', label: 'Career', type: 'radio', required: true, allowOther: true, options: ['Developer'] },
    ],
  });
  const resolve = zodResolver(schema);
  const options = { fields: {}, shouldUseNativeValidation: false };

  it('keeps card error order for nickname, days, dynamic questions and schedule', async () => {
    const result = await resolve({ discordNickname: '', days: [], answers: {} }, undefined, options);
    expect(Object.keys(result.errors)).toEqual(['discord', 'days', 'career', 'schedule']);
  });

  it('rejects an empty other answer and accepts it once filled without losing other values', async () => {
    const values = {
      discordNickname: 'Tester',
      days: ['mon'],
      answers: {},
      otherSelected: { career: true },
      otherTexts: { career: '' },
      agreed: true,
    };
    const rejected = await resolve(values, undefined, options);
    expect(rejected.errors).toHaveProperty('career');
    const accepted = await resolve({ ...values, otherTexts: { career: 'Designer' } }, undefined, options);
    expect(accepted.errors).toEqual({});
    expect(accepted.values).toMatchObject({
      discordNickname: 'Tester',
      days: ['mon'],
      otherTexts: { career: 'Designer' },
      agreed: true,
    });
  });
});
