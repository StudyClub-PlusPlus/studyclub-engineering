import { describe, expect, it } from 'vitest';

import { distinctNames } from './crew';

describe('발표자 드롭다운 이름', () => {
  it('닉네임이 겹치는 사람만 디스코드 닉네임을 붙인다 — 별명이 없으면 그대로', () => {
    expect(
      distinctNames([
        { id: 'p5', name: 'minjun', discordNickname: '민준/BE/서울' },
        { id: 'p6', name: 'minjun', discordNickname: '민준/ML/LA' },
        { id: 'p7', name: 'seoyun', discordNickname: null },
      ]).map((c) => c.name),
    ).toEqual(['minjun (민준/BE/서울)', 'minjun (민준/ML/LA)', 'seoyun']);
  });
});
