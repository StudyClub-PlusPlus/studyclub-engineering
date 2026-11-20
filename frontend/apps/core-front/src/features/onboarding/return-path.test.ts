import { describe, expect, it } from 'vitest';

import { returnPath } from './model';

describe('returnPath', () => {
  it('보던 화면(홈 포함)으로 돌아간다', () => {
    expect(returnPath('/ko', 'ko')).toBe('/ko');
    expect(returnPath('/ko/studies/3', 'ko')).toBe('/ko/studies/3');
  });

  it('바깥 주소·로그인 화면·빈 값은 /my 로', () => {
    expect(returnPath('https://evil.example', 'ko')).toBe('/ko/my');
    expect(returnPath('//evil.example', 'ko')).toBe('/ko/my');
    expect(returnPath('/ko/login', 'ko')).toBe('/ko/my');
    expect(returnPath(null, 'en')).toBe('/en/my');
  });
});
