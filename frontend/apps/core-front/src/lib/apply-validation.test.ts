import type { ApplicationQuestion } from '@studyclub/mock';
import { describe, expect, it } from 'vitest';

import {
  daysIssue,
  extraAnswerIssue,
  makeApplySchema,
  nicknameIssue,
  normalizeSingleLine,
} from './apply-validation';

describe('normalizeSingleLine', () => {
  it('줄바꿈과 탭을 공백으로 바꾸고 앞뒤 공백을 trim한다', () => {
    expect(normalizeSingleLine('  홍길동\nSWE\t산호세  ')).toBe('홍길동 SWE 산호세');
    expect(normalizeSingleLine(null)).toBe('');
    expect(normalizeSingleLine(undefined)).toBe('');
    expect(normalizeSingleLine('   ')).toBe('');
  });
});

describe('nicknameIssue', () => {
  it('공백만 있으면 empty 이슈를 반환한다', () => {
    expect(nicknameIssue('')).toBe('empty');
    expect(nicknameIssue('   ')).toBe('empty');
    expect(nicknameIssue('\n\t')).toBe('empty');
  });

  it('100자를 초과하면 max 이슈를 반환한다', () => {
    expect(nicknameIssue('a'.repeat(101))).toBe('max');
  });

  it('1~100자 사이는 null을 반환한다', () => {
    expect(nicknameIssue('테스트/SWE/산호세/시스템디자인')).toBeNull();
    expect(nicknameIssue('a'.repeat(100))).toBeNull();
  });
});

describe('daysIssue', () => {
  it('선택된 요일이 없으면 empty를 반환한다', () => {
    expect(daysIssue([])).toBe('empty');
  });

  it('허용되지 않은 요일 키가 있으면 enum을 반환한다', () => {
    expect(daysIssue(['mon', 'invalid'])).toBe('enum');
  });

  it('정상 요일 키는 null을 반환한다', () => {
    expect(daysIssue(['mon', 'wed', 'fri'])).toBeNull();
  });
});

describe('extraAnswerIssue', () => {
  it('단답형(text) 검증: 필수 누락 시 empty, 200자 초과 시 max', () => {
    const q: ApplicationQuestion = {
      id: 'q1',
      label: '단답 질문',
      type: 'text',
      required: true,
    };

    expect(extraAnswerIssue(q, '')).toBe('empty');
    expect(extraAnswerIssue(q, '   ')).toBe('empty');
    expect(extraAnswerIssue(q, 'a'.repeat(201))).toBe('max');
    expect(extraAnswerIssue(q, '정상 답변')).toBeNull();
  });

  it('장문형(textarea) 검증: 필수 누락 시 empty, 2,000자 초과 시 max', () => {
    const q: ApplicationQuestion = {
      id: 'q2',
      label: '장문 질문',
      type: 'textarea',
      required: true,
    };

    expect(extraAnswerIssue(q, '')).toBe('empty');
    expect(extraAnswerIssue(q, 'a'.repeat(2_001))).toBe('max');
    expect(extraAnswerIssue(q, '줄바꿈이\n포함된\n답변')).toBeNull();
  });

  it('라디오(radio) 검증: 선택지 밖 값은 enum, allowOther 기타 빈값은 other-empty, 100자 초과는 other-max', () => {
    const q: ApplicationQuestion = {
      id: 'q3',
      label: '객관식 단일',
      type: 'radio',
      required: true,
      options: ['옵션 A', '옵션 B'],
      allowOther: true,
    };

    expect(extraAnswerIssue(q, '옵션 A')).toBeNull();
    expect(extraAnswerIssue(q, '알수없는값')).toBeNull(); // allowOther이므로 일반 text 검증으로 이어짐
    expect(extraAnswerIssue(q, '', true, '')).toBe('other-empty');
    expect(extraAnswerIssue(q, '', true, '   ')).toBe('other-empty');
    expect(extraAnswerIssue(q, '', true, 'a'.repeat(101))).toBe('other-max');
    expect(extraAnswerIssue(q, '', true, '기타 내용')).toBeNull();

    const noOther: ApplicationQuestion = {
      id: 'q3_no',
      label: '기타 미허용',
      type: 'radio',
      required: true,
      options: ['옵션 A', '옵션 B'],
      allowOther: false,
    };
    expect(extraAnswerIssue(noOther, '기타 내용')).toBe('enum');
  });

  it('체크박스(checkbox) 검증: 필수 누락, allowOther 기타 빈값 및 상한', () => {
    const q: ApplicationQuestion = {
      id: 'q4',
      label: '객관식 다중',
      type: 'checkbox',
      required: true,
      options: ['옵션 1', '옵션 2'],
      allowOther: true,
    };

    expect(extraAnswerIssue(q, [])).toBe('empty');
    expect(extraAnswerIssue(q, ['옵션 1'])).toBeNull();
    expect(extraAnswerIssue(q, ['옵션 1'], true, '')).toBe('other-empty');
    expect(extraAnswerIssue(q, ['옵션 1'], true, 'a'.repeat(101))).toBe('other-max');
    expect(extraAnswerIssue(q, ['옵션 1'], true, '기타 의견')).toBeNull();
  });
});

describe('makeApplySchema (Zod validation)', () => {
  it('디스코드 닉네임 누락 시 discord path에 에러를 반환한다', () => {
    const schema = makeApplySchema({ locale: 'ko' });
    const result = schema.safeParse({
      discordNickname: '',
      days: ['mon'],
      answers: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['discord']);
      expect(result.error.issues[0].message).toContain('디스코드 서버 별명');
    }
  });

  it('요일 미선택 시 days path에 에러를 반환한다', () => {
    const schema = makeApplySchema({ locale: 'ko' });
    const result = schema.safeParse({
      discordNickname: '테스트크루',
      days: [],
      answers: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['days']);
      expect(result.error.issues[0].message).toContain('참여 가능한 요일');
    }
  });

  it('고정 일정 스터디에서 agreed가 false이면 schedule path에 에러를 반환한다', () => {
    const schema = makeApplySchema({ hasFixedSchedule: true, locale: 'ko' });
    const result = schema.safeParse({
      discordNickname: '테스트크루',
      days: ['mon'],
      agreed: false,
      answers: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['schedule']);
      expect(result.error.issues[0].message).toContain('일정 참여 가능 여부');
    }
  });

  it('동적 필수 질문 누락 시 해당 질문 id path에 에러를 반환한다', () => {
    const q: ApplicationQuestion = {
      id: 'q_career',
      label: '경력',
      type: 'text',
      required: true,
    };
    const schema = makeApplySchema({ extraQuestions: [q], locale: 'ko' });
    const result = schema.safeParse({
      discordNickname: '테스트크루',
      days: ['mon'],
      answers: {},
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['q_career']);
      expect(result.error.issues[0].message).toContain('필수 질문');
    }
  });

  it('모든 조건 충족 시 success: true를 반환한다', () => {
    const schema = makeApplySchema({ hasFixedSchedule: true, locale: 'ko' });
    const result = schema.safeParse({
      discordNickname: '테스트크루',
      days: ['mon', 'wed'],
      agreed: true,
      answers: {},
    });
    expect(result.success).toBe(true);
  });
});
