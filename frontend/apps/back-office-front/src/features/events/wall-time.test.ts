import { describe, expect, it } from 'vitest';

import { resolveDateField, wallTime, wallTimeChoices } from '@/features/events/wall-time';

describe('행사 일정 입력의 시계 전환 처리', () => {
  it('UTC 순간을 행사 시간대의 입력값으로 바꾼다', () => {
    expect(wallTime('2026-12-05T10:00:00Z', 'Asia/Seoul')).toBe('2026-12-05T19:00');
    expect(wallTime(null, 'Asia/Seoul')).toBe('');
  });

  it('서머타임이 시작되며 사라지는 시각은 고를 수 없다', () => {
    // 2026-03-08 02:30 America/New_York 는 존재하지 않는다
    expect(wallTimeChoices('2026-03-08', '02:30', 'America/New_York')).toEqual([]);
    const result = resolveDateField('2026-03-08T02:30', 'America/New_York');
    expect(result.iso).toBeNull();
    expect(result.error).toMatch(/사라지는 시각/);
  });

  it('같은 시각이 두 번 나오면 전·후를 골라야 확정된다', () => {
    // 2026-11-01 01:30 America/New_York 는 EDT, EST 두 번
    const choices = wallTimeChoices('2026-11-01', '01:30', 'America/New_York');
    expect(choices.map((c) => c.iso)).toEqual(['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z']);
    expect(resolveDateField('2026-11-01T01:30', 'America/New_York').iso).toBeNull();
    expect(resolveDateField('2026-11-01T01:30', 'America/New_York', { pickedIso: choices[1].iso }).iso).toBe(choices[1].iso);
  });

  it('고치지 않은 일정은 저장된 UTC 를 그대로 쓴다', () => {
    const saved = '2026-11-01T06:30:00Z';
    expect(resolveDateField('2026-11-01T01:30', 'America/New_York', { savedIso: saved }).iso).toBe(saved);
  });

  it('일반 시각은 하나로 정해진다', () => {
    expect(resolveDateField('2026-12-05T19:00', 'Asia/Seoul').iso).toBe('2026-12-05T10:00:00.000Z');
    expect(resolveDateField('', 'Asia/Seoul')).toEqual({ iso: null, choices: [] });
  });
});
