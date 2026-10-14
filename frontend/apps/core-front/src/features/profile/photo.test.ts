import { describe, expect, it } from 'vitest';

import { PHOTO_MAX_BYTES, PHOTO_SIZE_ERROR, PHOTO_TYPE_ERROR, initialOf, photoProblem } from './photo';

// 서버가 다시 검사하지만, 안 맞는 파일을 5MB 까지 올려 보낸 뒤에 알려 주면 느리다 — 고른 직후 거른다.
describe('photoProblem', () => {
  it('jpeg · png · webp 는 통과한다', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(photoProblem({ type, size: 1024 })).toBeNull();
    }
  });

  it('다른 형식은 거른다', () => {
    expect(photoProblem({ type: 'image/gif', size: 1024 })).toBe(PHOTO_TYPE_ERROR);
    expect(photoProblem({ type: '', size: 1024 })).toBe(PHOTO_TYPE_ERROR);
  });

  it('5MB 를 넘으면 거르고, 딱 5MB 는 통과한다', () => {
    expect(photoProblem({ type: 'image/png', size: PHOTO_MAX_BYTES + 1 })).toBe(PHOTO_SIZE_ERROR);
    expect(photoProblem({ type: 'image/png', size: PHOTO_MAX_BYTES })).toBeNull();
  });
});

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
