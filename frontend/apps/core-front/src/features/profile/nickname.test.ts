import { describe, expect, it } from 'vitest';

import { isSameNickname } from './nickname';

// 지금 쓰는 자기 닉네임이면 서버에 묻지 않는다 — 안 바뀐 값으로 요청을 보낼 이유가 없다.
// 서버도 자기 계정은 빼고 보므로 어느 쪽이 판정해도 시간대만 바꾸는 사람이 빨간 오류를 보지 않는다.
describe('isSameNickname', () => {
  it('글자가 같으면 같다', () => {
    expect(isSameNickname('honggildong', 'honggildong')).toBe(true);
  });

  it('앞뒤 공백과 대소문자 차이는 무시한다', () => {
    expect(isSameNickname('  HongGilDong ', 'honggildong')).toBe(true);
  });

  it('글자가 다르면 다르다', () => {
    expect(isSameNickname('honggildong2', 'honggildong')).toBe(false);
  });

  it('지금 닉네임이 없으면 같을 수 없다', () => {
    expect(isSameNickname('honggildong', null)).toBe(false);
  });
});
