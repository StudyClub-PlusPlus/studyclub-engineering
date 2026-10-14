import { describe, expect, it } from 'vitest';

import { isSameNickname } from './nickname';

// 지금 쓰는 자기 닉네임은 중복 확인 API 가 "사용 중" 이라 답한다. 같다고 판정해야 서버에 묻지 않고,
// 그래야 자기 닉네임을 그대로 둔 채 시간대만 바꾸는 사람이 빨간 오류를 보지 않는다.
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
