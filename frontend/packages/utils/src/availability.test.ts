import { describe, expect, it } from 'vitest';

import { availabilityOverlap, availableDaysText } from './availability';

// 2026-11-18(수) 정오 KST — 기준 주는 11-16(월) ~ 11-22(일). 북미는 서머타임이 끝난 뒤(PST = UTC-8)
const NOV = new Date('2026-11-18T03:00:00Z');
// 2026-07-15(수) — 북미 서머타임 중(PDT = UTC-7)
const JUL = new Date('2026-07-15T03:00:00Z');

const at = (r: ReturnType<typeof availabilityOverlap>, day: number, hour: number) => r.cells[day]![hour]!;

describe('availabilityOverlap', () => {
  it('기준 시간대와 같은 사람은 고른 요일 하루 전체가 칸이 된다', () => {
    const r = availabilityOverlap([{ id: 1, days: ['mon'], timeZone: 'Asia/Seoul' }], {
      baseZone: 'Asia/Seoul',
      excludeNight: false,
      now: NOV,
    });
    expect(r.weekStart).toBe('2026-11-16');
    expect(r.cells[0]!.every((c) => c.ids.length === 1)).toBe(true);
    expect(r.cells[1]!.every((c) => c.ids.length === 0)).toBe(true);
    expect(r.max).toBe(1);
  });

  it('PT 의 월요일은 KST 월 17시 ~ 화 16시에 걸친다 (PST)', () => {
    const r = availabilityOverlap([{ id: 'a', days: ['mon'], timeZone: 'America/Los_Angeles' }], {
      baseZone: 'Asia/Seoul',
      excludeNight: false,
      now: NOV,
    });
    expect(at(r, 0, 16).ids).toEqual([]);
    expect(at(r, 0, 17).ids).toEqual(['a']);
    expect(at(r, 1, 16).ids).toEqual(['a']);
    expect(at(r, 1, 17).ids).toEqual([]);
    expect(at(r, 0, 20).byZone).toEqual({ 'America/Los_Angeles': 1 });
  });

  it('서머타임 중에는 한 시간 앞당겨진다 (PDT — 월 16시부터)', () => {
    const r = availabilityOverlap([{ id: 'a', days: ['mon'], timeZone: 'America/Los_Angeles' }], {
      baseZone: 'Asia/Seoul',
      excludeNight: false,
      now: JUL,
    });
    expect(at(r, 0, 15).ids).toEqual([]);
    expect(at(r, 0, 16).ids).toEqual(['a']);
    expect(at(r, 1, 15).ids).toEqual(['a']);
    expect(at(r, 1, 16).ids).toEqual([]);
  });

  it('현지 밤(0~7시)을 빼면 그 사람 현지 새벽 칸은 세지 않는다', () => {
    const r = availabilityOverlap(
      [
        { id: 'kr', days: ['mon'], timeZone: 'Asia/Seoul' },
        { id: 'pt', days: ['mon'], timeZone: 'America/Los_Angeles' },
      ],
      { baseZone: 'Asia/Seoul', excludeNight: true, now: NOV },
    );
    // KST 월 6시 — 한국 사람 현지 새벽
    expect(at(r, 0, 6).ids).toEqual([]);
    expect(at(r, 0, 7).ids).toEqual(['kr']);
    // KST 월 17시 = PT 월 0시 → PT 는 새벽이라 빠진다. KST 화 0시 = PT 월 7시 → 들어온다
    expect(at(r, 0, 17).ids).toEqual(['kr']);
    expect(at(r, 1, 0).ids).toEqual(['pt']);
  });

  it('기준 시간대를 바꾸면 같은 사람이 다른 칸에 놓인다', () => {
    const r = availabilityOverlap([{ id: 'kr', days: ['tue'], timeZone: 'Asia/Seoul' }], {
      baseZone: 'America/Los_Angeles',
      excludeNight: false,
      now: NOV,
    });
    // KST 화 0시 = PT 월 7시
    expect(at(r, 0, 6).ids).toEqual([]);
    expect(at(r, 0, 7).ids).toEqual(['kr']);
  });

  it('시간대가 없거나 읽을 수 없으면 KST 로 세고, 요일이 없는 사람은 넣지 않는다', () => {
    const r = availabilityOverlap(
      [
        { id: 1, days: ['mon'], timeZone: null },
        { id: 2, days: [], timeZone: 'Asia/Seoul' },
        { id: 3, days: ['mon'], timeZone: 'Not/AZone' },
        { id: 4, days: ['wed'], timeZone: 'Asia/Seoul' },
      ],
      { baseZone: 'America/Los_Angeles', excludeNight: false, now: NOV },
    );
    expect(r.counted).toBe(3);
    // KST 월 0시 = PT 일 7시(PST) — 시간대 없는 1 · 3 은 KST 월요일로 들어간다
    expect(at(r, 6, 7).ids).toEqual([1, 3]);
    expect(at(r, 6, 7).byZone).toEqual({ 'Asia/Seoul': 2 });
    expect(at(r, 6, 6).ids).toEqual([]);
  });

  it('여러 사람이 겹치면 칸 인원과 최대값이 커진다', () => {
    const r = availabilityOverlap(
      [
        { id: 1, days: ['mon', 'tue'], timeZone: 'Asia/Seoul' },
        { id: 2, days: ['mon'], timeZone: 'Asia/Seoul' },
        { id: 3, days: ['mon'], timeZone: 'America/New_York' },
      ],
      { baseZone: 'Asia/Seoul', excludeNight: false, now: NOV },
    );
    // KST 화 13시 = ET(EST, UTC-5) 월 23시 → 1(화) + 3(월)
    expect(at(r, 1, 13).ids.sort()).toEqual([1, 3]);
    expect(at(r, 1, 14).ids).toEqual([1]);
    expect(at(r, 0, 12).ids.sort()).toEqual([1, 2]);
    // KST 월 14시 = ET 월 0시 → 셋 다 월요일
    expect(at(r, 0, 14).ids.sort()).toEqual([1, 2, 3]);
    expect(r.max).toBe(3);
  });
});

describe('availableDaysText', () => {
  it('요일 순서대로 이어 쓴다', () => {
    expect(availableDaysText(['sun', 'mon', 'wed'])).toBe('월 · 수 · 일');
  });
  it('없으면 빈 문자열', () => {
    expect(availableDaysText(null)).toBe('');
    expect(availableDaysText([])).toBe('');
  });
});
