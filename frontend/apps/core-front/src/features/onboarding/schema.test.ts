import { describe, expect, it } from 'vitest';

import { makeOnboardingSchema } from './schema';
describe('onboarding form schema', () => {
  const valid = {
    nickname: '테스터',
    timeZone: 'Asia/Seoul',
    ageConfirmed: true,
    termsOfServiceAgreed: true,
    privacyPolicyAgreed: true,
    marketingAgreed: false,
  };
  it('requires age and both mandatory consents, but allows marketing opt-out', () => {
    const schema = makeOnboardingSchema('ko');
    expect(schema.safeParse(valid).success).toBe(true);
    for (const key of ['ageConfirmed', 'termsOfServiceAgreed', 'privacyPolicyAgreed'])
      expect(schema.safeParse({ ...valid, [key]: false }).success).toBe(false);
  });
  it('rejects invalid nicknames and unsupported onboarding zones', () => {
    expect(makeOnboardingSchema('en').safeParse({ ...valid, nickname: '!' }).success).toBe(false);
    expect(makeOnboardingSchema('en').safeParse({ ...valid, timeZone: 'UTC' }).success).toBe(false);
  });
});
