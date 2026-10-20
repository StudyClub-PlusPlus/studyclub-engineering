import { IMAGE_MAX_BYTES, IMAGE_SIZE_ERROR, IMAGE_TYPE_ERROR, imageFileProblem } from '@studyclub/ui';
import { describe, expect, it } from 'vitest';

// 서버가 다시 검사하지만, 안 맞는 파일을 5MB 까지 올려 보낸 뒤에 알려 주면 느리다 — 고른 직후 거른다.
describe('imageFileProblem', () => {
  it('jpeg · png · webp 는 통과한다', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(imageFileProblem({ type, size: 1024 })).toBeNull();
    }
  });

  it('다른 형식은 거른다', () => {
    expect(imageFileProblem({ type: 'image/gif', size: 1024 })).toBe(IMAGE_TYPE_ERROR);
    expect(imageFileProblem({ type: '', size: 1024 })).toBe(IMAGE_TYPE_ERROR);
  });

  it('5MB 를 넘으면 거르고, 딱 5MB 는 통과한다', () => {
    expect(imageFileProblem({ type: 'image/png', size: IMAGE_MAX_BYTES + 1 })).toBe(IMAGE_SIZE_ERROR);
    expect(imageFileProblem({ type: 'image/png', size: IMAGE_MAX_BYTES })).toBeNull();
  });
});
