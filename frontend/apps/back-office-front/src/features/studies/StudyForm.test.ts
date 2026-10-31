import { describe, expect, it } from 'vitest';

import {
  EMPTY_FORM,
  detailToForm,
  formToCreatePayload,
  formToPayload,
  serverErrorToField,
  validateStudyForm,
  type StudyFormValues,
} from '@/features/studies/form-schema';
import type { ApiStudyDetail } from '@/features/studies/types';

const detail: ApiStudyDetail = {
  discordLinked: false,
  id: 7,
  programId: 3,
  programTitle: 'AI 논문 스터디',
  title: 'AI 논문 스터디',
  oneLineSummary: '논문을 함께 읽습니다.',
  description: null,
  category: 'AI_ML',
  studyKind: 'STUDY',
  thumbnailUrl: null,
  status: 'OPEN',
  recruitStatus: 'RECRUITING',
  curriculum: null,
  capacity: null,
  schedule: '매주 목 20:00',
  timezone: 'KST',
  // KST 10월 1일 23:59:59 = UTC 10월 1일 14:59:59
  recruitDeadlineAt: '2026-10-01T14:59:59Z',
  // KST 10월 15일 00:00 = UTC 10월 14일 15:00 — UTC 로 자르면 하루 앞당겨진다
  startAt: '2026-10-14T15:00:00Z',
  endAt: null,
  discordChannelUrl: 'https://discord.com/channels/1/2',
  driveUrl: null,
};

describe('detailToForm', () => {
  it('날짜를 KST 날짜로 읽는다', () => {
    const form = detailToForm(detail);
    expect(form.deadline).toBe('2026-10-01');
    expect(form.startAt).toBe('2026-10-15');
  });

  it('정원이 없으면 제한 없음으로, 빈 값은 빈 문자열로 연다', () => {
    const form = detailToForm(detail);
    expect(form.unlimited).toBe(true);
    expect(form.capacity).toBe('');
    expect(form.description).toBe('');
    expect(form.driveUrl).toBe('');
  });

  it('시간대는 응답 값 그대로, 없으면 미정(빈 값)으로 연다', () => {
    expect(detailToForm(detail).timezone).toBe('KST');
    expect(detailToForm({ ...detail, timezone: null }).timezone).toBe('');
  });
});

describe('formToPayload', () => {
  const initial = detailToForm(detail);

  it('아무것도 안 바꾸면 빈 바디다 — 지난 마감일을 다시 보내지 않는다', () => {
    expect(formToPayload(initial, initial)).toEqual({});
  });

  it('바뀐 칸만 보낸다', () => {
    const form: StudyFormValues = { ...initial, title: '  새 제목 ' };
    expect(formToPayload(form, initial)).toEqual({ title: '새 제목' });
  });

  it('마감일은 KST 그날 끝, 시작일은 KST 그날 0시로 보낸다', () => {
    const form: StudyFormValues = { ...initial, deadline: '2026-11-01', startAt: '2026-11-10' };
    expect(formToPayload(form, initial)).toEqual({
      recruitDeadline: '2026-11-01T14:59:59.000Z',
      startAt: '2026-11-09T15:00:00.000Z',
    });
  });

  it('정원을 정하면 숫자로, 다시 제한 없음으로 돌리면 null 로 보낸다', () => {
    const limited: StudyFormValues = { ...initial, unlimited: false, capacity: '12' };
    expect(formToPayload(limited, initial)).toEqual({ capacity: 12 });
    expect(formToPayload({ ...limited, unlimited: true, capacity: '' }, limited)).toEqual({ capacity: null });
  });

  it('비운 주소·시작일은 null 로 보내 서버 값도 비운다', () => {
    const form: StudyFormValues = { ...initial, discordUrl: '  ', startAt: '' };
    expect(formToPayload(form, initial)).toEqual({ discordChannelUrl: null, startAt: null });
  });

  it('시간대를 바꾸면 값을, 미정으로 돌리면 null 을 보낸다', () => {
    expect(formToPayload({ ...initial, timezone: 'BOTH' }, initial)).toEqual({ timezone: 'BOTH' });
    expect(formToPayload({ ...initial, timezone: '' }, initial)).toEqual({ timezone: null });
  });
});

describe('validateStudyForm', () => {
  const valid: StudyFormValues = {
    ...EMPTY_FORM,
    title: '제목',
    summary: '소개',
    category: 'DATA',
    deadline: '2026-11-01',
  };

  it('필수 칸이 차 있으면 통과한다', () => {
    expect(validateStudyForm(valid)).toEqual({});
  });

  it('마감일은 필수다 — 상시 모집은 없다', () => {
    expect(validateStudyForm({ ...valid, deadline: '' })).toHaveProperty('deadline');
  });

  it('진행 시작일은 모집 마감일보다 빠를 수 없다', () => {
    expect(validateStudyForm({ ...valid, startAt: '2026-10-31' })).toHaveProperty('startAt');
    expect(validateStudyForm({ ...valid, startAt: '2026-11-01' })).toEqual({});
    expect(validateStudyForm({ ...valid, startAt: '2026-11-02' })).toEqual({});
  });

  it('정원은 1 이상의 정수여야 한다', () => {
    expect(validateStudyForm({ ...valid, unlimited: false, capacity: '0' })).toHaveProperty('capacity');
    expect(validateStudyForm({ ...valid, unlimited: false, capacity: '5' })).toEqual({});
  });

  it('주소는 http(s):// 로 시작해야 한다', () => {
    expect(validateStudyForm({ ...valid, driveUrl: 'drive.google.com/x' })).toHaveProperty('driveUrl');
    expect(validateStudyForm({ ...valid, driveUrl: 'https://drive.google.com/x' })).toEqual({});
  });

  it('기존 클럽의 새 기수인데 프로그램을 안 고르면 막는다', () => {
    expect(validateStudyForm({ ...valid, programMode: 'existing', programId: '' })).toHaveProperty('programId');
    expect(validateStudyForm({ ...valid, programMode: 'existing', programId: '3' })).toEqual({});
  });

  it('새 프로그램이면 프로그램을 고르지 않아도 된다', () => {
    expect(validateStudyForm({ ...valid, programMode: 'new', programId: '' })).toEqual({});
  });
});

describe('formToCreatePayload', () => {
  const base: StudyFormValues = {
    ...EMPTY_FORM,
    title: '제목',
    summary: '소개',
    category: 'DATA',
    deadline: '2026-11-01',
  };

  it('새 프로그램이면 studyKind 를 보내고 studyProgramId 는 안 보낸다', () => {
    const payload = formToCreatePayload({ ...base, programMode: 'new', kind: 'CLUB' });
    expect(payload.studyKind).toBe('CLUB');
    expect(payload).not.toHaveProperty('studyProgramId');
  });

  it('기존 클럽의 새 기수면 studyProgramId 만 보낸다 — 종류는 바꿀 수 없어 함께 보내면 서버가 400 이다', () => {
    const payload = formToCreatePayload({ ...base, programMode: 'existing', programId: '3', kind: 'CLUB' });
    expect(payload.studyProgramId).toBe(3);
    expect(payload).not.toHaveProperty('studyKind');
  });

  it('마감일은 KST 그날 끝으로 보낸다', () => {
    expect(formToCreatePayload(base).recruitDeadline).toBe('2026-11-01T14:59:59.000Z');
  });

  it('비어 있는 선택 칸은 싣지 않는다', () => {
    const payload = formToCreatePayload(base);
    expect(payload).not.toHaveProperty('schedule');
    expect(payload).not.toHaveProperty('description');
    expect(payload).not.toHaveProperty('timezone');
  });

  it('고른 시간대를 싣는다', () => {
    expect(formToCreatePayload({ ...base, timezone: 'PST' }).timezone).toBe('PST');
  });
});

describe('serverErrorToField', () => {
  it('서버 필드 이름을 폼 칸으로 옮긴다', () => {
    expect(serverErrorToField('recruitDeadline: 모집 마감일은 미래여야 합니다.')).toEqual({
      deadline: '모집 마감일은 미래여야 합니다.',
    });
    expect(serverErrorToField('capacity: 1 이상의 정수여야 합니다.')).toEqual({
      capacity: '1 이상의 정수여야 합니다.',
    });
    expect(serverErrorToField('studyProgramId: 새 기수는 클럽에만 붙일 수 있습니다.')).toEqual({
      programId: '새 기수는 클럽에만 붙일 수 있습니다.',
    });
  });

  it('칸을 모르는 메시지는 null 이다', () => {
    expect(serverErrorToField('스터디 수정 권한이 없습니다.')).toBeNull();
    expect(serverErrorToField('status: 바꿀 수 없습니다.')).toBeNull();
  });
});

describe('썸네일', () => {
  const withThumb = detailToForm({ ...detail, thumbnailUrl: 'https://cdn.test/gigs/thumbnails/a.jpg' });

  it('새로 올렸으면 번호를 보낸다 — 등록과 수정 둘 다', () => {
    const uploaded = { ...withThumb, thumbnailFileId: 7, thumbnailUrl: 'https://cdn.test/gigs/thumbnails/b.jpg' };
    expect(formToPayload(uploaded, withThumb)).toEqual({ thumbnailFileId: 7 });
    expect(formToCreatePayload({ ...uploaded, programMode: 'new' }).thumbnailFileId).toBe(7);
  });

  it('있던 것을 지웠으면 null 을 보낸다', () => {
    expect(formToPayload({ ...withThumb, thumbnailUrl: '' }, withThumb)).toEqual({ thumbnailFileId: null });
  });

  it('그대로면 보내지 않는다 — 같은 번호를 두 번 연결하면 400', () => {
    expect(formToPayload(withThumb, withThumb)).toEqual({});
    expect(formToCreatePayload({ ...withThumb, programMode: 'new' })).not.toHaveProperty('thumbnailFileId');
  });
});
