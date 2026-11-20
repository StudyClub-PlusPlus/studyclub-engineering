import { zodResolver } from '@hookform/resolvers/zod';
import { describe, expect, it } from 'vitest';

import { templateSchema } from './form-schema';
import { BODY_MAX_BYTES, SUBJECT_MAX_LENGTH } from './types';

const draft = { eventType: 'USER_REGISTERED', subject: '제목', body: '본문' };
describe('template submission contract', () => {
  it('accepts exactly the subject and UTF-8 body limits', () => {
    expect(
      templateSchema.safeParse({
        ...draft,
        subject: 'a'.repeat(SUBJECT_MAX_LENGTH),
        body: '가'.repeat(BODY_MAX_BYTES / 3),
      }).success,
    ).toBe(true);
  });
  it('rejects a programmatic value exceeding subject length', () => {
    expect(templateSchema.safeParse({ ...draft, subject: 'a'.repeat(SUBJECT_MAX_LENGTH + 1) }).success).toBe(false);
  });
  it('validates bytes instead of code units for Korean and emoji input', () => {
    expect(templateSchema.safeParse({ ...draft, body: '가'.repeat(BODY_MAX_BYTES / 3) + 'a' }).success).toBe(false);
    expect(templateSchema.safeParse({ ...draft, body: '😀'.repeat(Math.ceil(BODY_MAX_BYTES / 4)) }).success).toBe(
      false,
    );
  });
  it('RHF resolver blocks oversized reset values independently of input clipping', async () => {
    const result = await zodResolver(templateSchema)(
      { ...draft, subject: 'x'.repeat(256), body: '가'.repeat(22000) },
      undefined,
      { fields: {}, shouldUseNativeValidation: false },
    );
    expect(result.errors).toHaveProperty('subject');
    expect(result.errors).toHaveProperty('body');
    expect(result.values).toEqual({});
  });
});
