import { describe, expect, it } from 'vitest';

import { initialOf } from './photo';

describe('initialOf', () => {
  it('닉네임 첫 글자를 대문자로', () => {
    expect(initialOf('honggildong', 'x@example.com')).toBe('H');
    expect(initialOf('홍길동', 'x@example.com')).toBe('홍');
  });

  it('닉네임이 없거나 비어 있으면 이메일 첫 글자', () => {
    expect(initialOf(null, 'hong@example.com')).toBe('H');
    expect(initialOf('   ', 'hong@example.com')).toBe('H');
  });
});
