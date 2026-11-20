import { describe, expect, it } from 'vitest';

import { browserLoginResponseSchema, socialLoginResponseSchema, tokenResponseSchema } from './response-schema';

const account = {
  id: 1,
  email: 'member@example.com',
  nickname: null,
  picture: null,
  role: 'MEMBER',
  timeZone: null,
  onboardingCompletedAt: null,
};

describe('OAuth response boundaries', () => {
  it('accepts a new account with nullable profile and optional nickname suggestion', () => {
    expect(browserLoginResponseSchema.parse({ account }).account).toEqual(account);
  });
  it.each([{}, { accessToken: '' }, { accessToken: 123 }, { accessToken: 'token', accessTokenExpiresIn: '3600' }])(
    'rejects malformed token responses: %j',
    (response) => {
      expect(tokenResponseSchema.safeParse(response).success).toBe(false);
    },
  );
  it('validates the nested account even when token fields are valid', () => {
    expect(
      socialLoginResponseSchema.safeParse({ accessToken: 'token', account: { ...account, id: '1' } }).success,
    ).toBe(false);
  });
});
