import { describe, expect, it } from 'vitest';

import {
  emptyEventForm,
  fieldOfServerError,
  newQuestion,
  resolveDates,
  toPayload,
  validateEventForm,
  type EventFormValues,
} from '@/features/events/form-schema';

const NOW = Date.parse('2026-11-20T00:00:00Z');

function valid(patch: Partial<EventFormValues> = {}): EventFormValues {
  return {
    ...emptyEventForm(),
    title: '연말 밋업',
    summary: '크루끼리 만나요',
    description: '소개',
    startsAt: '2026-12-05T19:00',
    deadlineAt: '2026-12-03T23:59',
    ...patch,
  };
}

const check = (values: EventFormValues) => validateEventForm(values, resolveDates(values, {}), { now: NOW });

describe('행사 폼 검사와 요청 본문', () => {
  it('필수 입력과 글자 수를 서버와 같은 기준으로 본다', () => {
    expect(check(valid())).toEqual({});
    expect(check(valid({ title: ' ', summary: '' })).title).toBeDefined();
    expect(check(valid({ title: '가'.repeat(61) })).title).toMatch(/60자/);
    expect(check(valid({ description: 'a'.repeat(5001) })).description).toMatch(/5,000자/);
  });

  it('신청 마감은 시작 이전이고 등록에서는 미래여야 한다', () => {
    expect(check(valid({ deadlineAt: '2026-12-06T10:00' })).deadlineAt).toMatch(/이전/);
    expect(check(valid({ startsAt: '2026-11-10T10:00', deadlineAt: '2026-11-09T10:00' })).deadlineAt).toMatch(/현재보다 늦게/);
    expect(check(valid({ endsAt: '2026-12-05T18:00' })).endsAt).toMatch(/늦어야/);
  });

  it('참여 방식에 맞는 정원·장소·링크만 검사한다', () => {
    expect(check(valid({ format: 'OFFLINE', location: '' })).location).toBeDefined();
    expect(check(valid({ format: 'ONLINE', location: '' })).location).toBeUndefined();
    expect(check(valid({ onlineCapacity: '0' })).onlineCapacity).toBeDefined();
    expect(check(valid({ onlineUrl: 'ftp://x' })).onlineUrl).toBeDefined();
    expect(check(valid({ onlineUrl: '' })).onlineUrl).toBeUndefined();
  });

  it('객관식은 서로 다른 선택지 2~10개가 필요하다', () => {
    const question = { ...newQuestion(), label: '관심', type: 'RADIO' as const };
    expect(check(valid({ questions: [{ ...question, options: ['A', 'A'] }] }))['questions.0.options']).toBeDefined();
    expect(check(valid({ questions: [{ ...question, options: ['A'] }] }))['questions.0.options']).toBeDefined();
    expect(check(valid({ questions: [{ ...question, options: ['A', 'B'] }] }))).toEqual({});
  });

  it('요청 본문은 UTC 로 보내고, 없는 참여 방식은 null, 새 질문의 questionId 는 null 이다', () => {
    const values = valid({
      format: 'HYBRID',
      location: ' 강남 ',
      onlineUrl: '',
      questions: [{ ...newQuestion(), label: ' 동기 ', type: 'TEXTAREA', options: ['남은 값'] }],
    });
    const payload = toPayload(values, resolveDates(values, {}));
    expect(payload).toMatchObject({
      startsAt: '2026-12-05T10:00:00.000Z',
      endsAt: null,
      offline: { capacity: 20, location: '강남' },
      online: { capacity: 30, url: null },
      questions: [{ questionId: null, label: '동기', options: [] }],
    });
    const online = valid({ format: 'ONLINE' });
    expect(toPayload(online, resolveDates(online, {})).offline).toBeNull();
  });

  it('서버 오류 코드를 입력란에 잇는다', () => {
    expect(fieldOfServerError('EVENT_START_LOCKED', '')).toBe('startsAt');
    expect(fieldOfServerError('CHANNEL_IN_USE', '')).toBe('format');
    expect(fieldOfServerError('INVALID_INPUT', 'deadlineAt: 마감이 지났습니다')).toBe('deadlineAt');
    expect(fieldOfServerError('NOT_FOUND', '')).toBeNull();
  });
});
